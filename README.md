# LoRa Mesh Network Planner

📡 **K7CFO : LoRa Repeater Planner** - A web-based tool for planning and visualizing LoRa mesh networks at 915 MHz.

![LoRa Mesh Planner](https://img.shields.io/badge/frequency-915%20MHz-blue) ![Status](https://img.shields.io/badge/status-stable-green) ![License](https://img.shields.io/badge/license-MIT-blue)

## ✨ Features

### 🗺️ Interactive Map Interface
- **Multiple Map Layers**: Street, Satellite, and Topographic views
- **No API Keys Required**: Uses free tile services (OpenStreetMap, Esri, OpenTopoMap)
- **Responsive Design**: Works on desktop and mobile devices
- **PWA Ready**: Installable as a Progressive Web App

### 📡 Transmitter Management
- **Click to Place**: Simple transmitter placement anywhere on the map
- **Drag to Reposition**: Easy marker repositioning
- **Power Selection**: Choose between 0.15W (150mW) or 1.0W
- **Context Menus**: Right-click for delete, rename, and power toggle options
- **Persistent Storage**: Automatically saves your network configuration

### 🔗 Advanced RF Link Analysis
- **Real-time Visualization**: Comprehensive link quality assessment
- **Terrain-Aware Calculations**: Real elevation data integration
- **Fresnel Zone Analysis**: First zone clearance at 915 MHz
- **Path Loss Modeling**: Free space + diffraction + environmental
- **Color-coded Quality**:
  - 🟢 **Excellent**: >15 dB margin, ideal conditions
  - 🟡 **Good**: 5-15 dB margin, reliable operation  
  - 🟠 **Marginal**: 0-5 dB margin, may have issues
  - 🔴 **Poor**: <0 dB margin, unreliable connection
- **Detailed Popups**: Click links for comprehensive RF analysis
- **Obstruction Detection**: Visual indicators for terrain blockage

### 📶 Coverage Visualization
- **Coverage Circles**: Power-based radius estimation
- **Adjustable Transparency**: Customize overlay opacity
- **Toggle Display**: Show/hide coverage areas as needed

## 🚀 Quick Start

### Development

```bash
# Clone the repository
git clone https://github.com/opticgroup/lora-mesh-planner.git
cd lora-mesh-planner

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000 in your browser
```

### Production Deployment

```bash
# Build for production
npm run build

# Deploy to Vercel (recommended)
npx vercel --prod

# Or deploy to any static hosting service
```

## 📱 Usage Guide

### Basic Operations

1. **Adding Transmitters**
   - Click anywhere on the map to place a transmitter
   - Select power level (0.15W or 1.0W) before or after placement
   - Markers show different colors/sizes based on power level

2. **Managing Transmitters**
   - **Drag markers** to reposition transmitters
   - **Right-click markers** for context menu options:
     - Delete transmitter
     - Toggle power (0.15W ↔ 1.0W)
     - Rename transmitter

3. **Viewing Network Links**
   - Links automatically appear between all transmitters
   - Colors indicate estimated link quality
   - Link count shown in Network Status panel

4. **Coverage Areas**
   - Toggle "Show Coverage Areas" to display range circles
   - Adjust transparency slider for better visibility
   - Coverage radius based on power level and simple propagation model

### Map Controls

- **Layer Selection**: Choose between Street, Satellite, or Topographic maps
- **Zoom**: Mouse wheel or map controls
- **Pan**: Click and drag the map
- **Scale Bar**: Shows distance reference

### Settings Panel

- **Power Selection**: Default power for new transmitters
- **Coverage Display**: Toggle and transparency controls
- **Network Status**: Live count of transmitters and links
- **Clear All**: Reset entire network (with confirmation)

## ⚙️ Technical Specifications

### RF Parameters
- **Frequency**: 915 MHz (ISM band, λ = 0.328m)
- **Antenna**: 3 dBi omnidirectional, 10m AGL (configurable)
- **Power Options**: 0.15W (21.76 dBm) or 1.0W (30 dBm)
- **Receiver Sensitivity**: SF7: -123 dBm to SF12: -137 dBm
- **Modulation**: LoRa with spreading factor optimization
- **Fade Margin**: 15 dB for reliability

### Advanced RF Analysis Engine
The tool implements professional-grade RF calculations:

```javascript
// Free Space Path Loss (ITU-R P.525-3)
FSPL(dB) = 20×log₁₀(d_km) + 20×log₁₀(f_MHz) + 32.44

// Fresnel Zone Radius (915 MHz)
r = √(n × λ × d₁ × d₂ / (d₁ + d₂))

// Complete Link Budget
Margin = EIRP - PathLoss + RxGain - Sensitivity - FadeMargin

// Terrain Integration
- Real elevation data from Open-Meteo & OpenTopoData
- Knife-edge diffraction modeling
- Earth curvature correction
- Obstruction detection and clearance analysis
```

### Data Storage
- **Local Storage**: Network configurations saved automatically
- **No Server Required**: Fully client-side operation
- **Export/Import**: Manual backup via browser localStorage

## 🏗️ Project Structure

```
lora-mesh-planner/
├── 📁 src/
│   ├── index.html          # Main application page
│   ├── 📁 js/
│   │   └── main.js         # Core application logic
│   └── 📁 styles/
│       └── main.css        # Application styling
├── 📁 public/
│   ├── manifest.json       # PWA manifest
│   └── favicon.svg         # App icon
├── 📁 api/                 # (Optional) Advanced RF APIs
│   ├── elevation.js        # Terrain data service
│   ├── linkbudget.js       # Detailed RF calculations
│   └── rf-utils.js         # RF calculation utilities
├── package.json            # Dependencies and scripts
├── vite.config.js          # Build configuration
└── vercel.json            # Deployment settings
```

## 🛠️ Development

### Available Scripts

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
npm run format   # Format code with Prettier
npm run test     # Run tests
```

### Development Workflow

1. **Local Development**
   - Make changes to source files
   - Development server auto-reloads
   - Test functionality at `http://localhost:3000`

2. **Production Deployment**
   - Run `npm run build` to create optimized build
   - Deploy `dist/` folder to any static hosting
   - Recommended: Use Vercel for automatic deployments

### Architecture Notes

- **Frontend Framework**: Vanilla JavaScript + Leaflet.js
- **Build Tool**: Vite (fast, modern bundler)
- **Mapping**: Leaflet.js with multiple tile providers
- **Styling**: Custom CSS with responsive design
- **State Management**: Simple class-based architecture
- **Storage**: Browser localStorage for persistence

## 🌍 Browser Support

- **Chrome**: ✅ Full support (recommended)
- **Firefox**: ✅ Full support
- **Safari**: ✅ Full support
- **Edge**: ✅ Full support
- **Mobile Browsers**: ✅ Responsive design

## 🤝 Contributing

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Keep the UI/UX simple and intuitive
- Ensure mobile responsiveness
- Test on multiple browsers
- Follow existing code style
- Add comments for complex logic

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

## 🙏 Credits & Acknowledgments

### Map Data & Services
- **[OpenStreetMap](https://www.openstreetmap.org/)** - Street map tiles
- **[Esri](https://www.esri.com/)** - Satellite imagery
- **[OpenTopoMap](https://opentopomap.org/)** - Topographic maps

### Libraries & Tools
- **[Leaflet.js](https://leafletjs.com/)** - Interactive mapping library
- **[Vite](https://vitejs.dev/)** - Build tool and development server
- **[Vercel](https://vercel.com/)** - Hosting and deployment platform

### LoRa Community
Built with ❤️ for the **LoRa/IoT community**. Special thanks to amateur radio operators and IoT enthusiasts who make mesh networking possible!

---

## 🔗 Links

- **Live Demo**: [Coming Soon]
- **Issues**: [GitHub Issues](https://github.com/opticgroup/lora-mesh-planner/issues)
- **Discussions**: [GitHub Discussions](https://github.com/opticgroup/lora-mesh-planner/discussions)

**📡 Happy mesh networking! 🔗**
