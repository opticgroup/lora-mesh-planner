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

## Development Notes

- No build step required for development - Vite handles hot reloading
- PWA manifest configured for offline capability
- Uses OpenStreetMap, Esri, and OpenTopoMap tile services (no API keys required)
- Local storage used for persisting transmitter placements
- Terrain modeling can be toggled on/off for performance