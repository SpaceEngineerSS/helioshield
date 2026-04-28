# ☀️ HelioShield

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)
![Three.js](https://img.shields.io/badge/Three.js-WebGL-black.svg)
![Status](https://img.shields.io/badge/Status-Research_Grade-success.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

> **Lead Developer: Mehmet Gümüş** | [github.com/SpaceEngineerSS](https://github.com/SpaceEngineerSS)

**HelioShield** is a Real-time Solar Wind & Magnetohydrodynamic (MHD) Response Simulator. Designed as an operational "Digital Twin" of the Earth's magnetosphere, it ingests real-time telemetry from NOAA and NASA APIs to visualize heliospheric conditions, estimate geomagnetic response, and calculate terrestrial impacts.

🔗 **[Live Interactive Demo (Vercel)](https://helioshield.vercel.app)**

> **Disclaimer: All model outputs are Simulation Estimates for research and educational purposes. This is not an official forecast.** Official NOAA data is displayed separately as a reference baseline.

---

## 🌌 Core Features

- **Real-Time Telemetry** — Live monitoring of solar wind speed, plasma density, and IMF ($B_z$, $B_t$) parameters from DSCOVR/ACE via NOAA SWPC.
- **Geomagnetic Kp Estimation** — Computes magnetospheric energy transfer using the Newell coupling function, mapped to the Kp index via log-linear calibration.
- **Dynamic 3D Simulation** — A highly optimized, lazy-loaded Three.js WebGL scene visualizes the Sun-Earth L1 Lagrange point, solar wind particle flows, and Kp-reactive auroral halow.
- **CME Propagation (DBM)** — Calculates Coronal Mass Ejection (CME) transit times from the Sun to Earth using a Drag-Based Model integrated with a 4th-order Runge-Kutta (RK4) method.
- **Operational Resilience (Digital Twin)** — Deeply integrated with a `SimulationOrchestrator` that monitors rate limits and network drops. If APIs fail (e.g., HTTP 429), the system injects highly-accurate historical presets into the active cache, maintaining a seamless, uninterrupted simulation.
- **Magnetospheric Hysteresis** — Scientifically models the Earth's Ring Current recovery. When a severe geomagnetic storm subsides ($B_z > -5\text{nT}$), the simulation enters a 15-minute hysteresis period, reflecting the gradual dissipation of atmospheric ionization rather than instantly snapping back to normal.
- **Impact Assessment** — Real-time analytics on auroral boundaries, satellite drag risks, HF radio absorption, and Geomagnetically Induced Currents (GIC).

---

## 🚀 Quick Start

Ensure you have Node.js 18+ installed.

```bash
# Clone the repository
git clone https://github.com/SpaceEngineerSS/helioshield.git
cd helioshield

# Install dependencies
npm install

# Start the development server (http://localhost:5173)
npm run dev

# Build for production
npm run build
```

---

## 🏛️ System Architecture

HelioShield is designed as a fully client-side, zero-backend application to maximize portability and deployment simplicity. 

```text
src/
├── config/           # Constants, thresholds, data source URLs
├── domain/           # Zod-validated data models and TypeScript enums
├── lib/              # Core Mathematics (RK4, Hysteresis), time/units, caching
├── services/
│   ├── adapters/     # NOAA Solar Wind, Kp, GOES X-ray, NASA DONKI parsers
│   ├── orchestrator/ # SimulationOrchestrator for Hysteresis & Storm Protocols
│   └── data/         # DataAssimilationEngine for fallback injection
├── hooks/            # useSpaceWeather, useTimeSlicedData
└── components/
    ├── scene/        # 3D SunEarthScene, shaders (Aurora, Sun)
    └── panels/       # Dashboard UI elements
```

### 🛡️ Resilience & Simulation Fallback
If API rate limits are reached, the `DataAssimilationEngine` operates as a localized singleton cache. It intercepts the HTTP 403/429 errors and broadcasts a `simulation-mode` event. The UI (`App.tsx`) catches this and seamlessly transitions the state to load high-fidelity historical data presets (e.g., the May 2024 G4 storm). A subtle `HISTORICAL DATA - SIMULATION MODE` watermark appears, allowing the application to function continuously as a demonstrative tool.

---

## 📡 Data Sources

| Source | Endpoint | Data Provided |
|---|---|---|
| NOAA SWPC Plasma | `services.swpc.noaa.gov/.../plasma-7-day.json` | Solar wind speed, density, temperature |
| NOAA SWPC Mag | `services.swpc.noaa.gov/.../mag-7-day.json` | IMF $B_x$, $B_y$, $B_z$, $B_t$ |
| NOAA SWPC Kp | `services.swpc.noaa.gov/.../noaa-planetary-k-index.json` | Official measured Kp index |
| GOES X-ray | `services.swpc.noaa.gov/.../xrays-7-day.json` | X-ray flux for solar flare detection |
| NASA DONKI | `api.nasa.gov/DONKI/` | CME event tracking, flare associations |

> **Note:** The NASA API utilizes a `DEMO_KEY` by default which is subject to aggressive rate-limiting (30 requests/hour). Supply your own key via `VITE_NASA_API_KEY` in a `.env` file for production deployments.

---

## 🔬 Scientific Methodology

HelioShield utilizes multiple peer-reviewed physics models:

### 1. Kinematics: Drag-Based Model (DBM)
The transit of CMEs is calculated using the Drag-Based Model (Vršnak et al., 2013). The acceleration is defined as:
$$ a = -\gamma (v - w) |v - w| $$
The model uses a 4th-order Runge-Kutta (RK4) numerical integrator with an adaptive $10^{-6}$ tolerance for extreme precision.

### 2. Energy Transfer: Newell Coupling Function
The rate of magnetic flux opening at the magnetopause, driving geomagnetic storms, is quantified via the Newell Coupling Function (Newell et al., 2007):
$$ \frac{d\Phi}{dt} = v^{4/3} B_T^{2/3} \sin\left(\frac{\theta_c}{2}\right)^{8/3} $$

### 3. Magnetopause Deformation
The physical boundary of the Earth's magnetosphere is dynamically deformed using the procedural model from Shue et al., 1998:
$$ r = r_0 \left( \frac{2}{1 + \cos(\theta)} \right)^\alpha $$

### 4. Geomagnetically Induced Currents (GIC)
To estimate the surface electric field $\mathbf{E}$ driving GICs, the engine implements the plane-wave approximation method by Lehtinen and Pirjola (1985). The Fast Fourier Transform (FFT) necessary for this frequency-domain calculation is offloaded to a dedicated Web Worker (`GICWorker.ts`) to ensure the main UI thread remains completely unblocked at 60 FPS.

---

## 🤝 Contributing

We welcome contributions from researchers, software engineers, and physics enthusiasts! 
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'feat: Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
