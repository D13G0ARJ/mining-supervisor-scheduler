# ⛏️ Mining Supervisor Scheduler

**[🇬🇧 Read in English](./README_EN.md)**

Aplicación web en **React** de alto rendimiento para la planificación y validación automática de turnos mineros. Diseñada para cumplir con reglas estrictas de continuidad operativa (Algoritmo N x M).

![Status](https://img.shields.io/badge/Status-Completed-success)
![Stack](https://img.shields.io/badge/Stack-React_Vite-blue)

## 🚀 Demo en Vivo
[Link a tu proyecto en Netlify aquí]

## 🧠 El Desafío
El sistema resuelve un problema de asignación de recursos con restricciones fuertes:
1.  **Regla de Oro (según PDF):** Desde el día **N+1** (índice 0-based) debe haber **EXACTAMENTE 2** supervisores perforando.
2.  **Restricción:** Nunca 3 supervisores al mismo tiempo.
3.  **Dinámica:** Régimen variable ($N$ días trabajo x $M$ días descanso).

Nota: Antes del día **N+1** puede haber días con 0 o 1 perforando por inducción/solape de turnos (esto se muestra como advertencia, no como incumplimiento de la regla estricta).

## 📌 Definición de Parámetros (según documento)

El cronograma se construye con el ciclo de estados:

- `S` = Subida (siempre 1 día)
- `I1..In` = Inducción (configurable 1 a 5 días)
- `D1..Dn` = Perforación (días efectivos requeridos)
- `B` = Bajada (siempre 1 día)
- `DESC1..` = Descanso

Para los inputs del régimen **NxM** en esta implementación:

- **N (Trabajo)**: número de días de trabajo **después de la subida**. En el primer ciclo se compone de `I + P`.
    - Ejemplo: si `N=14` e `inducción=5`, el primer ciclo tiene `5` días de inducción y `9` días de perforación.
- **M (Descanso total)**: tamaño del bloque no-productivo que separa ciclos y que, según el documento, se interpreta como:
    - `B` (1 día) + `DESC` (días) + `S` (1 día del siguiente ciclo)
    - Por eso el **descanso real** queda: `DESC = M - 2`.

Nota: Esta definición es la que hace que los cálculos de las casuísticas del documento (por ejemplo “S1 baja día = 1 + N”) coincidan.

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

### Casos sin solución

Para ciertos parámetros (por ejemplo `N=3, M=3, inducción=1`) puede no existir un cronograma válido bajo las reglas.
En ese caso, la aplicación igual renderiza un **cronograma base** (patrones fijos) y muestra las advertencias correspondientes para facilitar el análisis.

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
