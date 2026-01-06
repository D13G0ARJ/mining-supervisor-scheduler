export const STATES = {
    SUBIDA: 'S',
    INDUCCION: 'I',
    PERFORACION: 'P',
    BAJADA: 'B',
    DESCANSO: 'D',
    VACIO: '-'
};

const createEmptySchedule = (days) => new Array(days).fill(STATES.VACIO);

export const getCoverageStartDayIndex = (params) => {
    // Día en que termina la inducción y la operación ya puede tener 2 perforando.
    // Con el modelo del PDF: Día 0 = S (subida), Día 1..induction = I, Día (1+induction) = primer P.
    return 1 + params.induction;
};

const assertValidParams = (params) => {
    const { N, M, induction, totalDays } = params;

    if (!Number.isInteger(N) || N < 1) throw new Error('N inválido');
    if (!Number.isInteger(M) || M < 3) throw new Error('M inválido: debe ser >= 3 (para incluir B + al menos 1 D + S)');
    if (!Number.isInteger(induction) || induction < 1 || induction > 5) throw new Error('Inducción inválida');
    if (!Number.isInteger(totalDays) || totalDays < 1) throw new Error('Total de días inválido');

    // En el PDF: N representa los días de trabajo excluyendo la subida (S). Es decir, N = I + P (en el primer ciclo).
    // Por lo tanto debe existir al menos un bloque de P con varios días.
    const firstCyclePDays = N - induction;
    if (firstCyclePDays < 2) {
        throw new Error(`Configuración inválida: N (${N}) debe ser al menos inducción (${induction}) + 2 para tener >=2 días de perforación.`);
    }
};

/**
 * Genera un patrón fijo (S1) siguiendo el modelo del PDF:
 * - Día 0 de cada ciclo: S
 * - Días 1..N: trabajo (primer ciclo: I hasta induction, luego P; ciclos siguientes: todo P)
 * - Día N+1: B
 * - Días restantes del ciclo: D (cantidad = M-2)
 * Longitud de ciclo: N + M
 */
const generateFixedPattern = (offset, params, totalDays) => {
    const { N, M, induction } = params;
    const schedule = createEmptySchedule(totalDays);
    const cycleLength = N + M;

    for (let i = 0; i < totalDays; i++) {
        const t = i - offset;
        if (t < 0) {
            schedule[i] = STATES.VACIO;
            continue;
        }

        const cycleIndex = Math.floor(t / cycleLength);
        const dayInCycle = t % cycleLength;

        if (dayInCycle === 0) {
            schedule[i] = STATES.SUBIDA;
            continue;
        }

        if (dayInCycle >= 1 && dayInCycle <= N) {
            if (cycleIndex === 0 && dayInCycle <= induction) {
                schedule[i] = STATES.INDUCCION;
            } else {
                schedule[i] = STATES.PERFORACION;
            }
            continue;
        }

        if (dayInCycle === N + 1) {
            schedule[i] = STATES.BAJADA;
            continue;
        }

        schedule[i] = STATES.DESCANSO;
    }

    return schedule;
};

const MIN_P_BLOCK = 2;

const makeInitialState = ({ offsetDays, hasInductionFirstCycle, inductionDays }) => {
    return {
        untilStart: offsetDays,
        phase: offsetDays > 0 ? 'PRE' : 'S',
        firstCycle: true,
        inductionLeft: hasInductionFirstCycle ? inductionDays : 0,
        pRun: 0,
        restTaken: 0
    };
};

const stateKey = (s) => {
    return [
        s.untilStart,
        s.phase,
        s.firstCycle ? 1 : 0,
        s.inductionLeft,
        s.pRun,
        s.restTaken
    ].join('|');
};

