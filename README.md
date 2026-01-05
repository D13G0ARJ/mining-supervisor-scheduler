# ⛏️ Mining Supervisor Scheduler

**[🇬🇧 Read in English](./README_EN.md)**

Aplicación web en **React** de alto rendimiento para la planificación y validación automática de turnos mineros. Diseñada para cumplir con reglas estrictas de continuidad operativa (Algoritmo N x M).

![Status](https://img.shields.io/badge/Status-Completed-success)
![Stack](https://img.shields.io/badge/Stack-React_Vite-blue)

## 🚀 Demo en Vivo
[Link a tu proyecto en Netlify aquí]

## 🧠 El Desafío
El sistema resuelve un problema de asignación de recursos con restricciones fuertes:
1.  **Regla de Oro:** Siempre debe haber **EXACTAMENTE 2** supervisores perforando.
2.  **Restricción:** Nunca 3 supervisores al mismo tiempo.
3.  **Dinámica:** Régimen variable ($N$ días trabajo x $M$ días descanso).

## 🛠️ Arquitectura de la Solución

El núcleo del proyecto (`src/logic/scheduler.js`) implementa una estrategia jerárquica de 3 niveles:

* **Nivel 1: S1 (El Ancla)** ⚓
    * Genera un ciclo inmutable basado en la configuración del usuario.
* **Nivel 2: S3 (El Relevo Matemático)** 📐
    * Calcula dinámicamente el *offset* exacto para iniciar su turno justo cuando S1 termina, garantizando continuidad sin huecos.
* **Nivel 3: S2 (El Agente Inteligente)** 🤖
    * Implementa un algoritmo reactivo con **"Lookahead"** (visión a futuro).
    * Escanea la grilla en busca de déficits de cobertura.
    * Tiene capacidad de **autocorrección**: si detecta que falta personal, sacrifica días de descanso para cubrir el turno, pero respeta un "Circuit Breaker" para abortar si su presencia causaría un exceso de personal (3 personas).

## 💻 Instalación y Uso

```bash
# 1. Clonar el repositorio
git clone [URL_DEL_REPO]

# 2. Instalar dependencias
npm install

# 3. Ejecutar entorno local
npm run dev
```

## 📊 Características Principales

* ✅ **Programación Inteligente**: Algoritmo reactivo con predicción de demanda futura
* ✅ **Validación en Tiempo Real**: Detección instantánea de violaciones de reglas
* ✅ **Exportación Profesional**: Imagen PNG y reporte PDF estructurado
* ✅ **UI Moderna**: Tema oscuro con encabezados fijos y animaciones suaves
* ✅ **Configuración Flexible**: Soporta cualquier régimen NxM con inducción personalizada

## 🏗️ Stack Tecnológico

* **Frontend**: React 18 + Vite
* **Estilos**: CSS Vanilla con Variables CSS
* **Exportación**: html2canvas + jsPDF
* **Validación**: Motor de reglas personalizado

## 📝 Licencia

MIT

---

**[🇬🇧 Read in English](./README_EN.md)**
