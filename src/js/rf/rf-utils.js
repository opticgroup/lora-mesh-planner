/**
 * RF Utilities for LoRa Mesh Planning
 * Frequency: 915 MHz (ISM Band)
 * Author: K7CFO
 */

export class RFUtils {
    constructor() {
        // LoRa 915 MHz constants
        this.frequency = 915e6; // Hz
        this.wavelength = 299792458 / this.frequency; // λ = c/f = 0.328m for 915MHz
        this.earthRadius = 6371000; // meters
        
        // LoRa-specific parameters
        this.loraParams = {
            // Transmit power conversions
            power: {
                '0.15W': { watts: 0.15, dbm: 21.76 },
                '1.0W': { watts: 1.0, dbm: 30.0 }
            },
            
            // LoRa receiver sensitivity by spreading factor (typical values)
            sensitivity: {
                SF7: -123,   // dBm
                SF8: -126,   // dBm
                SF9: -129,   // dBm
                SF10: -132,  // dBm
                SF11: -135,  // dBm
                SF12: -137   // dBm
            },
            
            // Typical antenna parameters
            antennaGain: 3,      // dBi (typical omni antenna)
            cableLoss: 1.5,      // dB (typical coax loss)
            connectorLoss: 0.5,  // dB
            fadeMargin: 15       // dB (recommended for reliability)
        };
    }

    /**
     * Calculate the first Fresnel zone radius at a given point along the path
     * 
     * @param {number} d1 - Distance from transmitter to point (km)
     * @param {number} d2 - Distance from point to receiver (km)
     * @param {number} n - Fresnel zone number (typically 1)
     * @returns {number} Fresnel zone radius in meters
     */
    calculateFresnelZoneRadius(d1, d2, n = 1) {
        // Convert km to meters
        const d1m = d1 * 1000;
        const d2m = d2 * 1000;
        
        // Fresnel zone formula: r = sqrt(n * λ * d1 * d2 / (d1 + d2))
        const radius = Math.sqrt(n * this.wavelength * d1m * d2m / (d1m + d2m));
        
        return radius; // meters
    }

    /**
     * Calculate Earth curvature effect on path
     * 
     * @param {number} distance - Total distance in km
     * @param {number} fraction - Fraction of path (0.5 = midpoint)
     * @returns {number} Earth bulge in meters
     */
    calculateEarthCurvature(distance, fraction = 0.5) {
        const distanceMeters = distance * 1000;
        const d1 = distanceMeters * fraction;
        const d2 = distanceMeters * (1 - fraction);
        
        // Earth curvature formula: h = (d1 * d2) / (2 * Re)
        const curvature = (d1 * d2) / (2 * this.earthRadius);
        
        return curvature; // meters
    }

    /**
     * Calculate Free Space Path Loss (FSPL)
     * 
     * @param {number} distance - Distance in km
     * @param {number} frequency - Frequency in Hz (default: 915 MHz)
     * @returns {number} Path loss in dB
     */
    calculateFSPL(distance, frequency = this.frequency) {
        // FSPL(dB) = 20*log10(d) + 20*log10(f) + 32.44
        // where d is in km and f is in MHz
        const distanceKm = distance;
        const frequencyMHz = frequency / 1e6;
        
        const fspl = 20 * Math.log10(distanceKm) + 20 * Math.log10(frequencyMHz) + 32.44;
        
        return fspl; // dB
    }

    /**
     * Calculate knife-edge diffraction loss over an obstacle
     * 
     * @param {number} h - Height of obstacle above direct path (meters)
     * @param {number} d1 - Distance from transmitter to obstacle (km)
     * @param {number} d2 - Distance from obstacle to receiver (km)
     * @returns {number} Additional path loss due to diffraction (dB)
     */
    calculateKnifeEdgeLoss(h, d1, d2) {
        // Fresnel parameter: v = h * sqrt(2 * (d1 + d2) / (λ * d1 * d2))
        const d1m = d1 * 1000;
        const d2m = d2 * 1000;
        const v = h * Math.sqrt(2 * (d1m + d2m) / (this.wavelength * d1m * d2m));
        
        let diffractionLoss;
        
        if (v <= -2.4) {
            // No significant loss
            diffractionLoss = 0;
        } else if (v <= 0) {
            // Partial obstruction
            diffractionLoss = 20 * Math.log10(0.5 - 0.62 * v);
        } else if (v <= 2.4) {
            // Significant obstruction
            diffractionLoss = 20 * Math.log10(0.5 * Math.exp(-0.95 * v));
        } else {
            // Complete obstruction
            diffractionLoss = 20 * Math.log10(0.4 - Math.sqrt(0.1184 - (0.38 - 0.1 * v) * (0.38 - 0.1 * v)));
        }
        
        return Math.max(0, diffractionLoss); // dB (cannot be negative)
    }

