
export const STATES = {
    SUBIDA: 'S',
    INDUCCION: 'I',
    PERFORACION: 'P',
    BAJADA: 'B',
    DESCANSO: 'D',
    VACIO: '-' // For initialization
};



const createEmptySchedule = (days) => new Array(days).fill(STATES.VACIO);

/**
 * Generates the schedule for S1 (Fixed Anchor).
 * Pattern: S (1) -> I (induction) -> P (N - induction - 1) -> B (1) -> D (M - 1)
 * Note: N = Work days (including S, I, P). M = Rest days (including B, D).
 */
const calculateS1 = (params, totalDays) => {
    const { N, M, induction } = params;
    const schedule = createEmptySchedule(totalDays);
    const cycleLength = N + M;

    for (let i = 0; i < totalDays; i++) {
        const cycleDay = i % cycleLength;

        // Day 0: Subida
        if (cycleDay === 0) {
            schedule[i] = STATES.SUBIDA;
        }
        // Days 1..Induction: Induccion
        else if (cycleDay <= induction) {
            schedule[i] = STATES.INDUCCION;
        }
        // Days (Induction+1)..(N-1): Perforacion
        // Why N-1? Because S is 1 day. So Work period is 0..N-1 indexes.
        else if (cycleDay < N) {
            schedule[i] = STATES.PERFORACION;
        }
        // Day N: Bajada
        // M starts with Bajada (1 day).
        else if (cycleDay === N) {
            schedule[i] = STATES.BAJADA;
        }
        // Days (N+1)..(CycleLength-1): Descanso
        else {
            schedule[i] = STATES.DESCANSO;
        }
    }
    return schedule;
};

/**
 * Generates the schedule for S3 (Relief).
 * Strategy: Calculated mathematically to relieve S1.
 * S3 P Start = S1 P End + 1.
 * S3 Path to P: S -> I -> P.
 * So S3 Start = (S1 P End + 1) - Induction - 1 (S).
 */

/**
 * Helper to calculate demand for a specific role at a specific day.
 * Returns true if P is needed.
 */
const isPNeeded = (day, otherSchedules, requiredTotal = 2) => {
    let currentP = 0;
    otherSchedules.forEach(sched => {
        if (sched[day] === STATES.PERFORACION) currentP++;
    });
    return currentP < requiredTotal;
};

/**
 * Smart Scheduler Agent.
 * Attempts to place P blocks to satisfy 'isPNeeded'.
 * Respects: S (1) -> I (induction) -> P -> B (1) -> D.
 * Optimizes for:
 * 1. Coverage (Primary)
 * 2. Continuity (Avoid single day P)
 * 3. Rest (Try to take 'M' rest if possible, or min D=1).
 */
const runSmartAgent = (otherSchedules, params, totalDays, agentName) => {
    const { N, M, induction } = params;
    const schedule = createEmptySchedule(totalDays);

    // We iterate through time.
    // State tracking:
    // We generate a "Cycle" plan whenever we are free (D or Vacio).

    let i = 0;
    // Initialize with D? Or try to start valid?
    // If Day 0 needs P (Demand > 0), we must have started earlier.
    // We can simulate negative start, or just start S at 0.

    // Checking demand at day 0.
    if (isPNeeded(0, otherSchedules)) {
        // Urgent start.
        // S at 0.
        schedule[0] = STATES.SUBIDA;
        i = 1;
    }

    while (i < totalDays) {
        // Check if we are currently in a defined state (from previous block fill).
        if (schedule[i] !== STATES.VACIO) {
            i++;
            continue;
        }

        // We are Free (D). Decide what to do.
        // Scan ahead for next Demand.
        let nextDemandDay = -1;
        for (let k = i; k < totalDays; k++) {
            if (isPNeeded(k, otherSchedules)) {
                nextDemandDay = k;
                break;
            }
        }

        if (nextDemandDay !== -1) {
            // We define a target Start for P.
            // P must start by 'nextDemandDay' to cover it?
            // Yes.
            // P requires S + I before it.
            const preamble = 1 + induction; // Days for S + I

            // Start of S should be:
            let startS = nextDemandDay - preamble;

            // If startS < i, we are late!
            // We must verify if we CAN start.
            // If startS < i, we just start NOW at 'i' (S) and reach P late.
            // (Better late than never).
            if (startS < i) startS = i;

            // Fill D until startS
            for (let d = i; d < startS; d++) {
                schedule[d] = STATES.DESCANSO;
            }

            // Execute Cycle: S -> I .. -> P .. -> B
            let cursor = startS;

            // S
            if (cursor < totalDays) schedule[cursor] = STATES.SUBIDA;
            cursor++;

            // I
            for (let k = 0; k < induction; k++) {
                if (cursor < totalDays) schedule[cursor] = STATES.INDUCCION;
                cursor++;
            }

            // P
            // How long?
            // Strategy: Stay P as long as:
            // 1. Demand Exists OR
            // 2. We haven't exceeded a sane max (e.g. N*2 to prevent burnout)?
            // 3. We avoid 1-day P glitches (Hysteresis).

            // Minimum P to justify the trip?
            const minP = 1;
            let pCount = 0;

            while (cursor < totalDays) {
                const needed = isPNeeded(cursor, otherSchedules);

                // Hysteresis: If we just started P, stay at least minP.
                // Also, if we are covering a gap, and gap ends, check if new gap is close.
                // If gap is 1 day away, stay P?

                // Lookahead 2: Is P needed soon?
                // let neededSoon = isPNeeded(cursor+1) || isPNeeded(cursor+2);

                if (needed || pCount < minP) {
                    schedule[cursor] = STATES.PERFORACION;
                    cursor++;
                    pCount++;
                } else {
                    // No demand now.
                    // Should we stop?
                    // If we stop now, we go to B.
                    // Check if stopping creates a gap soon where we couldn't return in time?
                    // Time to return = 1(B) + D_min + 1(S) + I.
                    // If next demand is closer than Return Time, we MUST stay P.

                    // Min Turnaround = 1(B) + 1(D)? + 1(S) + I. = 3 + I.
                    // If next query is within (3+I) days, Stay P.

                    let futureDemand = -1;
                    for (let f = cursor + 1; f < cursor + (3 + induction + 5); f++) { // Lookahead window
                        if (f < totalDays && isPNeeded(f, otherSchedules)) {
                            futureDemand = f;
                            break;
                        }
                    }

                    if (futureDemand !== -1) {
                        // Demand coming soon. Stay P.
                        schedule[cursor] = STATES.PERFORACION;
                        cursor++;
                        pCount++;
                    } else {
                        // Safe to drop.
                        break;
                    }
                }
            }

            // B
            if (cursor < totalDays) schedule[cursor] = STATES.BAJADA;
            cursor++;

            // Update loop index
            i = cursor;

        } else {
            // No more demand forever.
            schedule[i] = STATES.DESCANSO;
            i++;
        }
    }

    // Fill remaining VACIO with D
    for (let k = 0; k < totalDays; k++) {
        if (schedule[k] === STATES.VACIO) schedule[k] = STATES.DESCANSO;
    }

    return schedule;
};



