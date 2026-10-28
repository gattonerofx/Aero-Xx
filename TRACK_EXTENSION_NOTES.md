# TRACK EXTENSION NOTES — Extended City (`2.54×`) & Extended Lava (`2.50×`) Circuits

## 1. Phase 0 Audit (Baseline Architecture & Measurements)

### Track Definition & Single Source of Truth
- **Files**:
  - `/src/game/meshes.ts`: `createTrackSpline(trackId)` defines the closed 3D `THREE.CatmullRomCurve3` (`catmullrom`, tension `0.5`) that acts as the single source of truth for all road geometry, collision frames, checkpoints/progress `t in [0, 1)`, AI racing line, minimap, pickups, billboards, and environmental clearance (`ensureTrackClearanceXZ`) for both the **City** (`city` / `city_v1`) and **Lava** (`lava_v2` / `lava`) circuits.
  - `/src/game/meshes.ts`: `sampleTrackFrame(spline, t, outPos, outForward, outRight, outUp)` computes position, tangent, lateral right vector, surface normal up vector, and procedural curvature-responsive banking at any normalized progress `t in [0, 1)`.
  - `/src/game/rules.ts`: `TRACK_SPECS`, `CITY_CURVATURE_ANCHORS`, `LAVA_CURVATURE_ANCHORS`, `createTrackPads(trackId)`, `createEnergyRings(trackId)`, `stepRacerPhysics`, and `computeAiInput`.

### Baseline vs. Extended Measurements — Both Circuits
| Metric | City Baseline | **City Extended (`city` / `city_v1`)** | Lava Baseline | **Lava Extended (`lava_v2` / `lava`)** |
| :--- | :--- | :--- | :--- | :--- |
| **Control Points** | 13 points | **32 points** (`2.46×`) | 16 points | **38 points** (`2.38×`) |
| **3D World Spline Length** | `2,145.63` units | **`5,453.95` units (`2.54×`)** | `2,257.94` units | **`5,654.47` units (`2.50×`)** |
| **Physics Track Length (`lengthMeters`)** | `4,200 m` | **`9,800 m` (`2.33×`)** | `4,600 m` | **`9,600 m` (`2.09×`)** |
| **1-Lap Time (Valkyrie AG-01, Pro Pace)** | `~22.4 s` | **`~52.0 s` (`0:52.0`)** | `~24.5 s` | **`~51.2 s` (`0:51.2`)** |
| **3-Lap Full Race Duration** | `~67.1 s` | **`~156.1 s` (`2:36.1`)** | `~73.5 s` | **`~153.6 s` (`2:33.6`)** |
| **Track Half-Width (`TRACK_HALF_WIDTH`)** | `13.5 m` (`27.0 m`) | **`13.5 m` (`27.0 m`)** | `13.5 m` (`27.0 m`) | **`13.5 m` (`27.0 m`)** |
| **Ribbon Mesh Segments (`segments`)** | `420` | **`960` (`~5.7 m` / quad)** | `480` | **`960` (`~5.9 m` / quad)** |
| **Exclusion Samples (`trackSamples`)** | `360` XZ points | **`720` XZ points** | `360` XZ points | **`720` XZ points** |

---

## 2. Extended Lava Circuit (`lava_v2` & `lava` — `5,654.47` World Units, `2.50×` Baseline)

Whereas the Extended City Circuit branches **North-East** after its crossing (`+X, +Z → -Z`), the **Extended Lava Circuit** takes a distinctly different volcanic path: after sweeping around the **Caldera Parabolica** and diving through the subterranean **Volcano-Base Magma Cavern Tunnel**, it plunges through the **Obsidian Trench Underpass** at `(420, 18, -140)`, climbs **South-East** to the **Pyroclastic Summit Crest** at `(1135, 68, 305)`, drops into the **Southern Caldera 180° Hairpin** (`(1455, 24, 55)`), weaves **Northward** through the **Basalt Serpent Esses** (`(1055, -265) → (1355, -615)`) to the **Northern Obsidian Rim 180° Hairpin** (`(1245, 24, -725)`), and sweeps **South-West** through the **Geothermal Refinery Core** and across the **Elevated Magma Viaduct Overpass** (`(420, 48, -140)`, `+30.0m` above the underpass!) into the original Southern Caldera Return.

