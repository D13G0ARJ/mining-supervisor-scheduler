import React, { useState, useEffect } from 'react';
import { generateSchedule, validateSchedule, STATES } from './logic/scheduler';
import { ScheduleGrid } from './components/ScheduleGrid';
import './App.css';

function App() {
  const [params, setParams] = useState({
    N: 14,
    M: 7,
    induction: 5,
    totalDays: 45
  });

  const [schedule, setSchedule] = useState(null);
  const [errors, setErrors] = useState([]);

  const handleCompute = () => {
    // Validation: N must allow at least 1 day of P (N > S + I => N > 1 + I)
    if (params.N <= params.induction + 1) {
      alert(`Error de Configuración: El tiempo de trabajo (N=${params.N}) es muy corto para la Inducción (${params.induction}). S1 no tendría días de perforación.`);
      return;
    }

    const result = generateSchedule(params);
    setSchedule(result);
    // Ignore startup ramp (Grace Period = N days) to avoid initial "0 drilling" alerts
    const gracePeriod = params.N;
    const errs = validateSchedule(result, params.totalDays, gracePeriod);
    setErrors(errs);
  };

  useEffect(() => {
    handleCompute();
  }, []);

  return (
    <div className="app-container">
      <header className="header">
        <h1>Cronograma de Supervisores</h1>
      </header>

      <div className="config-card">
        <h2 className="config-title">Configuración del Régimen</h2>
        <div className="form-row">
          <div className="form-group">
            <label>Días Trabajo (N)</label>
            <input
              className="form-input"
              type="number"
              min="1"
              value={params.N}
              onChange={e => setParams({ ...params, N: parseInt(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label>Días Descanso (M)</label>
            <input
              className="form-input"
              type="number"
              min="1"
              value={params.M}
              onChange={e => setParams({ ...params, M: parseInt(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label>Días Inducción</label>
            <input
              className="form-input"
              type="number"
              min="1"
              max="5"
              value={params.induction}
              onChange={e => setParams({ ...params, induction: parseInt(e.target.value) })}
            />
          </div>
          <div className="form-group">
            <label>Total Días</label>
            <input
              className="form-input"
              type="number"
              min="15"
              value={params.totalDays}
              onChange={e => setParams({ ...params, totalDays: parseInt(e.target.value) })}
            />
          </div>
          <button className="btn-primary" onClick={handleCompute}>
            Calcular Cronograma
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="alerts-panel">
          <h3 className="alerts-header">
            <span>⚠</span> Alertas Detectadas ({errors.length})
          </h3>
          <ul className="alerts-list">
            {errors.map((e, idx) => (
              <li key={idx} className="alert-item">
                <span className="alert-badge">Día {e.day}</span>
                {e.msg}
              </li>
            ))}
          </ul>
        </div>
      )}

      {schedule && (
        <div className="grid-container">
          <ScheduleGrid schedule={schedule} totalDays={params.totalDays} />

          <div className="legend">
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-subida)' }}></div>Subida</div>
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-induccion)' }}></div>Inducción</div>
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-perforacion)' }}></div>Perforación</div>
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-bajada)' }}></div>Bajada</div>
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-descanso)' }}></div>Descanso</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