const nextOptionsForSupervisor = (state, params, maxPConsecutive) => {
    // Returns an array of { out, next }.
    const options = [];

    if (state.phase === 'PRE') {
        const next = { ...state, untilStart: state.untilStart - 1 };
        if (next.untilStart <= 0) {
            next.untilStart = 0;
            next.phase = 'S';
        }
        options.push({ out: STATES.VACIO, next });
        return options;
    }

    if (state.phase === 'S') {
        const next = { ...state };
        if (next.firstCycle && next.inductionLeft > 0) {
            next.phase = 'I';
        } else {
            next.phase = 'P';
            next.pRun = 0;
        }
        options.push({ out: STATES.SUBIDA, next });
        return options;
    }

    if (state.phase === 'I') {
        const next = { ...state, inductionLeft: state.inductionLeft - 1 };
        if (next.inductionLeft <= 0) {
            next.inductionLeft = 0;
            next.phase = 'P';
            next.pRun = 0;
        }
        options.push({ out: STATES.INDUCCION, next });
        return options;
    }

    if (state.phase === 'P') {
        const pRunAfterToday = state.pRun + 1;

        // Continue P (permitido mientras no exceda el máximo consecutivo).
        if (pRunAfterToday < maxPConsecutive) {
            options.push({
                out: STATES.PERFORACION,
                next: {
                    ...state,
                    pRun: pRunAfterToday
                }
            });
        }

        // End work -> B (allowed if we've done enough P days)
        if (pRunAfterToday >= MIN_P_BLOCK) {
            options.push({
                out: STATES.PERFORACION,
                next: {
                    ...state,
                    phase: 'B',
                    pRun: 0
                }
            });
        }

        // Si ya llegamos al máximo, forzamos finalizar en B (sin opción de seguir en P).
        if (pRunAfterToday >= maxPConsecutive) {
            options.length = 0;
            options.push({
                out: STATES.PERFORACION,
                next: {
                    ...state,
                    phase: 'B',
                    pRun: 0
                }
            });
        }

        return options;
    }

    if (state.phase === 'B') {
        options.push({
            out: STATES.BAJADA,
            next: {
                ...state,
                phase: 'D',
                restTaken: 0,
                firstCycle: false,
                inductionLeft: 0
            }
        });
        return options;
    }

    if (state.phase === 'D') {
        // En el modelo del PDF, el bloque de descanso D después de B dura al menos (M-2)
        // días (porque el descanso total M incluye B + D*(M-2) + S).
        // Permitimos descansar más si hace falta para cumplir "exactamente 2 perforando".
        const minDDays = Math.max(1, params.M - 2);

        const restTakenAfterToday = state.restTaken + 1;

        // Keep resting
        options.push({
            out: STATES.DESCANSO,
            next: { ...state, restTaken: restTakenAfterToday }
        });

        // Go up (start next cycle) if already rested enough days
        if (restTakenAfterToday >= minDDays) {
            options.push({
                out: STATES.DESCANSO,
                next: { ...state, phase: 'S', restTaken: 0 }
            });
        }

        return options;
    }

    // Fallback
    options.push({ out: STATES.VACIO, next: { ...state } });
    return options;
};

const solveS2S3 = (params, s1, s3Offset, totalDays) => {
    const coverageStart = getCoverageStartDayIndex(params);

    const s2Out = createEmptySchedule(totalDays);
    const s3Out = createEmptySchedule(totalDays);

    const initS2 = makeInitialState({ offsetDays: 0, hasInductionFirstCycle: true, inductionDays: params.induction });
    const initS3 = makeInitialState({ offsetDays: s3Offset, hasInductionFirstCycle: true, inductionDays: params.induction });

    const memoFail = new Set();

    const dfs = (dayIdx, s2State, s3State, maxPConsecutive) => {
        if (dayIdx >= totalDays) return true;

        const key = `${dayIdx}::${maxPConsecutive}::${stateKey(s2State)}::${stateKey(s3State)}`;
        if (memoFail.has(key)) return false;

        const s2Options = nextOptionsForSupervisor(s2State, params, maxPConsecutive);
        const s3Options = nextOptionsForSupervisor(s3State, params, maxPConsecutive);

        const s1Char = s1[dayIdx];

        for (const opt2 of s2Options) {
            for (const opt3 of s3Options) {
                const pCount =
                    (s1Char === STATES.PERFORACION ? 1 : 0) +
                    (opt2.out === STATES.PERFORACION ? 1 : 0) +
                    (opt3.out === STATES.PERFORACION ? 1 : 0);

                // Regla 2: nunca 3 perforando.
                if (pCount > 2) continue;

                // Regla 1: desde que ya es físicamente posible (fin de inducción), exactamente 2 perforando.
                if (dayIdx >= coverageStart && pCount !== 2) continue;

                // Extra: evitamos que haya "S" solapadas innecesarias (no es regla, pero reduce soluciones raras)
                // (no bloqueante)

                s2Out[dayIdx] = opt2.out;
                s3Out[dayIdx] = opt3.out;

                if (dfs(dayIdx + 1, opt2.next, opt3.next, maxPConsecutive)) return true;
            }
        }

        memoFail.add(key);
        return false;
    };

    // Búsqueda adaptativa: intenta imponer un máximo de P consecutivas creciente.
    // Esto evita soluciones de \"trabajar siempre\" pero mantiene factibilidad cuando se necesitan tramos largos.
    const minMaxP = Math.max(params.N, MIN_P_BLOCK);
    const maxTry = Math.min(totalDays, minMaxP + 120);

    for (let maxPConsecutive = minMaxP; maxPConsecutive <= maxTry; maxPConsecutive++) {
        // Reset memo por intento para evitar contaminación entre máximos distintos.
        memoFail.clear();
        const ok = dfs(0, initS2, initS3, maxPConsecutive);
        if (ok) return { s2: s2Out, s3: s3Out };
    }

    throw new Error('No se encontró un cronograma válido que cumpla las reglas (exactamente 2 perforando) con los parámetros actuales.');
};

