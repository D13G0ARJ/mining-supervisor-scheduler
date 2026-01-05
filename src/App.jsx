import React, { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
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

  const handleExport = async () => {
    // Target the outer card which contains both the scroll area and the legend
    const originalCard = document.querySelector('.results-card');
    if (!originalCard) return;

    // Clone the entire card
    const clone = originalCard.cloneNode(true);

    // Find the scroll area inside the clone
    const scrollArea = clone.querySelector('.grid-scroll-area');

    // Get the real scroll width from the original element
    const originalScrollArea = originalCard.querySelector('.grid-scroll-area');
    const totalWidth = originalScrollArea.scrollWidth;

    // Force the clone to be wide enough to show everything
    clone.style.position = 'absolute';
    clone.style.top = '-9999px';
    clone.style.left = '-9999px';
    // The card itself should expand to fit the scroll area's content
    clone.style.width = `${totalWidth + 40}px`; // Add padding buffer
    clone.style.height = 'auto';
    clone.style.overflow = 'visible';

    // Force the scroll area to be fully expanded (no scroll)
    scrollArea.style.overflow = 'visible';
    scrollArea.style.width = '100%';

    // Fix sticky headers in the clone
    const headers = clone.querySelectorAll('.row-header');
    headers.forEach(header => {
      header.style.position = 'static';
      header.style.left = 'auto';
      header.style.transform = 'none';
      header.style.boxShadow = 'none'; // Optional: remove shadow in flat export if desired, or keep it.
    });

    document.body.appendChild(clone);

    try {
      const canvas = await html2canvas(clone, {
        backgroundColor: '#1e1e1e',
        scale: 2,
        width: totalWidth + 40, // Capture full width
        height: clone.offsetHeight,
        windowWidth: totalWidth + 40,
        scrollX: 0,
        scrollY: 0
      });

      const link = document.createElement('a');
      link.download = `supervisores_${params.N}x${params.M}.png`;
      link.href = canvas.toDataURL();
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
      alert("Error al exportar la imagen.");
    } finally {
      document.body.removeChild(clone); // Cleanup
    }
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
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <button className="btn-primary" onClick={handleCompute}>
              Calcular Cronograma
            </button>
          </div>
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
        <div className="results-card">
          <div className="grid-scroll-area">
            <ScheduleGrid schedule={schedule} totalDays={params.totalDays} />
          </div>

          <div className="legend">
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-subida)' }}></div>Subida</div>
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-induccion)' }}></div>Inducción</div>
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-perforacion)' }}></div>Perforación</div>
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-bajada)' }}></div>Bajada</div>
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-descanso)' }}></div>Descanso</div>

            <button className="btn-secondary" onClick={handleExport} style={{ marginLeft: 'auto' }}>
              📸 Descargar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
