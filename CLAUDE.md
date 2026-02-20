# City Builder Simulation Game

## Project Overview
A browser-based 3D city-building simulation game inspired by SimCity and A-Train (A列車で行こう).
The goal is to create a polished, feature-rich city simulation with realistic economic mechanics.

## Tech Stack
- **Three.js** via **@react-three/fiber** (R3F) — 3D rendering
- **React 18** + **TypeScript** — UI and game structure
- **Vite** — Build tool
- **Zustand** — Game state management
- **@react-three/drei** — Helper components for R3F
- **Tailwind CSS** — UI styling

## Architecture

### Directory Structure
```
src/
├── main.tsx              # Entry point
├── App.tsx               # Root component
├── game/
│   ├── store.ts          # Zustand game state
│   ├── simulation.ts     # Economic simulation engine
│   ├── types.ts          # TypeScript types/interfaces
│   └── constants.ts      # Game constants and configs
├── components/
│   ├── Scene.tsx          # Main Three.js scene
│   ├── Terrain.tsx        # Grid-based terrain
│   ├── Building.tsx       # Building 3D models
│   ├── Road.tsx           # Road system
│   ├── Camera.tsx         # Isometric camera controls
│   └── GridHelper.tsx     # Grid overlay for placement
├── ui/
│   ├── HUD.tsx            # Heads-up display overlay
│   ├── Toolbar.tsx        # Building selection toolbar
│   ├── StatsPanel.tsx     # Population, money, stats
│   ├── MiniMap.tsx        # Mini map
│   └── TimeControls.tsx   # Play/pause/speed controls
└── utils/
    ├── grid.ts            # Grid math utilities
    └── colors.ts          # Color palette
```

### Core Systems

#### 1. Grid System (64x64 tiles)
- Each tile: terrain type + optional building
- Terrain types: grass, water, sand, hill
- Buildings snap to grid

#### 2. Building Types
- **Residential** (R) — Houses, apartments → generates population
- **Commercial** (C) — Shops, offices → generates jobs + tax revenue
- **Industrial** (I) — Factories → generates jobs + goods, causes pollution
- **Roads** — Connects zones, enables growth
- **Power Plants** — Provides electricity
- **Water** — Provides water supply
- **Parks** — Increases land value, reduces pollution
- **Special** — City hall, fire station, police, school, hospital

#### 3. Economic Simulation
- Population growth based on available residential + jobs + services
- Tax revenue = population × tax rate × happiness modifier
- Monthly budget: income (taxes) vs expenses (services)
- Land value affected by proximity to parks, pollution, services
- Demand system (R/C/I bars like SimCity)

#### 4. Time System
- Tick-based: 1 tick = 1 game day
- Speed controls: pause, 1x, 2x, 4x
- Monthly/yearly summaries

#### 5. Camera
- Isometric perspective (45° rotation, ~60° tilt)
- Scroll to zoom, drag to pan
- Q/E to rotate 90°

### Visual Style
- Clean, colorful low-poly aesthetic
- Buildings as simple geometric shapes with color coding:
  - Residential: Green tones
  - Commercial: Blue tones
  - Industrial: Yellow/Orange tones
  - Roads: Dark gray
  - Parks: Bright green
- Soft shadows, ambient occlusion
- Day/night cycle (optional, later)

## Implementation Notes
- Use instanced meshes for performance with many buildings
- Simulation runs in requestAnimationFrame loop, decoupled from rendering
- State in Zustand, React components subscribe to relevant slices
- All monetary values in integer (avoid floating point issues)
- Grid coordinates: (x, z) where y is height

## Commands
- `npm run dev` — Start dev server
- `npm run build` — Production build
- `npm run preview` — Preview production build
