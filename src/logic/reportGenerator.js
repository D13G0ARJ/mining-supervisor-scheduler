import { jsPDF } from "jspdf";

/**
 * Generates a professional PDF report.
 * @param {Object} params - The configuration params (N, M, etc.)
 * @param {Array} errors - List of validation errors
 * @param {string} gridImageBase64 - The base64 PNG of the schedule grid
 */
export const generatePDFReport = (params, errors, gridImageBase64) => {
    const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
    });

    // --- Header Banner ---
    doc.setFillColor(44, 62, 80); // Dark Slate Blue
    doc.rect(0, 0, 297, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE OPERATIVO DE SUPERVISORES", 15, 16);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const dateStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    doc.text(`Generado: ${dateStr}`, 280, 16, { align: "right" });

    // --- Configuration Box ---
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 249, 250); // Light Gray
    doc.rect(10, 32, 277, 18, 'FD'); // Fill and Draw

    doc.setTextColor(44, 62, 80);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("PARÁMETROS DEL RÉGIMEN", 15, 43);

    doc.setFont("helvetica", "normal");
    doc.text(`N (Trabajo): ${params.N}`, 80, 43);
    doc.text(`M (Descanso): ${params.M}`, 130, 43);
    doc.text(`Inducción: ${params.induction}`, 180, 43);
    doc.text(`Total Días: ${params.totalDays}`, 230, 43);

    // --- Status / Warnings Section ---
    let yPos = 65;

    if (errors && errors.length > 0) {
        // Error Box Title
        doc.setFillColor(220, 53, 69); // Red
        doc.rect(10, yPos - 6, 277, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(`DETECTADOS ${errors.length} CONFLICTOS OPERATIVOS`, 15, yPos - 1);

        yPos += 8;

        doc.setTextColor(60, 60, 60);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);

        const itemsPerCol = 6;
        const colWidth = 90;
        const maxErrors = itemsPerCol * 3;
        const displayErrors = errors.slice(0, maxErrors);

        displayErrors.forEach((err, idx) => {
            const col = Math.floor(idx / itemsPerCol);
            const row = idx % itemsPerCol;

            const x = 15 + (col * colWidth);
            const y = yPos + (row * 5);

            doc.text(`• Día ${err.day + 1}: ${err.msg}`, x, y);
        });

        yPos += (itemsPerCol * 5) + 5;

        if (errors.length > maxErrors) {
            doc.setFont("helvetica", "italic");
            doc.text(`(+${errors.length - maxErrors} conflictos adicionales omitidos por espacio)`, 15, yPos);
            yPos += 5;
        }
    } else {
        // Success Box
        doc.setFillColor(40, 167, 69); // Green
        doc.rect(10, yPos - 6, 277, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("VALIDACIÓN EXITOSA: SISTEMA OPTIMIZADO", 15, yPos - 1);
        yPos += 12;
    }

    // --- Schedule Grid Image ---
    yPos += 5;
    doc.setTextColor(44, 62, 80);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("VISUALIZACIÓN DEL CRONOGRAMA", 10, yPos);

    // Underline
    doc.setDrawColor(44, 62, 80);
    doc.line(10, yPos + 2, 80, yPos + 2);

    yPos += 8;

    if (gridImageBase64) {
        const imgProps = doc.getImageProperties(gridImageBase64);
        const pdfWidth = 277; // A4 width (297) - margins (20)
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        // Check if image fits on page, else add new page
        if (yPos + pdfHeight > 190) {
            doc.addPage();
            yPos = 20;
        }

        doc.addImage(gridImageBase64, 'PNG', 10, yPos, pdfWidth, pdfHeight);
    }

    // --- Footer ---
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount}`, 148, 200, { align: "center" });
    }

    doc.save(`reporte_supervisores_${params.N}x${params.M}.pdf`);
};
