import { jsPDF } from "jspdf";

/**
 * Generates a professional PDF report with multi-page support for large schedules.
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

    const pageWidth = 297;
    const pageHeight = 210;
    const margin = 10;
    const contentWidth = pageWidth - (margin * 2);

    // --- Page 1: Header & Configuration ---

    // Header Banner
    doc.setFillColor(44, 62, 80);
    doc.rect(0, 0, pageWidth, 24, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("REPORTE OPERATIVO DE SUPERVISORES", 15, 16);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const dateStr = new Date().toLocaleDateString('es-ES', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    doc.text(`Generado: ${dateStr}`, pageWidth - 15, 16, { align: "right" });

    // Configuration Box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(248, 249, 250);
    doc.rect(margin, 32, contentWidth, 18, 'FD');

    doc.setTextColor(44, 62, 80);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("PARÁMETROS DEL RÉGIMEN", 15, 43);

    doc.setFont("helvetica", "normal");
    doc.text(`N (Trabajo): ${params.N}`, 80, 43);
    doc.text(`M (Descanso): ${params.M}`, 130, 43);
    doc.text(`Inducción: ${params.induction}`, 180, 43);
    doc.text(`Total Días: ${params.totalDays}`, 230, 43);

    let yPos = 65;

    // --- Errors Section (Multi-page if needed) ---
    if (errors && errors.length > 0) {
        // Error Box Title
        doc.setFillColor(220, 53, 69);
        doc.rect(margin, yPos - 6, contentWidth, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(`DETECTADOS ${errors.length} CONFLICTOS OPERATIVOS`, 15, yPos - 1);

        yPos += 8;

        doc.setTextColor(60, 60, 60);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);

        // Pagination settings
        const itemsPerCol = 6;
        const colWidth = 90;
        const itemsPerPage = itemsPerCol * 3; // 3 columns per page
        const lineHeight = 5;

        let errorIndex = 0;

        while (errorIndex < errors.length) {
            const pageErrors = errors.slice(errorIndex, errorIndex + itemsPerPage);

            pageErrors.forEach((err, idx) => {
                const col = Math.floor(idx / itemsPerCol);
                const row = idx % itemsPerCol;

                const x = 15 + (col * colWidth);
                const y = yPos + (row * lineHeight);

                doc.text(`• Día ${err.day}: ${err.msg}`, x, y);
            });

            errorIndex += itemsPerPage;

            // If more errors remain, add new page
            if (errorIndex < errors.length) {
                doc.addPage();
                yPos = 30; // Reset Y position for new page

                // Add continuation header
                doc.setFillColor(220, 53, 69);
                doc.rect(margin, yPos - 6, contentWidth, 8, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.text(`CONFLICTOS OPERATIVOS (Continuación - ${errorIndex + 1} a ${Math.min(errorIndex + itemsPerPage, errors.length)})`, 15, yPos - 1);

                yPos += 8;
                doc.setTextColor(60, 60, 60);
                doc.setFont("helvetica", "normal");
                doc.setFontSize(8);
            } else {
                yPos += (Math.ceil(pageErrors.length / 3) * lineHeight) + 5;
            }
        }
    } else {
        // Success Box
        doc.setFillColor(40, 167, 69);
        doc.rect(margin, yPos - 6, contentWidth, 8, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("VALIDACIÓN EXITOSA: SISTEMA OPTIMIZADO", 15, yPos - 1);
        yPos += 12;
    }

    // --- Schedule Grid Image (Multi-page if needed) ---
    yPos += 10;

    // Check if we need a new page for the schedule
    if (yPos > 100) {
        doc.addPage();
        yPos = 30;
    }

    doc.setTextColor(44, 62, 80);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("VISUALIZACIÓN DEL CRONOGRAMA", margin, yPos);

    doc.setDrawColor(44, 62, 80);
    doc.line(margin, yPos + 2, 80, yPos + 2);

    yPos += 8;

    if (gridImageBase64) {
        const imgProps = doc.getImageProperties(gridImageBase64);

        // If schedule is too large (more than 100 days), show note instead of image
        if (params.totalDays > 100) {
            doc.setFillColor(255, 243, 205); // Light yellow
            doc.rect(margin, yPos, contentWidth, 30, 'F');
            doc.setDrawColor(255, 193, 7);
            doc.rect(margin, yPos, contentWidth, 30, 'S');

            doc.setTextColor(133, 100, 4);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.text("ℹ️ CRONOGRAMA EXTENSO", margin + 5, yPos + 8);

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.text(`El cronograma de ${params.totalDays} días es demasiado extenso para visualizarse en el PDF.`, margin + 5, yPos + 16);
            doc.text("Por favor, utilice una de las siguientes opciones:", margin + 5, yPos + 22);
            doc.text("• Exportar como imagen PNG desde la aplicación web (botón 📸 Imagen)", margin + 5, yPos + 28);

        } else {
            // For smaller schedules, include the image
            const maxImgWidth = contentWidth;
            const scaledHeight = (imgProps.height * maxImgWidth) / imgProps.width;

            // Check if image fits on current page
            const maxHeightPerPage = pageHeight - yPos - 20;

            if (scaledHeight <= maxHeightPerPage) {
                // Fits on one page
                doc.addImage(gridImageBase64, 'PNG', margin, yPos, maxImgWidth, scaledHeight);
            } else {
                // Add new page for image
                doc.addPage();
                yPos = 30;

                doc.setTextColor(44, 62, 80);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(11);
                doc.text("CRONOGRAMA (Continuación)", margin, yPos);
                yPos += 8;

                const newMaxHeight = pageHeight - yPos - 20;
                const finalHeight = Math.min(scaledHeight, newMaxHeight);

                doc.addImage(gridImageBase64, 'PNG', margin, yPos, maxImgWidth, finalHeight);
            }
        }
    }

    // --- Footer with Page Numbers ---
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    }

    doc.save(`reporte_supervisores_${params.N}x${params.M}_${params.totalDays}dias.pdf`);
};
