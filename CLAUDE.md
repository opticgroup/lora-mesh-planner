# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start Vite development server on http://localhost:3000
- `npm run build` - Build application for production (outputs to `dist/`)
- `npm run preview` - Preview production build locally on port 8080
- `npm run lint` - Run ESLint on JavaScript and HTML files
- `npm run format` - Format code with Prettier
- `npm run test` - Run tests with Vitest

## Project Architecture

This is a LoRa mesh network planning tool built as a Progressive Web App using vanilla JavaScript and Vite.

### Core Structure
- **Frontend**: Vanilla JavaScript with Leaflet.js for interactive mapping
- **Backend**: Vercel serverless functions for RF calculations and terrain data
- **Build Tool**: Vite for development and bundling
- **Deployment**: Configured for Vercel with automatic builds

### Key Components

**Frontend (`src/`)**
- `src/js/main.js` - Main application class (`LoRaMeshPlanner`) handling:
  - Interactive map with multiple tile layers (street, satellite, topo)
  - Transmitter placement and management
  - Real-time RF link visualization with color-coded quality
  - Coverage area calculations and display
  - Local storage persistence
- `src/index.html` - Single-page application entry point
- `src/styles/main.css` - Application styling

**Backend (`api/`)**
- `api/rf-utils.js` - RF propagation calculations for 915 MHz LoRa
- `api/elevation.js` - Terrain elevation data via OpenTopography API
- `api/linkbudget.js` - RF link budget calculations with terrain analysis
- `api/coverage.js` - Coverage area calculations

### RF Model Implementation
- Frequency: 915 MHz ISM band
- Uses line-of-sight calculations with Fresnel zone clearance
- Terrain-based path loss modeling
- Link quality visualization (green/yellow/red based on dB margin)
- Supports 0.15W and 1W power levels

### State Management
The application uses a Map-based architecture:
- `transmitters` Map - Stores transmitter locations and properties
- `linkLines` Map - Manages RF link visualizations between transmitters
- `coverageCircles` Map - Handles coverage area overlays

### Data Flow
1. User places transmitters on map
2. Frontend calculates basic distances and coverage
3. For terrain modeling: API calls to `/api/linkbudget` and `/api/elevation`
4. RF calculations performed server-side using elevation profiles
5. Results displayed as colored links and coverage areas

## Complete Development Workflow

**Your Automated Pipeline is now LIVE! 🚀**

### How It Works
1. **Tell Claude Code what to build** → I make the changes
2. **Git automatically tracks** → All changes committed with descriptive messages
3. **GitHub receives updates** → Code automatically pushed to https://github.com/opticgroup/lora-mesh-planner
4. **Vercel auto-deploys** → Live website updates within 30 seconds

### Your Live Website
- **Production URL**: https://lora-mesh-planner-fzs90ii3f-asknick-ytelcoms-projects.vercel.app
- **Auto-deploys**: Every push to GitHub main branch triggers automatic deployment
- **No manual steps**: Just tell me what to change and reload your website to see it live!

### Your Workflow
```
You: "Add a blue button to the map"
↓
Claude Code: Makes changes + commits + pushes
↓ 
Vercel: Auto-deploys (30 seconds)
↓
You: Reload website to see changes live
```

### GitHub Integration
- **Repository**: https://github.com/opticgroup/lora-mesh-planner
- **Automatic**: All changes pushed to main branch
- **History**: Full git history with descriptive commit messages

## Development Notes

- No build step required for development - Vite handles hot reloading
- PWA manifest configured for offline capability
- Uses OpenStreetMap, Esri, and OpenTopoMap tile services (no API keys required)
- Local storage used for persisting transmitter placements
- Terrain modeling can be toggled on/off for performance