/**
 * Generates the schedule for S3 (Relief).
 * Strategy: Calculated mathematically to relieve S1.
 * S3 P Start = S1 P End + 1.
 * S3 Path to P: S -> I -> P.
 * So S3 Start = (S1 P End + 1) - Induction - 1 (S).
 */
const calculateS3 = (s1Schedule, params, totalDays) => {
    const { N, M, induction } = params;
    const schedule = createEmptySchedule(totalDays);

    // Find first End of P for S1
    let s1FirstPEnd = -1;
    for (let i = 0; i < totalDays; i++) {
        if (s1Schedule[i] === STATES.PERFORACION && s1Schedule[i + 1] !== STATES.PERFORACION) {
            s1FirstPEnd = i;
            break;
        }
    }

    // If S1 has no P (edge case), default to 0
    if (s1FirstPEnd === -1) s1FirstPEnd = N - 1;

    // Calculate Offset
    const daysBeforeP = 1 + induction;
    let offset = (s1FirstPEnd + 1) - daysBeforeP;

    const cycleLength = N + M;

    for (let i = 0; i < totalDays; i++) {
        let cycleDay = (i - offset) % cycleLength;
        if (cycleDay < 0) cycleDay += cycleLength;

        if (cycleDay === 0) schedule[i] = STATES.SUBIDA;
        else if (cycleDay <= induction) schedule[i] = STATES.INDUCCION;
        else if (cycleDay < N) schedule[i] = STATES.PERFORACION;
        else if (cycleDay === N) schedule[i] = STATES.BAJADA;
        else schedule[i] = STATES.DESCANSO;
    }

    return schedule;
};

export const generateSchedule = (params) => {
    const { totalDays } = params;

    const s1 = calculateS1(params, totalDays);

    // S3: Fixed Offset
    const s3 = calculateS3(s1, params, totalDays);

    // S2: Reactive Smart Agent coverage
    const s2 = runSmartAgent([s1, s3], params, totalDays, 'S2');

    return { s1, s2, s3 };
};

export const validateSchedule = (schedule, totalDays, gracePeriod = 0) => {
    const errors = [];
    const { s1, s2, s3 } = schedule;

    // Check global rules, skipping the grace period (startup ramp)
    for (let i = gracePeriod; i < totalDays; i++) {
        const pCount =
            (s1[i] === STATES.PERFORACION ? 1 : 0) +
            (s2[i] === STATES.PERFORACION ? 1 : 0) +
            (s3[i] === STATES.PERFORACION ? 1 : 0);

        if (pCount === 3) {
            errors.push({ day: i, msg: '3 Supervisores perforando' });
        }

        // Ignore startup ramp (first 10 days) for "Solo 1" error?
        // Or be strict. Casuistica says "S3 entra".
        if (pCount === 1) {
            errors.push({ day: i, msg: 'Solo 1 Supervisor perforando' });
        }
        if (pCount === 0) {
            errors.push({ day: i, msg: '0 Supervisores perforando' });
        }
    }
    return errors;
};
