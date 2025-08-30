# LoRa Mesh Network Planner

A web-based tool for planning and visualizing LoRa mesh networks with terrain-based RF coverage modeling at 915 MHz.

![LoRa Mesh Planner](https://img.shields.io/badge/frequency-915%20MHz-blue) ![Status](https://img.shields.io/badge/status-ready%20for%20deployment-green) ![License](https://img.shields.io/badge/license-MIT-blue)

## Features

✅ **Interactive Map Interface**
- 🛰️ Satellite imagery via Esri World Imagery  
- 🗺️ Street maps via OpenStreetMap
- 🏔️ Topographic maps via OpenTopoMap
- No API keys required!

✅ **Transmitter Management**
- Click to place transmitters
- Drag to reposition
- Right-click context menus
- Power selection: 0.15W or 1W
- Persistent storage

✅ **Real-time RF Analysis**
- Terrain-based line-of-sight calculations
- Fresnel zone clearance analysis
- Free space path loss modeling
- Link quality visualization (green/yellow/red)

✅ **Coverage Visualization**
- Coverage area circles
- Adjustable transparency
- Power-based radius estimation

✅ **Progressive Web App**
- Works offline after first load
- Mobile-responsive design
- Installable as PWA

## Technical Specifications

- **Frequency**: 915 MHz (ISM band)
- **RF Model**: Line-of-sight with Fresnel zone clearance
- **Antenna**: 5dBi omnidirectional, 6 feet AGL
- **Power Options**: 0.15W (150mW) or 1W
- **Receiver Sensitivity**: -137 dBm (typical LoRa)
- **Terrain Data**: OpenTopography API (free, global coverage)

## Quick Start

### Development

```bash
# Clone the repository
git clone <your-repo-url>
cd lora-mesh-planner

# Install dependencies
npm install

# Start development server
npm run dev

# Visit http://localhost:3000
```

### Deployment (Vercel)

```bash
# Build for production
npm run build

# Deploy to Vercel
npx vercel --prod

# Or connect your GitHub repo to Vercel for automatic deployments
```

## Usage

### Basic Operation

1. **Add Transmitters**: Click anywhere on the map
2. **Select Power**: Choose 0.15W or 1W from the dropdown
3. **Move Transmitters**: Drag markers to new positions
4. **View Links**: Colored lines show link quality:
   - 🟢 **Green**: Good link (≥20 dB margin)
   - 🟡 **Yellow**: Marginal (10-20 dB margin)  
   - 🔴 **Red**: Poor (<10 dB margin)

### Advanced Features

- **Map Layers**: Switch between satellite, street, and topographic views
- **Coverage Areas**: Toggle coverage circles with transparency control
- **Context Menu**: Right-click transmitters to delete, rename, or change power
- **Clear All**: Reset the entire network planning session

## RF Model Details

The tool uses a simplified but effective RF propagation model:

### Path Loss Calculation
```
PathLoss(dB) = 20×log₁₀(4π×d×f/c)
```
Where:
- d = distance in meters
- f = frequency (915 MHz)
- c = speed of light

### Fresnel Zone Analysis
- Calculates first Fresnel zone radius
- Accounts for terrain obstruction
- Applies Earth curvature corrections
- Requires 60% clearance for optimal links

### Link Budget
```
RxPower = TxPower + TxGain + RxGain - PathLoss - ObstructionLoss
LinkMargin = RxPower - RxSensitivity
```

## API Endpoints

### GET/POST `/api/elevation`
Returns elevation profile between two points.

**Parameters:**
- `lat1`, `lng1`: Start coordinates
- `lat2`, `lng2`: End coordinates  
- `samples`: Number of elevation points (2-200)

### GET/POST `/api/linkbudget`
Calculates RF link budget with terrain analysis.

**Parameters:**
- `lat1`, `lng1`: Transmitter 1 coordinates
- `lat2`, `lng2`: Transmitter 2 coordinates
- `txPower`: Transmit power in watts
- `rxPower`: Receive power in watts (optional)

## Project Structure

```
lora-mesh-planner/
├── src/                    # Frontend source
│   ├── index.html          # Main HTML page
│   ├── js/main.js          # Application logic
│   └── styles/main.css     # Styling
├── api/                    # Vercel serverless functions
│   ├── elevation.js        # Terrain data API
│   ├── linkbudget.js       # RF calculations API
│   └── rf-utils.js         # RF calculation utilities
├── public/                 # Static assets
│   ├── manifest.json       # PWA manifest
│   └── icons/              # App icons
└── dist/                   # Built application
```

## Development Roadmap

### Phase 1 ✅ Complete
- [x] Basic mapping interface
- [x] Transmitter placement and management
- [x] RF calculation engine
- [x] Real-time link visualization
- [x] Coverage area display
- [x] Vercel deployment ready

### Phase 2 🚧 Future Enhancements
- [ ] Import/export network configurations
- [ ] Multiple frequency support
- [ ] Advanced antenna patterns
- [ ] Network topology optimization
- [ ] Coverage heatmaps
- [ ] Terrain profile visualization
- [ ] Link budget details panel

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use for personal or commercial projects.

## Credits

- **Maps**: OpenStreetMap, Esri, OpenTopoMap
- **Elevation Data**: OpenTopography API
- **Icons**: Built-in emoji and Unicode symbols

---

**Built for the LoRa/IoT community** 📡 

Happy mesh networking! 🔗
