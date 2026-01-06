import React, { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { generatePDFReport } from './logic/reportGenerator';
import { generateSchedule, validateSchedule, getCoverageStartDayIndex } from './logic/scheduler';
import { ScheduleGrid } from './components/ScheduleGrid';
import './App.css';

function App() {
  const [params, setParams] = useState({
    N: 14,
    M: 7,
    induction: 5,
    requiredDrillDays: 90
  });

  const [schedule, setSchedule] = useState(null);
  const [errors, setErrors] = useState([]);

  const handleCompute = () => {
    // PDF model: N = días de trabajo excluyendo subida (S). Primer ciclo perfora: N - induction.
    if (params.N <= params.induction + 1) {
      alert(`Error de Configuración: N (${params.N}) debe ser al menos Inducción (${params.induction}) + 2 para tener >=2 días de perforación.`);
      return;
    }

    try {
      const gracePeriod = getCoverageStartDayIndex(params);

      const findCutIndex = (sch, totalDays, required) => {
        let covered = 0;
        for (let i = gracePeriod; i < totalDays; i++) {
          const pCount =
            (sch.s1[i] === 'P' ? 1 : 0) +
            (sch.s2[i] === 'P' ? 1 : 0) +
            (sch.s3[i] === 'P' ? 1 : 0);
          if (pCount === 2) {
            covered++;
            if (covered >= required) return i;
          }
        }
        return null;
      };

      const baseBuffer = (params.N + params.M) * 6 + 30;
      let simulationDays = params.requiredDrillDays + gracePeriod + baseBuffer;
      let lastError = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        const scheduleParams = { ...params, totalDays: simulationDays };
        const result = generateSchedule(scheduleParams);
        const cutIdx = findCutIndex(result, simulationDays, params.requiredDrillDays);

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

        setSchedule(finalSchedule);
        const errs = validateSchedule(finalSchedule, finalDays, gracePeriod);
        setErrors(errs);
        return;
      }

      throw lastError || new Error('No se pudo generar el cronograma dentro de los límites de simulación.');
    } catch (e) {
      console.error(e);
      alert(e?.message || 'No se pudo generar un cronograma válido con esos parámetros.');
      setSchedule(null);
      setErrors([]);
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
    const dataUrl = await captureGrid();
    if (!dataUrl) {
      alert("Error generando la imagen para el reporte.");
      return;
    }
    const pdfParams = {
      N: params.N,
      M: params.M,
      induction: params.induction,
      requiredDrillDays: params.requiredDrillDays,
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
            <label>Días de Perforación Requeridos</label>
            <input
              className="form-input"
              type="number"
              min="1"
              value={params.requiredDrillDays}
              onChange={e => setParams({ ...params, requiredDrillDays: parseInt(e.target.value) })}
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
            <button className="btn-primary" onClick={handleCompute}>
              Calcular Cronograma
            </button>
          </div>
        </div>
      </div>

      {/* 1. NEW YELLOW WARNING (Insert here) */}
      {schedule && (
        <div className="warning-panel">
          <span style={{ fontSize: '1.2rem', marginTop: '-2px' }}>ℹ️</span>
          <div>
            <strong>Periodo de Gracia Activo:</strong> Los indicadores rojos en la grilla durante los primeros <strong>{getCoverageStartDayIndex(params)} días</strong> son esperados.
            <br />
            Se deben a la fase inicial de <em>Subida + Inducción</em> donde es físicamente imposible tener cobertura completa.
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
            <ScheduleGrid schedule={schedule} totalDays={schedule.s1.length} />
          </div>

          <div className="legend">
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-subida)' }}></div>Subida</div>
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-induccion)' }}></div>Inducción</div>
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-perforacion)' }}></div>Perforación</div>
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-bajada)' }}></div>Bajada</div>
            <div className="legend-item"><div className="legend-dot" style={{ backgroundColor: 'var(--color-descanso)' }}></div>Descanso</div>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
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
