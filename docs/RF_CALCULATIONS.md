# RF Calculations Documentation

## K7CFO LoRa Mesh Planner - RF Analysis Engine

This document details the comprehensive RF calculations used in the LoRa Mesh Planner for 915 MHz ISM band operations.

## Frequency Specifications

- **Operating Frequency**: 915 MHz (ISM Band)
- **Wavelength (λ)**: λ = c/f = 299,792,458 / 915,000,000 = 0.328 meters

## Core RF Formulas

### 1. Free Space Path Loss (FSPL)

The fundamental path loss in free space without obstacles:

```
FSPL(dB) = 20 × log₁₀(d) + 20 × log₁₀(f) + 32.44
```

Where:
- d = distance in kilometers
- f = frequency in MHz (915 MHz)
- Result in decibels (dB)

**Reference**: ITU-R P.525-3

### 2. Fresnel Zone Calculations

First Fresnel zone radius at distance d from transmitter:

```
r = √(n × λ × d₁ × d₂ / (d₁ + d₂))
```

Where:
- n = Fresnel zone number (typically 1)
- λ = wavelength (0.328m for 915MHz)
- d₁ = distance from transmitter to point (meters)
- d₂ = distance from point to receiver (meters)
- r = radius in meters

**Clearance Requirements**:
- Short paths (<5km): 60% clearance minimum
- Medium paths (5-15km): 70% clearance minimum  
- Long paths (>15km): 80% clearance minimum

**Reference**: [Fresnel Zone Theory](https://en.wikipedia.org/wiki/Fresnel_zone)

### 3. Earth Curvature Correction

For longer paths, Earth's curvature affects line-of-sight:

```
h = (d₁ × d₂) / (2 × Re)
```

Where:
- d₁, d₂ = distances from endpoints to midpoint (meters)
- Re = Earth radius (6,371,000 meters)
- h = curvature height (meters)

### 4. Knife-Edge Diffraction Loss

When terrain obstructs the path, calculate additional loss using the Fresnel parameter:

```
v = h × √(2 × (d₁ + d₂) / (λ × d₁ × d₂))
```

Diffraction loss depends on v:
- v ≤ -2.4: No significant loss (0 dB)
- -2.4 < v ≤ 0: Partial obstruction: `20 × log₁₀(0.5 - 0.62 × v)` dB
- 0 < v ≤ 2.4: Significant obstruction: `20 × log₁₀(0.5 × exp(-0.95 × v))` dB
- v > 2.4: Complete obstruction (>20 dB loss)

**Reference**: ITU-R P.526-15

## LoRa-Specific Parameters

### Transmit Power Levels
- **0.15W**: 21.76 dBm (typical for battery-powered nodes)
- **1.0W**: 30.0 dBm (maximum legal power in US ISM band)

### Receiver Sensitivity by Spreading Factor

| SF | Sensitivity (dBm) | Range Factor | Data Rate |
|----|-------------------|--------------|-----------|
| SF7 | -123 | 1.0x | Highest |
| SF8 | -126 | 1.4x | High |
| SF9 | -129 | 2.0x | Medium |
| SF10 | -132 | 2.8x | Low |
| SF11 | -135 | 4.0x | Very Low |
| SF12 | -137 | 5.6x | Lowest |

### Antenna and System Parameters

**Default Values**:
- Antenna Gain: 3 dBi (typical omni-directional)
- Cable Loss: 1.5 dB (coaxial cable)
- Connector Loss: 0.5 dB (per connection)
- Fade Margin: 15 dB (reliability buffer)
- Antenna Height: 10m above ground level

## Link Budget Calculation

Complete link budget follows this equation:

```
Link Margin = EIRP - Path Loss + Rx Gain - System Losses - Rx Sensitivity - Fade Margin
```

### Components Breakdown:

1. **EIRP** (Effective Isotropic Radiated Power):
   ```
   EIRP = Tx Power (dBm) + Tx Antenna Gain (dBi) - Tx Cable Loss (dB)
   ```

2. **Path Loss** (Total):
   ```
   Total Path Loss = FSPL + Diffraction Loss + Environmental Loss
   ```

3. **Received Signal Strength**:
   ```
   Rx Signal = EIRP - Total Path Loss + Rx Antenna Gain - Rx Cable Loss
   ```

4. **Link Margin**:
   ```
   Margin = Rx Signal - Rx Sensitivity - Fade Margin
   ```

## Environmental Factors

### Foliage Loss
- Short paths (<1km): 0 dB
- Medium paths (1-5km): 3 dB
- Long paths (>5km): 6 dB

### Terrain Loss
- Additional loss for multiple obstructions
- Maximum 10 dB applied for severely obstructed paths

## Link Quality Assessment

| Link Margin | Quality | Reliability | Description |
|-------------|---------|-------------|-------------|
| >15 dB | Excellent | >99% | Ideal conditions |
| 5-15 dB | Good | 90-99% | Reliable operation |
| 0-5 dB | Marginal | 70-90% | May have issues |
| <0 dB | Poor | <70% | Unreliable |

## Spreading Factor Optimization

Algorithm selects optimal SF based on:
1. Distance-based initial selection
2. Link margin adjustment
3. Environmental factors

```javascript
if (linkMargin < -10) SF = SF12;      // Maximum sensitivity
else if (linkMargin < -5) SF = SF11;  // High sensitivity  
else if (linkMargin < 0) SF = SF10;   // Medium sensitivity
else if (linkMargin > 20) SF = SF7/8; // High data rate
```

## Elevation Data Integration

### API Sources
1. **Open-Meteo Elevation API** (Primary)
   - Free, no API key required
   - 10,000 requests/day limit
   - 30-meter resolution

2. **OpenTopoData** (Fallback)
   - Free tier: 100 requests/day
   - SRTM 30m resolution
   - Fallback for API failures

### Path Sampling
- 50 elevation points sampled along great circle path
- Spherical interpolation for accurate positioning
- 30-minute cache timeout for efficiency

## Validation and References

### Standards Compliance
- **ITU-R P.525-3**: Free space propagation
- **ITU-R P.526-15**: Diffraction and terrain effects
- **FCC Part 97**: Amateur radio frequency allocations
- **LoRaWAN Regional Parameters**: SF and power limits

### Physical Constants
- **Speed of Light**: 299,792,458 m/s
- **Earth Radius**: 6,371,000 m (mean radius)
- **Frequency**: 915 MHz ±26 MHz (ISM band)

## Implementation Notes

### Calculation Flow
1. Fetch elevation profile between endpoints
2. Analyze terrain for line-of-sight clearance
3. Calculate Fresnel zone requirements
4. Compute path loss components
5. Determine optimal spreading factor
6. Generate link quality assessment
7. Provide improvement recommendations

### Error Handling
- Fallback to simplified calculations if elevation data unavailable
- Graceful degradation for API failures
- Conservative estimates when uncertain

### Performance Optimization
- Elevation data caching (30-minute TTL)
- Batch API requests for efficiency
- Asynchronous calculations with loading indicators

---

**Author**: K7CFO  
**Date**: 2025  
**Version**: 1.0.0
