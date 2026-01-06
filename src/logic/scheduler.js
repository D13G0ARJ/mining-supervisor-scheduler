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
    // Day when induction ends and drilling can physically begin.
    // In the PDF model: Day 0 = S (ascent), Day 1..induction = I, Day (1+induction) = first P.
    return 1 + params.induction;
};

// 0-based day index from which the PDF expects continuous "2 drilling" coverage.
// In Case 1 this matches when S1 enters B and S3 can start P: N + 1.
export const getTwoDrillersStartDayIndex = (params) => {
    return params.N + 1;
};

const assertValidParams = (params) => {
    const { N, M, induction, totalDays } = params;

    if (!Number.isInteger(N) || N < 1) throw new Error('N inválido');
    if (!Number.isInteger(M) || M < 3) throw new Error('M inválido: debe ser >= 3 (para incluir B + al menos 1 D + S)');
    if (!Number.isInteger(induction) || induction < 1 || induction > 5) throw new Error('Inducción inválida');
    if (!Number.isInteger(totalDays) || totalDays < 1) throw new Error('Total de días inválido');

    // In the PDF: N is the number of work days excluding the ascent day (S), i.e. N = I + P (in the first cycle).
    // Therefore we must have at least a small P block.
    const firstCyclePDays = N - induction;
    if (firstCyclePDays < 2) {
        throw new Error(`Configuración inválida: N (${N}) debe ser al menos inducción (${induction}) + 2 para tener >=2 días de perforación.`);
    }
};

