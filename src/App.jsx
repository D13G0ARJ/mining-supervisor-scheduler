import React, { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { generatePDFReport } from './logic/reportGenerator';
import { generateSchedule, generateBaselineSchedule, validateSchedule, getCoverageStartDayIndex, getTwoDrillersStartDayIndex } from './logic/scheduler';
import { ScheduleGrid } from './components/ScheduleGrid';
import './App.css';

const MAX_EXPORT_DAYS = 90;

function App() {
  const [params, setParams] = useState({
    N: 14,
    M: 7,
    induction: 5,
    totalDays: 30
  });

  const [schedule, setSchedule] = useState(null);
  const [errors, setErrors] = useState([]);

  const gracePeriod = getCoverageStartDayIndex(params);
  const twoDrillersStart = getTwoDrillersStartDayIndex(params);
  const isScheduleTooLongToExport = params.totalDays > MAX_EXPORT_DAYS;

  const handleCompute = () => {
    // PDF model: N = work days excluding ascent day (S). First cycle drilling is N - induction.
    if (params.N <= params.induction + 1) {
      alert(`Error de Configuración: N (${params.N}) debe ser al menos Inducción (${params.induction}) + 2 para tener >=2 días de perforación.`);
      return;
    }

    try {
      const scheduleParams = {
        N: params.N,
        M: params.M,
        induction: params.induction,
        totalDays: params.totalDays
      };

      const finalSchedule = generateSchedule(scheduleParams);
      setSchedule(finalSchedule);

      const errs = validateSchedule(finalSchedule, params.totalDays, twoDrillersStart);
      setErrors(errs);
    } catch (e) {
      console.error(e);
      const message = e?.message || 'No se pudo generar un cronograma válido con esos parámetros.';
      alert(message);

      // Fallback: still render a baseline schedule + warnings for inspection.
      try {
        const fallbackSchedule = generateBaselineSchedule({
          N: params.N,
          M: params.M,
          induction: params.induction,
          totalDays: params.totalDays
        });
        setSchedule(fallbackSchedule);

        const fallbackErrors = validateSchedule(fallbackSchedule, params.totalDays, twoDrillersStart);
        setErrors([{ day: 1, msg: `Advertencia: ${message}` }, ...fallbackErrors]);
      } catch (fallbackErr) {
        // If even the baseline can't be generated (invalid params), clear the view.
        console.error(fallbackErr);
        setSchedule(null);
        setErrors([{ day: 1, msg: `Error: ${message}` }]);
      }
    }
  };

  // Helper to capture grid image
  const captureGrid = async () => {
    // Target the outer card which contains both the scroll area and the legend
    const originalCard = document.querySelector('.results-card');
    if (!originalCard) return null;

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
      return canvas.toDataURL();
    } catch (err) {
      console.error("Capture failed:", err);
      return null;
    } finally {
      document.body.removeChild(clone);
    }
  };

  const handleExport = async () => {
    if (!schedule) return;
    if (isScheduleTooLongToExport) {
      alert(`No se puede descargar la imagen: el cronograma es de ${params.totalDays} días (máximo permitido: ${MAX_EXPORT_DAYS}).`);
      return;
    }
    const dataUrl = await captureGrid();
    if (!dataUrl) {
      alert("Error al exportar la imagen.");
      return;
    }

    const link = document.createElement('a');
    link.download = `supervisores_${params.N}x${params.M}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handlePDFExport = async () => {
    if (!schedule) return;
    if (isScheduleTooLongToExport) {
      alert(`No se puede descargar el PDF: el cronograma es de ${params.totalDays} días (máximo permitido: ${MAX_EXPORT_DAYS}).`);
      return;
    }
    const dataUrl = await captureGrid();
    if (!dataUrl) {
      alert("Error generando la imagen para el reporte.");
      return;
    }
    const pdfParams = {
      N: params.N,
      M: params.M,
      induction: params.induction,
      totalDays: schedule?.s1?.length ?? 0
    };
    generatePDFReport(pdfParams, errors, dataUrl);
  };

  useEffect(() => {
    handleCompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              min="1"
              value={params.totalDays}
              onChange={e => setParams({ ...params, totalDays: parseInt(e.target.value) })}
            />
            <div className="form-hint">
              La grilla muestra exactamente <strong>{params.totalDays}</strong> días, desde el índice <strong>0</strong> al <strong>{Math.max(0, params.totalDays - 1)}</strong>.
            </div>
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={handleCompute}>
              Calcular Cronograma
            </button>
          </div>
        </div>
      </div>

      {schedule && (
        <div className="warning-panel">
          <span style={{ fontSize: '1.2rem', marginTop: '-2px' }}>ℹ️</span>
          <div>
            <strong>Periodo de Gracia Activo:</strong> Durante los primeros <strong>{getCoverageStartDayIndex(params)} días</strong> (Subida + Inducción) es esperable no tener 2 perforando.
            <br />
            La regla de “2 perforando” se evalúa desde el día <strong>{getTwoDrillersStartDayIndex(params)}</strong> (según el PDF).
          </div>
        </div>
      )}

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
            <ScheduleGrid schedule={schedule} totalDays={schedule.s1.length} gracePeriod={gracePeriod} strictStart={twoDrillersStart} />
          </div>

          <div className="legend">
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-subida)' }}></div>Subida</div>
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-induccion)' }}></div>Inducción</div>
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-perforacion)' }}></div>Perforación</div>
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-bajada)' }}></div>Bajada</div>
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-descanso)' }}></div>Descanso</div>

            <div style={{ marginLeft: 'auto', marginRight: '10px', opacity: 0.9 }}>
              Total días mostrados: <strong>{schedule.s1.length}</strong> (incluye {getCoverageStartDayIndex(params)} de gracia)
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" onClick={handlePDFExport}>
                📄 Reporte PDF
              </button>
              <button className="btn-secondary" onClick={handleExport}>
                📸 Imagen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