    /**
     * Determine required Fresnel zone clearance percentage
     * 
     * @param {number} distance - Total path distance in km
     * @returns {number} Required clearance as percentage (0.6 = 60%)
     */
    getRequiredFresnelClearance(distance) {
        // Longer paths need higher clearance for reliability
        if (distance < 5) return 0.6;   // 60% for short paths
        if (distance < 15) return 0.7;  // 70% for medium paths
        return 0.8; // 80% for long paths
    }

    /**
     * Check if a path has adequate Fresnel zone clearance
     * 
     * @param {Object} pathProfile - Elevation profile with {distance, elevation} points
     * @param {number} txHeight - Transmitter antenna height (meters)
     * @param {number} rxHeight - Receiver antenna height (meters)
     * @param {number} totalDistance - Total path distance (km)
     * @returns {Object} Clearance analysis results
     */
    analyzeFresnelClearance(pathProfile, txHeight, rxHeight, totalDistance) {
        const results = {
            hasAdequateClearance: true,
            minClearance: Infinity,
            obstructions: [],
            requiredClearancePercent: this.getRequiredFresnelClearance(totalDistance)
        };

        if (!pathProfile || pathProfile.length < 2) {
            return { ...results, hasAdequateClearance: false, error: 'Invalid path profile' };
        }

        const txElevation = pathProfile[0].elevation + txHeight;
        const rxElevation = pathProfile[pathProfile.length - 1].elevation + rxHeight;

        // Check clearance at each point along the path
        for (let i = 1; i < pathProfile.length - 1; i++) {
            const point = pathProfile[i];
            const d1 = point.distance; // km from transmitter
            const d2 = totalDistance - point.distance; // km to receiver
            
            // Calculate line-of-sight height at this point
            const losHeight = txElevation + (rxElevation - txElevation) * (d1 / totalDistance);
            
            // Include Earth curvature effect
            const earthCurvature = this.calculateEarthCurvature(totalDistance, d1 / totalDistance);
            const adjustedLosHeight = losHeight + earthCurvature;
            
            // Calculate required Fresnel zone clearance
            const fresnelRadius = this.calculateFresnelZoneRadius(d1, d2);
            const requiredHeight = adjustedLosHeight + fresnelRadius * results.requiredClearancePercent;
            
            // Check if terrain obstructs the path
            const terrainHeight = point.elevation;
            const clearance = terrainHeight - requiredHeight;
            
            if (clearance > 0) {
                // Obstruction found
                results.hasAdequateClearance = false;
                results.obstructions.push({
                    distance: d1,
                    elevation: terrainHeight,
                    requiredHeight: requiredHeight,
                    obstruction: clearance,
                    fresnelRadius: fresnelRadius
                });
            }
            
            results.minClearance = Math.min(results.minClearance, Math.abs(clearance));
        }

        return results;
    }

    /**
     * Get optimal LoRa spreading factor based on distance and conditions
     * 
     * @param {number} distance - Distance in km
     * @param {string} environment - 'urban', 'suburban', 'rural'
     * @returns {string} Recommended spreading factor (SF7-SF12)
     */
    getOptimalSpreadingFactor(distance, environment = 'suburban') {
        // Environmental factors affecting range
        const environmentFactors = {
            rural: 1.0,      // Best case
            suburban: 0.8,   // Some obstacles
            urban: 0.6       // Many obstacles
        };
        
        const factor = environmentFactors[environment] || 0.8;
        const effectiveDistance = distance / factor;
        
        // Spreading factor selection based on distance
        if (effectiveDistance <= 2) return 'SF7';   // Highest data rate
        if (effectiveDistance <= 5) return 'SF8';
        if (effectiveDistance <= 10) return 'SF9';
        if (effectiveDistance <= 15) return 'SF10';
        if (effectiveDistance <= 25) return 'SF11';
        return 'SF12'; // Maximum range, lowest data rate
    }

    /**
     * Convert power from watts to dBm
     * 
     * @param {number} watts - Power in watts
     * @returns {number} Power in dBm
     */
    wattsToDbm(watts) {
        return 10 * Math.log10(watts * 1000);
    }

    /**
     * Convert power from dBm to watts
     * 
     * @param {number} dbm - Power in dBm
     * @returns {number} Power in watts
     */
    dbmToWatts(dbm) {
        return Math.pow(10, (dbm - 30) / 10);
    }
}

// Create a singleton instance for use throughout the application
export const rfUtils = new RFUtils();