/**
 * Generates a fixed pattern (used for S1 and as a baseline) following the PDF model:
 * - Cycle day 0: S
 * - Cycle days 1..N: work (first cycle: I up to induction, then P; next cycles: all P)
 * - Cycle day N+1: B
 * - Remaining cycle days: D (count = M-2)
 * Cycle length: N + M
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

const makeInitialState = ({ offsetDays, hasInductionFirstCycle, inductionDays, canReduceRest }) => {
    return {
        untilStart: offsetDays,
        phase: offsetDays > 0 ? 'PRE' : 'S',
        firstCycle: true,
        inductionLeft: hasInductionFirstCycle ? inductionDays : 0,
        pRun: 0,
        restTaken: 0,
        canReduceRest: !!canReduceRest
    };
};

const stateKey = (s) => {
    return [
        s.untilStart,
        s.phase,
        s.firstCycle ? 1 : 0,
        s.inductionLeft,
        s.pRun,
        s.restTaken,
        s.canReduceRest ? 1 : 0
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
        // Continue P (allowed while staying under the consecutive cap).
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

        // If we hit the maximum, force transition to B (no option to continue P).
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
        // The PDF favors "Reduce Rest" to close coverage gaps.
        // For S2/S3 we allow returning early (minimum 1 day of D to avoid direct B->S).
        // DFS still tries to rest more first ("Keep resting" option).
        const minDDays = state.canReduceRest ? 1 : Math.max(1, params.M - 2);

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
                next: {
                    ...state,
                    phase: 'S',
                    restTaken: 0
                }
            });
        }

        return options;
    }

    // Fallback
    options.push({ out: STATES.VACIO, next: { ...state } });
    return options;
};

const solveS2S3 = (params, s1, s3Offset, totalDays) => {
    const twoDrillersStart = getTwoDrillersStartDayIndex(params);

    // Deterministic segments (per PDF) to avoid visually "weird" solutions:
    // - S3 strictly respects its entry + initial induction.
    const baselineS2 = generateFixedPattern(0, params, totalDays);
    const baselineS3 = generateFixedPattern(s3Offset, params, totalDays);
    // PDF Case 1: S2 can adjust (work less) to synchronize; do not force S2 to the fixed baseline.
    const enforceS2Until = 0;
    const enforceS3Until = Math.max(0, s3Offset + 1 + params.induction); // S + I(1..induction)

    const s2Out = createEmptySchedule(totalDays);
    const s3Out = createEmptySchedule(totalDays);

    const initS2 = makeInitialState({
        offsetDays: 0,
        hasInductionFirstCycle: true,
        inductionDays: params.induction,
        canReduceRest: true
    });

    const initS3 = makeInitialState({
        offsetDays: s3Offset,
        hasInductionFirstCycle: true,
        inductionDays: params.induction,
        canReduceRest: true
    });

    const memoFail = new Set();

    const dfs = (dayIdx, s2State, s3State, maxPConsecutive) => {
        if (dayIdx >= totalDays) return true;

        const key = `${dayIdx}::${maxPConsecutive}::${stateKey(s2State)}::${stateKey(s3State)}`;
        if (memoFail.has(key)) return false;

        const s2Options = nextOptionsForSupervisor(s2State, params, maxPConsecutive);
        const s3Options = nextOptionsForSupervisor(s3State, params, maxPConsecutive);

        const forcedS2 = dayIdx < enforceS2Until ? baselineS2[dayIdx] : null;
        const forcedS3 = dayIdx < enforceS3Until ? baselineS3[dayIdx] : null;

        const filteredS2Options = forcedS2 ? s2Options.filter(o => o.out === forcedS2) : s2Options;
        const filteredS3Options = forcedS3 ? s3Options.filter(o => o.out === forcedS3) : s3Options;

        const s1Char = s1[dayIdx];

        for (const opt2 of filteredS2Options) {
            for (const opt3 of filteredS3Options) {
                const pCount =
                    (s1Char === STATES.PERFORACION ? 1 : 0) +
                    (opt2.out === STATES.PERFORACION ? 1 : 0) +
                    (opt3.out === STATES.PERFORACION ? 1 : 0);

                // Rule: never 3 drilling.
                if (pCount > 2) continue;

                // Rule (PDF): from N+1 onwards, keep exactly 2 drilling.
                if (dayIdx >= twoDrillersStart && pCount !== 2) continue;

                // Extra: avoid unnecessary overlapping "S" (not a rule, but reduces odd solutions)
                // (non-blocking)

                s2Out[dayIdx] = opt2.out;
                s3Out[dayIdx] = opt3.out;

                if (dfs(dayIdx + 1, opt2.next, opt3.next, maxPConsecutive)) return true;
            }
        }

        memoFail.add(key);
        return false;
    };

    // PDF: try without exceeding N; if no solution exists, fail explicitly.
    const maxPConsecutive = Math.max(params.N, MIN_P_BLOCK);
    memoFail.clear();
    const ok = dfs(0, initS2, initS3, maxPConsecutive);
    if (ok) return { s2: s2Out, s3: s3Out };

    throw new Error('No se encontró un cronograma válido que cumpla las reglas con el límite N y ajuste por descanso (sin extender trabajo).');
};

export const generateSchedule = (params) => {
    assertValidParams(params);

    const { totalDays, N, induction } = params;

    // S1: fixed (never modified).
    const s1 = generateFixedPattern(0, params, totalDays);

    // S3: starts so that its P begins when S1 descends (PDF model).
    const offsetS3 = N - induction;
    const baselineS3 = generateFixedPattern(offsetS3, params, totalDays);

    // Solver adjusts S2 and S3 to satisfy strict rules.
    const { s2, s3 } = solveS2S3(params, s1, offsetS3, totalDays);

    // Note: baselineS3 is kept only as a layout/reference; the actual output is the solver result.
    // (If you want to compare visually, you can toggle it in the UI.)
    void baselineS3;

    return { s1, s2, s3 };
};

// Baseline schedule (no solver): useful as a fallback to visualize an unsolved case.
// S1 and S2 follow the fixed pattern from day 0; S3 uses the PDF standard offset.
export const generateBaselineSchedule = (params) => {
    assertValidParams(params);

    const { totalDays, N, induction } = params;
    const s1 = generateFixedPattern(0, params, totalDays);
    const s2 = generateFixedPattern(0, params, totalDays);
    const offsetS3 = N - induction;
    const s3 = generateFixedPattern(offsetS3, params, totalDays);
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

    // Per-supervisor pattern validations
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

            // Single-day P (isolated)
            if (arr[i] === STATES.PERFORACION) {
                // Important: if the schedule is cropped, the last day might be P without
                // actually being a "single-day" drilling block. Only validate when both
                // neighbors exist within the horizon.
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

    for (let i = 0; i < totalDays; i++) {
        const pCount =
            (isP(s1[i]) ? 1 : 0) +
            (isP(s2[i]) ? 1 : 0) +
            (isP(s3[i]) ? 1 : 0);

        if (pCount === 3) errors.push({ day: i + 1, msg: 'Error: 3 supervisores perforando (prohibido)' });
        if (i >= gracePeriod) {
            if (pCount === 1) errors.push({ day: i + 1, msg: 'Error: Solo 1 supervisor perforando (prohibido)' });
            if (pCount === 0) errors.push({ day: i + 1, msg: 'Error: Sin cobertura de perforación' });
        }
    }
    return errors;
};

export const generateScheduleForRequiredDrillDays = (params) => {
    const { requiredDrillDays } = params;
    if (!Number.isInteger(requiredDrillDays) || requiredDrillDays < 1) {
        throw new Error('Días de perforación requeridos inválidos');
    }

    const gracePeriod = getCoverageStartDayIndex(params);

    const findCutIndex = (sch, totalDays, required) => {
        let covered = 0;
        for (let i = gracePeriod; i < totalDays; i++) {
            const pCount =
                (sch.s1[i] === STATES.PERFORACION ? 1 : 0) +
                (sch.s2[i] === STATES.PERFORACION ? 1 : 0) +
                (sch.s3[i] === STATES.PERFORACION ? 1 : 0);

            if (pCount === 2) {
                covered++;
                if (covered >= required) return i;
            }
        }
        return null;
    };

    const baseBuffer = (params.N + params.M) * 6 + 30;
    let simulationDays = requiredDrillDays + gracePeriod + baseBuffer;
    let lastError = null;

    for (let attempt = 0; attempt < 3; attempt++) {
        const scheduleParams = { ...params, totalDays: simulationDays };
        const result = generateSchedule(scheduleParams);
        const cutIdx = findCutIndex(result, simulationDays, requiredDrillDays);

        if (cutIdx === null) {
            simulationDays = Math.floor(simulationDays * 1.5);
            lastError = new Error('No se alcanzó el total de días de perforación requeridos dentro del horizonte de simulación.');
            continue;
        }

        const finalDays = cutIdx + 1;
        const finalSchedule = {
            s1: result.s1.slice(0, finalDays),
            s2: result.s2.slice(0, finalDays),
            s3: result.s3.slice(0, finalDays)
        };

        return { schedule: finalSchedule, gracePeriod, totalDays: finalDays };
    }

    throw lastError || new Error('No se pudo generar el cronograma dentro de los límites de simulación.');
};