### Sector 1 (`t = 0.00 .. 0.21`, `~1,185` world units) — **CALDERA PARABOLICA & VOLCANO-BASE MAGMA CAVERN TUNNEL**
- **Preserved Start/Finish Grid & Caldera Parabolica (`t = 0.00 .. 0.125`)**: Starts at `(0, 34, 0)` heading north into the high-altitude banked Caldera Parabolica (`(16, 41, -310) → (148, 53, -555) → (242, 41, -575)`), lined with cantilevered parabolic telemetry ribs and a pulsing plasma arrestor wall.
- **Set-Piece 1 — Volcano-Base Magma Cavern Tunnel (`t = 0.138 .. 0.180`)**: Dives directly into the heart of the Primary Erupting Stratovolcano (`(295, 26, -495) → (312, 18, -395) → (330, 20, -295)`), featuring a vaulted obsidian-magma cavern ceiling, twin subterranean flowing molten lava rivers, dark volcanic gravel shore banks, jagged obsidian spires, and 10 interior molten lava waterfalls.

### Sector 2 (`t = 0.21 .. 0.50`, `~1,640` world units) — **OBSIDIAN TRENCH UNDERPASS, PYROCLASTIC SUMMIT CREST, DROP & SOUTHERN CALDERA HAIRPIN**
- **Obsidian Trench Underpass (`t = 0.19 .. 0.23`)**: Passes southeast through `(420, 18, -140)` at `y = 18.0 m` — **30.0 meters directly beneath** Sector 4's Elevated Magma Viaduct Overpass (`y = 48.0 m`).
- **Long South-East Pyroclastic Ascent & Summit Crest (`t = 0.23 .. 0.37`)**: A 780-meter full-throttle straight and climb (`y = 18m → 68m` at `(1135, 68, 305)`) overlooking the 3,400×3,400 undulating liquid magma sea and the South-East Volcanic Cordillera.
- **Roller-Coaster Drop & Hairpin 1 — Southern Caldera 180° Drift Turn (`t = 0.37 .. 0.50`)**: Plunges from `y = 68m` down to `y = 22m` into a wide 180° turnaround (`(1405, 36, 185) → (1455, 24, 55) → (1395, 22, -75) → (1265, 26, -125)`), guarded by dense outer warning chevrons (`>>`).

### Sector 3 (`t = 0.50 .. 0.75`, `~1,415` world units) — **BASALT SERPENT ESSES, NORTHERN OBSIDIAN RIM HAIRPIN & BANKED MAGMA SWEEPER**
- **Technical Basalt Serpent Esses (`t = 0.50 .. 0.60`)**: A rhythmic Left–Right–Left technical S-curve (`(1125, 30, -145) → (1055, 34, -265) → (1165, 30, -385) → (1295, 26, -485)`) weaving between obsidian spires and glowing lava pools at the foot of the Colossal Eastern Caldera Stratovolcano.
- **Hairpin 2 — Northern Obsidian Rim 180° Turn (`t = 0.60 .. 0.68`)**: Tight 180° left-hand hairpin at the northern volcanic rim (`(1355, 22, -615) → (1245, 24, -725) → (1095, 32, -695)`) with a wide braking entry and climbing exit.
- **High-Speed Banked Magma Rim Sweeper (`t = 0.68 .. 0.75`)**: A fast climbing arc (`y = 32m → 58m`) with enhanced inward parabolic banking (`up to 0.38 rad`) launching racers southwest toward the Geothermal Refinery Core.