export const generateSchedule = (params) => {
    assertValidParams(params);

    const { totalDays, N, induction } = params;

    // S1: fijo (no se modifica).
    const s1 = generateFixedPattern(0, params, totalDays);

    // S3: arranca para que su P inicie cuando S1 baja (modelo del PDF).
    const offsetS3 = N - induction;
    const baselineS3 = generateFixedPattern(offsetS3, params, totalDays);

    // Solver para ajustar S2 y S3 y cumplir reglas estrictas.
    const { s2, s3 } = solveS2S3(params, s1, offsetS3, totalDays);

    // Nota: baselineS3 se conserva solo como referencia de layout; la salida real es la del solver.
    // (Si quieres comparar visualmente, puedes alternarlo en UI.)
    void baselineS3;

    return { s1, s2, s3 };
};

export const validateSchedule = (schedule, totalDays, gracePeriod = 0) => {
    const errors = [];
    const { s1, s2, s3 } = schedule;

    const supervisors = [
        { name: 'S1', data: s1 },
        { name: 'S2', data: s2 },
        { name: 'S3', data: s3 }
    ];

    const isP = (v) => v === STATES.PERFORACION;

    // Validaciones de patrón por supervisor
    for (const sup of supervisors) {
        const arr = sup.data;

        for (let i = 1; i < totalDays; i++) {
            if (arr[i - 1] === STATES.SUBIDA && arr[i] === STATES.SUBIDA) {
                errors.push({ day: i + 1, msg: `${sup.name}: Error patrón (S-S consecutivo)` });
            }
            if (arr[i - 1] === STATES.SUBIDA && arr[i] === STATES.BAJADA) {
                errors.push({ day: i + 1, msg: `${sup.name}: Error patrón (S-B sin perforación)` });
            }
            if (arr[i - 1] === STATES.BAJADA && arr[i] === STATES.SUBIDA) {
                errors.push({ day: i + 1, msg: `${sup.name}: Error patrón (B-S sin descanso intermedio)` });
            }

            // P aislada de 1 día
            if (arr[i] === STATES.PERFORACION) {
                // Importante: si el cronograma está recortado, el último día puede quedar
                // como P sin que realmente sea "1 solo día". Solo validamos cuando existen
                // ambos vecinos dentro del horizonte.
                if (i - 1 >= 0 && i + 1 < totalDays) {
                    const prevIsP = isP(arr[i - 1]);
                    const nextIsP = isP(arr[i + 1]);
                    if (!prevIsP && !nextIsP) {
                        errors.push({ day: i + 1, msg: `${sup.name}: Error patrón (Perforación de 1 solo día)` });
                    }
                }
            }
        }
    }

    for (let i = gracePeriod; i < totalDays; i++) {
        const pCount =
            (isP(s1[i]) ? 1 : 0) +
            (isP(s2[i]) ? 1 : 0) +
            (isP(s3[i]) ? 1 : 0);

        if (pCount === 3) errors.push({ day: i + 1, msg: 'Error: 3 supervisores perforando (prohibido)' });
        if (pCount === 1) errors.push({ day: i + 1, msg: 'Error: Solo 1 supervisor perforando (prohibido)' });
        if (pCount === 0) errors.push({ day: i + 1, msg: 'Error: Sin cobertura de perforación' });
    }
    return errors;
};