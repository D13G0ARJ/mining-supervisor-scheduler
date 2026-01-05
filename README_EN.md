# ⛏️ Mining Supervisor Scheduler

**[🇪🇸 Leer en Español](./README.md)**

High-performance **React** web application for automated planning and validation of mining shifts. Designed to comply with strict operational continuity rules (N x M Algorithm).

![Status](https://img.shields.io/badge/Status-Completed-success)
![Stack](https://img.shields.io/badge/Stack-React_Vite-blue)

## 🚀 Live Demo
[Link to your Netlify project here]

## 🧠 The Challenge
The system solves a resource allocation problem with strong constraints:
1.  **Golden Rule:** There must **ALWAYS** be **EXACTLY 2** supervisors drilling.
2.  **Constraint:** Never 3 supervisors at the same time.
3.  **Dynamic:** Variable regime ($N$ work days x $M$ rest days).

## 🛠️ Solution Architecture

The project core (`src/logic/scheduler.js`) implements a 3-level hierarchical strategy:

* **Level 1: S1 (The Anchor)** ⚓
    * Generates an immutable cycle based on user configuration.
* **Level 2: S3 (The Mathematical Relief)** 📐
    * Dynamically calculates the exact *offset* to start its shift right when S1 finishes, guaranteeing continuity without gaps.
* **Level 3: S2 (The Intelligent Agent)** 🤖
    * Implements a reactive algorithm with **"Lookahead"** (future vision).
    * Scans the grid looking for coverage deficits.
    * Has **self-correction** capability: if it detects missing personnel, it sacrifices rest days to cover the shift, but respects a "Circuit Breaker" to abort if its presence would cause personnel excess (3 people).

## 💻 Installation and Usage

```bash
# 1. Clone the repository
git clone [REPO_URL]

# 2. Install dependencies
npm install

# 3. Run local environment
npm run dev
```

## 📊 Key Features

* ✅ **Intelligent Scheduling**: Reactive algorithm with future demand prediction
* ✅ **Real-time Validation**: Instant detection of rule violations
* ✅ **Professional Export**: PNG image and structured PDF report
* ✅ **Modern UI**: Dark theme with sticky headers and smooth animations
* ✅ **Flexible Configuration**: Supports any NxM regime with custom induction

## 🏗️ Tech Stack

* **Frontend**: React 18 + Vite
* **Styling**: Vanilla CSS with CSS Variables
* **Export**: html2canvas + jsPDF
* **Validation**: Custom rule engine

## 📝 License

MIT

---

**[🇪🇸 Leer en Español](./README.md)**