### Sector 4 (`t = 0.75 .. 1.00`, `~1,414` world units) — **GEOTHERMAL REFINERY CORE, MAGMA VIADUCT OVERPASS & SOUTHERN CALDERA RETURN**
- **Set-Piece 2 — Geothermal Refinery Core & Laser Gantry Corridor (`t = 0.745 .. 0.798`)**: High-altitude industrial geothermal reactor gallery (`y = 62m` at `(665, 62, -365)`) featuring 10 armored brushed-graphite containment arches, overhead magma-plasma conduits, and basalt turbine pods.
- **Set-Piece 3 — Elevated Magma Viaduct Overpass (`t = 0.822 .. 0.854`)**: Crosses southwest at `(420, 48, -140)` (`y = 48.0 m`, **+30.0 meters above the Sector 2 Obsidian Trench Underpass**) through an 8-truss cable-stayed suspension bridge span.
- **Preserved Southern Caldera Return (`t = 0.854 .. 1.00`)**: Sweeps smoothly through `(310, 35, 115) → (245, 28, 255) → (115, 26, 285) → (22, 30, 155) → (0, 34, 0)` across the Start/Finish gantry.

---

## 3. Extended City Circuit (`city` & `city_v1` — `5,453.95` World Units, `2.54×` Baseline)

- **Sector 1 (`t = 0.00 .. 0.25`)**: Preserved Start/Finish straight & North Bean Curve (`(0, 28, 0) → (220, 38, -490)`), X-Crossing Underpass at `(450, 18, -260)`, and 680m Neon Ascent straight climbing to `y = 68m`.
- **Sector 2 (`t = 0.25 .. 0.50`)**: Skyline Crest (`y = 68m` at `(1085, 68, 210)`), Roller-Coaster Drop (`y = 68m → 22m`), Hairpin 1 (Shibuya 180° Drift Turn), and Technical Cyber Esses.
- **Sector 3 (`t = 0.50 .. 0.75`)**: Hairpin 2 (Cyberdyne Tight Turn), High-Speed Banked Megatower Sweeper, and Set-Piece 1 (Skyscraper Core Tunnel).
- **Sector 4 (`t = 0.75 .. 1.00`)**: Set-Piece 2 (Twin-Tower Glass Sky-Corridor), Set-Piece 3 (Elevated Skybridge Overpass at `(450, 48, -260)`, `+30.0m` above the Sector 1 Underpass), and Original Bean Loop Southern Return.

---

## 4. Mathematical & Physics Verification Summary (Both Circuits)

- **Minimum Horizontal Curve Radius**:
  - **City**: `R_min = 34.66 m` (`> 2.5 × TRACK_HALF_WIDTH = 33.75 m`)
  - **Lava**: `R_min = 39.07 m` (`> 2.5 × TRACK_HALF_WIDTH = 33.75 m`)
  - Guarantees **zero inner-guardrail or inner-apron self-intersection** anywhere on either 960-segment ribbon.
- **Maximum Vertical Slope / Grade**:
  - **City**: `|dy/ds|_max = 0.162` (`16.2%` grade)
  - **Lava**: `|dy/ds|_max = 0.175` (`17.5%` grade)
  - Smooth `C²` Catmull-Rom vertical transitions with zero abrupt pitch spikes.
- **Overpass / Underpass Vertical Clearance**:
  - **City Crossing `(450, -260)`**: `y = 18.00 m` (Underpass, `t = 0.186`) vs `y = 48.00 m` (Skybridge Overpass, `t = 0.808`) → **`30.00 m` vertical clearance**.
  - **Lava Crossing `(420, -140)`**: `y = 18.00 m` (Obsidian Trench Underpass, `t = 0.209`) vs `y = 48.00 m` (Magma Viaduct Overpass, `t = 0.838`) → **`30.00 m` vertical clearance**.
- **Zero Unintended Close Approaches**: Minimum 2D XZ centerline distance between any two non-crossing segments is **`108.4 m` (City)** and **`154.98 m` (Lava)** (`> 3×–4×` total viaduct width), and all environmental mountains, buildings, billboards, and pylons are verified against `720` spline samples via `ensureTrackClearanceXZ`.
