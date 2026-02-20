Build the complete v0.1 of this city builder simulation game following CLAUDE.md exactly.

## What to build:

### 1. Project Setup
- Initialize with Vite + React + TypeScript
- Install: three, @react-three/fiber, @react-three/drei, zustand, tailwindcss, @tailwindcss/vite
- Configure Tailwind, TypeScript strict mode

### 2. Game State (Zustand store)
- Grid: 64x64 array of tiles (terrain + building)
- Money: starts at $50,000
- Population, jobs, happiness
- Date (year/month/day), speed (paused/1x/2x/4x)
- Demand levels (residential/commercial/industrial)
- Selected tool (none, bulldoze, road, residential, commercial, industrial, park, power_plant, water_tower)
- Actions: placeBuilding, bulldoze, setSpeed, tick (advance simulation)

### 3. Simulation Engine
- tick() advances 1 day
- Monthly: collect taxes, pay expenses, update population
- Population growth = f(available housing, job ratio, happiness)
- Tax revenue = population × 10 × (happiness/100)
- Building costs: Road $10, Residential $100, Commercial $150, Industrial $200, Park $50, Power $500, Water $300
- Monthly upkeep: services cost money
- Demand calculation based on ratios

### 4. 3D Scene
- Terrain: flat green plane with grid lines
- Water tiles: blue, slightly lower
- Buildings as colored box geometries with varying heights:
  - Residential: green boxes, height 1-3 (grow with density)
  - Commercial: blue boxes, height 1-5
  - Industrial: orange boxes, height 1-2, wider
  - Roads: dark gray flat strips
  - Parks: bright green with small sphere trees
  - Power plants: tall red/gray cylinders
  - Water towers: blue cylinders on stilts
- Instanced rendering where possible
- Grid highlight on hover showing where building will be placed

### 5. Camera
- OrbitControls with constraints:
  - Min/max zoom (10-100 units)
  - Max polar angle ~60° (keep isometric feel)
  - Pan limited to grid bounds
- Default isometric-ish view looking at center

### 6. UI Overlay (React + Tailwind)
- Top bar: City name, date, money, population
- Bottom toolbar: tool selection buttons with icons (emoji is fine)
- Right panel: R/C/I demand bars
- Speed controls: ⏸️ ▶️ ⏩ ⏭️
- Toast notifications for events ("Population reached 1000!")
- Building info on hover

### 7. Interactions
- Click tile to place selected building (if affordable)
- Right-click or select bulldoze tool to remove
- Hover shows ghost preview of building
- Sound effects NOT needed for v0.1

### Quality requirements:
- Clean TypeScript, no `any` types
- Modular file structure per CLAUDE.md
- Smooth 60fps with 64x64 grid
- Responsive layout
- Working simulation loop that makes the city feel alive
- Buildings should appear/grow as population increases

Make sure `npm run dev` works and the game is fully playable.
