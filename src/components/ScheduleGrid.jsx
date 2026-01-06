import React from 'react';
import { STATES } from '../logic/scheduler';

const getStateClass = (state) => {
    switch (state) {
        case STATES.SUBIDA: return 'var(--color-subida)';
        case STATES.INDUCCION: return 'var(--color-induccion)';
        case STATES.PERFORACION: return 'var(--color-perforacion)';
        case STATES.BAJADA: return 'var(--color-bajada)';
        case STATES.DESCANSO: return 'var(--color-descanso)';
        default: return 'var(--color-vacio)';
    }
};

const Cell = ({ state, label }) => {
    const bg = getStateClass(state);
    return (
        <div
            className="cell"
            style={{ backgroundColor: bg }}
            title={label}
        >
            {state}
        </div>
    );
};

export const ScheduleGrid = ({ schedule, gracePeriod = 0, strictStart = 0 }) => {
    // Use s1 to determine the schedule length
    const dayCount = schedule && schedule.s1 ? schedule.s1.length : 0;
    const days = Array.from({ length: dayCount }, (_, i) => i);

    const calculateP = (vals) => vals.filter(v => v === STATES.PERFORACION).length;

    if (!schedule) return null;

    return (
        <div className="grid-wrapper">
            {/* Header Row: 0, 1, 2... */}
            <div className="grid-row">
                <div className="row-header">Día</div>
                <div className="grid-cells">
                    {days.map(d => (
                        <div key={d} className="cell cell-header">{d}</div>
                    ))}
                </div>
            </div>

            {/* S1 */}
            <div className="grid-row">
                <div className="row-header">S1</div>
                <div className="grid-cells">
                    {schedule.s1.map((s, i) => <Cell key={`s1-${i}`} state={s} label={`Día ${i}: ${s}`} />)}
                </div>
            </div>

            {/* S2 */}
            <div className="grid-row">
                <div className="row-header">S2</div>
                <div className="grid-cells">
                    {schedule.s2.map((s, i) => <Cell key={`s2-${i}`} state={s} label={`Día ${i}: ${s}`} />)}
                </div>
            </div>

            {/* S3 */}
            <div className="grid-row">
                <div className="row-header">S3</div>
                <div className="grid-cells">
                    {schedule.s3.map((s, i) => <Cell key={`s3-${i}`} state={s} label={`Día ${i}: ${s}`} />)}
                </div>
            </div>

            {/* Drilling Count */}
            <div className="grid-row" style={{ marginTop: '10px' }}>
                <div className="row-header"># Perf.</div>
                <div className="grid-cells">
                    {days.map(i => {
                        const p = calculateP([schedule.s1[i], schedule.s2[i], schedule.s3[i]]);
                        void gracePeriod;
                        const isError = i >= strictStart && p !== 2;
                        return (
                            <div 
                                key={`p-${i}`} 
                                className={`cell cell-p-count ${isError ? 'error' : ''}`} 
                                title={`${p} perforando`}
                            >
                                {p}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};