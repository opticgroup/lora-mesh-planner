// RF Propagation Calculation Utilities for LoRa 915 MHz
class RFCalculator {
    constructor() {
        this.frequency = 915e6; // 915 MHz in Hz
        this.c = 299792458; // Speed of light in m/s
        this.antennaHeight = 1.83; // 6 feet in meters
        this.antennaGain = 5; // 5 dBi
        this.receiverSensitivity = -137; // dBm (typical for LoRa)
        this.earthRadius = 6371000; // Earth radius in meters
    }

    /**
     * Calculate great circle distance between two points
     * @param {number} lat1 - Latitude 1 in degrees
     * @param {number} lng1 - Longitude 1 in degrees
     * @param {number} lat2 - Latitude 2 in degrees
     * @param {number} lng2 - Longitude 2 in degrees
     * @returns {number} Distance in meters
     */
    calculateDistance(lat1, lng1, lat2, lng2) {
        const R = this.earthRadius;
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distance in meters
    }

    /**
     * Calculate free space path loss
     * @param {number} distance - Distance in meters
     * @returns {number} Path loss in dB
     */
    freeSpacePathLoss(distance) {
        const wavelength = this.c / this.frequency;
        return 20 * Math.log10(4 * Math.PI * distance / wavelength);
    }

    /**
     * Calculate first Fresnel zone radius at a given point
     * @param {number} totalDistance - Total path distance in meters
     * @param {number} distanceFromTx - Distance from transmitter to point in meters
     * @returns {number} Fresnel zone radius in meters
     */
    fresnelRadius(totalDistance, distanceFromTx) {
        const wavelength = this.c / this.frequency;
        const d2 = totalDistance - distanceFromTx;
        return Math.sqrt((wavelength * distanceFromTx * d2) / totalDistance);
    }

    /**
     * Calculate Earth curvature effect
     * @param {number} distance - Distance in meters
     * @param {number} positionRatio - Position along path (0-1)
     * @returns {number} Curvature height in meters
     */
    earthCurvature(distance, positionRatio) {
        const d1 = distance * positionRatio;
        const d2 = distance * (1 - positionRatio);
        return (d1 * d2) / (2 * this.earthRadius);
    }

    /**
     * Analyze terrain profile and calculate obstruction
     * @param {Array} elevationProfile - Array of {distance, elevation} objects
     * @param {number} totalDistance - Total path distance in meters
     * @param {number} txHeight - Transmitter height AGL in meters
     * @param {number} rxHeight - Receiver height AGL in meters
     * @returns {Object} Analysis results
     */
    analyzeTerrainProfile(elevationProfile, totalDistance, txHeight = this.antennaHeight, rxHeight = this.antennaHeight) {
        if (elevationProfile.length < 2) {
            return { clearance: 1.0, obstruction: 0, minClearance: Infinity };
        }

        const startElevation = elevationProfile[0].elevation + txHeight;
        const endElevation = elevationProfile[elevationProfile.length - 1].elevation + rxHeight;
        
        let minClearanceRatio = Infinity;
        let maxObstruction = 0;

        // Check each point along the path
        for (let i = 1; i < elevationProfile.length - 1; i++) {
            const point = elevationProfile[i];
            const positionRatio = point.distance / totalDistance;
            
            // Calculate line-of-sight height at this position
            const losHeight = startElevation + (endElevation - startElevation) * positionRatio;
            
            // Account for Earth curvature
            const curvature = this.earthCurvature(totalDistance, positionRatio);
            const adjustedLosHeight = losHeight - curvature;
            
            // Calculate first Fresnel zone radius
            const fresnelR = this.fresnelRadius(totalDistance, point.distance);
            
            // Required clearance for 60% Fresnel zone clearance
            const requiredHeight = adjustedLosHeight + 0.6 * fresnelR;
            
            // Check obstruction
            const terrainHeight = point.elevation;
            const clearanceHeight = adjustedLosHeight - terrainHeight;
            const clearanceRatio = clearanceHeight / fresnelR;
            
            minClearanceRatio = Math.min(minClearanceRatio, clearanceRatio);
            
            if (terrainHeight > requiredHeight) {
                const obstruction = (terrainHeight - requiredHeight) / fresnelR;
                maxObstruction = Math.max(maxObstruction, obstruction);
            }
        }

        return {
            clearance: Math.max(0, minClearanceRatio),
            obstruction: maxObstruction,
            minClearance: minClearanceRatio
        };
    }

    /**
     * Calculate link budget
     * @param {number} txPower - Transmit power in watts
     * @param {number} rxPower - Receive power in watts (usually same as tx)
     * @param {number} distance - Distance in meters
     * @param {Object} terrainAnalysis - Result from analyzeTerrainProfile
     * @returns {Object} Link budget analysis
     */
    calculateLinkBudget(txPower, rxPower, distance, terrainAnalysis) {
        // Convert power to dBm
        const txPowerDbm = 10 * Math.log10(txPower * 1000);
        
        // Calculate free space path loss
        const pathLoss = this.freeSpacePathLoss(distance);
        
        // Calculate obstruction loss
        let obstructionLoss = 0;
        if (terrainAnalysis.obstruction > 0) {
            // Simplified knife-edge diffraction loss
            const v = terrainAnalysis.obstruction;
            if (v > 0) {
                obstructionLoss = 20 * Math.log10(Math.sqrt(2 * Math.PI * v));
            }
        }
        
        // Add additional loss for partial Fresnel zone clearance
        let fresnelLoss = 0;
        if (terrainAnalysis.clearance < 1.0) {
            fresnelLoss = 6 * (1 - terrainAnalysis.clearance);
        }
        
        // Calculate received signal strength
        const totalGain = 2 * this.antennaGain; // Both antennas
        const receivedPower = txPowerDbm + totalGain - pathLoss - obstructionLoss - fresnelLoss;
        
        // Calculate link margin
        const linkMargin = receivedPower - this.receiverSensitivity;
        
        // Determine link quality
        let quality = 'poor';
        if (linkMargin >= 20) quality = 'good';
        else if (linkMargin >= 10) quality = 'marginal';
        
        return {
            txPowerDbm,
            pathLoss,
            obstructionLoss,
            fresnelLoss,
            receivedPower,
            linkMargin,
            quality,
            distance: distance / 1000, // Convert to km
            terrainAnalysis
        };
    }

    /**
     * Estimate coverage radius based on power and terrain
     * @param {number} power - Transmit power in watts
     * @param {string} terrain - Terrain type ('flat', 'rolling', 'mountainous')
     * @returns {number} Estimated coverage radius in meters
     */
    estimateCoverageRadius(power, terrain = 'rolling') {
        const txPowerDbm = 10 * Math.log10(power * 1000);
        const linkBudget = txPowerDbm + 2 * this.antennaGain - this.receiverSensitivity;
        
        // Terrain factors
        const terrainFactors = {
            flat: 1.0,
            rolling: 0.7,
            mountainous: 0.4
        };
        
        const factor = terrainFactors[terrain] || 0.7;
        
        // Calculate maximum theoretical range
        const maxPathLoss = linkBudget - 20; // 20 dB margin
        const wavelength = this.c / this.frequency;
        const maxDistance = wavelength * Math.pow(10, maxPathLoss / 20) / (4 * Math.PI);
        
        return maxDistance * factor;
    }

    /**
     * Convert degrees to radians
     */
    toRadians(degrees) {
        return degrees * Math.PI / 180;
    }

    /**
     * Convert radians to degrees
     */
    toDegrees(radians) {
        return radians * 180 / Math.PI;
    }
}

module.exports = { RFCalculator };
