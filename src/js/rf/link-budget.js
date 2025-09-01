/**
 * LoRa Link Budget Calculator
 * Comprehensive RF analysis for 915 MHz LoRa links
 * Author: K7CFO
 */

import { rfUtils } from './rf-utils.js';
import { elevationService } from './elevation-service.js';

export class LinkBudgetCalculator {
    constructor() {
        // Default antenna and system parameters
        this.defaultParams = {
            // Antenna parameters
            txAntennaGain: 3,        // dBi (typical omni)
            rxAntennaGain: 3,        // dBi (typical omni)
            txAntennaHeight: 10,     // meters above ground
            rxAntennaHeight: 10,     // meters above ground
            
            // System losses
            txCableLoss: 1.5,        // dB
            rxCableLoss: 1.5,        // dB
            connectorLoss: 0.5,      // dB (both ends)
            
            // Environmental factors
            fadeMargin: 15,          // dB (recommended for reliability)
            bodyLoss: 0,             // dB (human body near antenna)
            foliageLoss: 0,          // dB (seasonal variation)
            
            // Polarization and miscellaneous
            polarizationLoss: 0,     // dB (assume matched polarization)
            miscLoss: 1,             // dB (safety margin)
            
            // Default spreading factor
            spreadingFactor: 'SF7'   // Will be optimized automatically
        };
    }

    /**
     * Calculate comprehensive link budget between two points
     * 
     * @param {Object} txPoint - {lat, lng, power} (power in watts)
     * @param {Object} rxPoint - {lat, lng}
     * @param {Object} options - Optional parameters override
     * @returns {Promise<Object>} Complete link analysis
     */
    async calculateLinkBudget(txPoint, rxPoint, options = {}) {
        const params = { ...this.defaultParams, ...options };
        const distance = this.calculateDistance(txPoint, rxPoint);
        
        console.log(`Calculating link budget for ${distance.toFixed(2)}km path`);
        
        try {
            // Get elevation profile
            const elevationProfile = await elevationService.getElevationProfile(
                { lat: txPoint.lat, lng: txPoint.lng },
                { lat: rxPoint.lat, lng: rxPoint.lng },
                50 // 50 sample points
            );
            
            // Analyze terrain and Fresnel clearance
            const terrainAnalysis = this.analyzeTerrainPath(
                elevationProfile,
                params.txAntennaHeight,
                params.rxAntennaHeight,
                distance
            );
            
            // Calculate path loss components
            const pathLoss = this.calculatePathLoss(distance, terrainAnalysis);
            
            // Calculate link budget
            const linkBudget = this.calculateLinkParameters(
                txPoint.power,
                pathLoss,
                params,
                distance
            );
            
            // Determine optimal spreading factor
            const optimalSF = this.optimizeSpreadingFactor(linkBudget, params);
            
            // Generate recommendations
            const recommendations = this.generateRecommendations(
                linkBudget,
                terrainAnalysis,
                optimalSF,
                params
            );
            
            return {
                distance: distance,
                pathLoss: pathLoss,
                linkBudget: linkBudget,
                terrainAnalysis: terrainAnalysis,
                optimalSpreadingFactor: optimalSF,
                recommendations: recommendations,
                elevationProfile: elevationProfile,
                linkQuality: this.assessLinkQuality(linkBudget, terrainAnalysis),
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Link budget calculation error:', error);
            
            // Fallback calculation without elevation data
            const fallbackPathLoss = this.calculateBasicPathLoss(distance);
            const fallbackLinkBudget = this.calculateLinkParameters(
                txPoint.power,
                fallbackPathLoss,
                params,
                distance
            );
            
            return {
                distance: distance,
                pathLoss: fallbackPathLoss,
                linkBudget: fallbackLinkBudget,
                terrainAnalysis: { error: 'Elevation data unavailable', hasObstructions: false },
                optimalSpreadingFactor: rfUtils.getOptimalSpreadingFactor(distance),
                recommendations: ['Elevation data unavailable - using simplified calculations'],
                linkQuality: this.assessLinkQuality(fallbackLinkBudget, { hasObstructions: false }),
                fallback: true,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Calculate path loss with terrain consideration
     * 
     * @param {number} distance - Distance in km
     * @param {Object} terrainAnalysis - Terrain analysis results
     * @returns {Object} Path loss breakdown
     */
    calculatePathLoss(distance, terrainAnalysis) {
        // Free Space Path Loss (FSPL)
        const fspl = rfUtils.calculateFSPL(distance);
        
        // Terrain-based additional losses
        let terrainLoss = 0;
        let diffractionLoss = 0;
        
        if (terrainAnalysis.hasObstructions) {
            // Calculate diffraction loss for worst obstruction
            const worstObstruction = terrainAnalysis.obstructions.reduce((worst, current) => 
                current.obstruction > worst.obstruction ? current : worst
            );
            
            const d1 = worstObstruction.distance;
            const d2 = distance - d1;
            diffractionLoss = rfUtils.calculateKnifeEdgeLoss(
                worstObstruction.obstruction,
                d1,
                d2
            );
            
            // Additional terrain loss for multiple obstructions
            if (terrainAnalysis.obstructions.length > 1) {
                terrainLoss = Math.min(10, terrainAnalysis.obstructions.length * 2);
            }
        }
        
        // Environmental losses
        let foliageLoss = 0;
        if (distance < 1) {
            foliageLoss = 0; // Minimal foliage loss for short paths
        } else if (distance < 5) {
            foliageLoss = 3; // Light foliage loss
        } else {
            foliageLoss = 6; // Moderate foliage loss for longer paths
        }
        
        const totalPathLoss = fspl + diffractionLoss + terrainLoss + foliageLoss;
        
        return {
            freeSpace: fspl,
            diffraction: diffractionLoss,
            terrain: terrainLoss,
            foliage: foliageLoss,
            total: totalPathLoss,
            breakdown: {
                'Free Space Path Loss': fspl.toFixed(1) + ' dB',
                'Diffraction Loss': diffractionLoss.toFixed(1) + ' dB',
                'Terrain Loss': terrainLoss.toFixed(1) + ' dB',
                'Foliage Loss': foliageLoss.toFixed(1) + ' dB',
                'Total Path Loss': totalPathLoss.toFixed(1) + ' dB'
            }
        };
    }

    /**
     * Calculate basic path loss without terrain data (fallback)
     * 
     * @param {number} distance - Distance in km
     * @returns {Object} Basic path loss
     */
    calculateBasicPathLoss(distance) {
        const fspl = rfUtils.calculateFSPL(distance);
        const environmentalMargin = distance > 10 ? 10 : 5; // Extra margin for uncertainty
        const total = fspl + environmentalMargin;
        
        return {
            freeSpace: fspl,
            diffraction: 0,
            terrain: 0,
            foliage: environmentalMargin,
            total: total,
            breakdown: {
                'Free Space Path Loss': fspl.toFixed(1) + ' dB',
                'Environmental Margin': environmentalMargin.toFixed(1) + ' dB',
                'Total Path Loss': total.toFixed(1) + ' dB'
            }
        };
    }

    /**
     * Calculate complete link parameters
     * 
     * @param {number} txPowerWatts - Transmit power in watts
     * @param {Object} pathLoss - Path loss analysis
     * @param {Object} params - System parameters
     * @param {number} distance - Distance in km
     * @returns {Object} Link budget breakdown
     */
    calculateLinkParameters(txPowerWatts, pathLoss, params, distance) {
        // Convert transmit power to dBm
        const txPowerDbm = rfUtils.wattsToDbm(txPowerWatts);
        
        // Calculate EIRP (Effective Isotropic Radiated Power)
        const eirp = txPowerDbm + params.txAntennaGain - params.txCableLoss - params.connectorLoss;
        
        // Calculate received signal strength
        const rxSignalStrength = eirp - pathLoss.total + params.rxAntennaGain - 
                                params.rxCableLoss - params.connectorLoss;
        
        // System losses
        const systemLosses = params.txCableLoss + params.rxCableLoss + 
                            (params.connectorLoss * 2) + params.miscLoss + params.bodyLoss;
        
        // Get optimal spreading factor and corresponding sensitivity
        const optimalSF = rfUtils.getOptimalSpreadingFactor(distance);
        const rxSensitivity = rfUtils.loraParams.sensitivity[optimalSF];
        
        // Calculate link margin
        const linkMargin = rxSignalStrength - rxSensitivity - params.fadeMargin;
        
        return {
            // Transmit side
            txPowerDbm: txPowerDbm,
            txPowerWatts: txPowerWatts,
            txAntennaGain: params.txAntennaGain,
            eirp: eirp,
            
            // Path
            pathLossDb: pathLoss.total,
            distance: distance,
            
            // Receive side
            rxSignalStrength: rxSignalStrength,
            rxAntennaGain: params.rxAntennaGain,
            rxSensitivity: rxSensitivity,
            spreadingFactor: optimalSF,
            
            // Link performance
            linkMargin: linkMargin,
            fadeMargin: params.fadeMargin,
            systemLosses: systemLosses,
            
            // Link status
            isViable: linkMargin > 0,
            reliability: this.calculateReliability(linkMargin),
            
            // Formatted summary
            summary: {
                'TX Power': `${txPowerWatts}W (${txPowerDbm.toFixed(1)} dBm)`,
                'EIRP': `${eirp.toFixed(1)} dBm`,
                'Path Loss': `${pathLoss.total.toFixed(1)} dB`,
                'RX Signal': `${rxSignalStrength.toFixed(1)} dBm`,
                'RX Sensitivity': `${rxSensitivity} dBm (${optimalSF})`,
                'Link Margin': `${linkMargin.toFixed(1)} dB`,
                'Link Status': linkMargin > 0 ? '✅ Viable' : '❌ Not Viable'
            }
        };
    }

    /**
     * Analyze terrain path for obstructions and Fresnel clearance
     * 
     * @param {Array} elevationProfile - Elevation profile points
     * @param {number} txHeight - TX antenna height
     * @param {number} rxHeight - RX antenna height
     * @param {number} distance - Total distance
     * @returns {Object} Terrain analysis
     */
    analyzeTerrainPath(elevationProfile, txHeight, rxHeight, distance) {
        const fresnelAnalysis = rfUtils.analyzeFresnelClearance(
            elevationProfile,
            txHeight,
            rxHeight,
            distance
        );
        
        // Additional terrain analysis
        const elevationVariation = this.calculateElevationVariation(elevationProfile);
        const lineOfSightClear = this.checkLineOfSight(elevationProfile, txHeight, rxHeight);
        
        return {
            hasObstructions: !fresnelAnalysis.hasAdequateClearance,
            obstructions: fresnelAnalysis.obstructions,
            fresnelClearance: fresnelAnalysis.requiredClearancePercent,
            minClearance: fresnelAnalysis.minClearance,
            lineOfSight: lineOfSightClear,
            elevationVariation: elevationVariation,
            profile: elevationProfile
        };
    }

    /**
     * Calculate elevation variation statistics
     * 
     * @param {Array} profile - Elevation profile
     * @returns {Object} Elevation statistics
     */
    calculateElevationVariation(profile) {
        const elevations = profile.map(p => p.elevation);
        const min = Math.min(...elevations);
        const max = Math.max(...elevations);
        const avg = elevations.reduce((a, b) => a + b, 0) / elevations.length;
        
        return {
            min: min,
            max: max,
            average: avg,
            variation: max - min,
            roughness: this.calculateRoughness(elevations)
        };
    }

    /**
     * Calculate terrain roughness
     * 
     * @param {Array} elevations - Elevation values
     * @returns {number} Roughness factor
     */
    calculateRoughness(elevations) {
        let totalVariation = 0;
        for (let i = 1; i < elevations.length; i++) {
            totalVariation += Math.abs(elevations[i] - elevations[i-1]);
        }
        return totalVariation / (elevations.length - 1);
    }

    /**
     * Check basic line of sight clearance
     * 
     * @param {Array} profile - Elevation profile
     * @param {number} txHeight - TX antenna height
     * @param {number} rxHeight - RX antenna height
     * @returns {boolean} True if line of sight is clear
     */
    checkLineOfSight(profile, txHeight, rxHeight) {
        if (profile.length < 3) return true;
        
        const start = profile[0];
        const end = profile[profile.length - 1];
        const totalDistance = end.distance;
        
        const txElevation = start.elevation + txHeight;
        const rxElevation = end.elevation + rxHeight;
        
        // Check each intermediate point
        for (let i = 1; i < profile.length - 1; i++) {
            const point = profile[i];
            const fraction = point.distance / totalDistance;
            
            // Calculate line of sight height at this point
            const losHeight = txElevation + (rxElevation - txElevation) * fraction;
            
            // Add Earth curvature
            const curvature = rfUtils.calculateEarthCurvature(totalDistance, fraction);
            const adjustedLosHeight = losHeight + curvature;
            
            if (point.elevation > adjustedLosHeight) {
                return false; // Obstruction found
            }
        }
        
        return true;
    }

    /**
     * Optimize spreading factor based on link conditions
     * 
     * @param {Object} linkBudget - Link budget analysis
     * @param {Object} params - System parameters
     * @returns {string} Optimal spreading factor
     */
    optimizeSpreadingFactor(linkBudget, params) {
        const distance = linkBudget.distance;
        const linkMargin = linkBudget.linkMargin;
        
        // Start with distance-based recommendation
        let optimalSF = rfUtils.getOptimalSpreadingFactor(distance);
        
        // Adjust based on link margin
        if (linkMargin < -10) {
            // Very poor link - need maximum sensitivity
            optimalSF = 'SF12';
        } else if (linkMargin < -5) {
            // Poor link - need higher sensitivity
            optimalSF = 'SF11';
        } else if (linkMargin < 0) {
            // Marginal link
            optimalSF = 'SF10';
        } else if (linkMargin > 20) {
            // Excellent link - can use faster data rate
            optimalSF = distance < 5 ? 'SF7' : 'SF8';
        }
        
        return optimalSF;
    }

    /**
     * Calculate link reliability percentage
     * 
     * @param {number} linkMargin - Link margin in dB
     * @returns {number} Reliability percentage
     */
    calculateReliability(linkMargin) {
        if (linkMargin < -10) return 0;
        if (linkMargin < 0) return 50 + (linkMargin + 10) * 5;
        if (linkMargin < 20) return 90 + linkMargin * 0.5;
        return 99.9;
    }

    /**
     * Assess overall link quality
     * 
     * @param {Object} linkBudget - Link budget analysis
     * @param {Object} terrainAnalysis - Terrain analysis
     * @returns {string} Quality assessment
     */
    assessLinkQuality(linkBudget, terrainAnalysis) {
        const margin = linkBudget.linkMargin;
        const hasObstructions = terrainAnalysis.hasObstructions;
        
        if (margin < -5) return 'poor';
        if (margin < 5 || hasObstructions) return 'marginal';
        if (margin < 15) return 'good';
        return 'excellent';
    }

    /**
     * Generate recommendations for link improvement
     * 
     * @param {Object} linkBudget - Link budget analysis
     * @param {Object} terrainAnalysis - Terrain analysis
     * @param {string} optimalSF - Optimal spreading factor
     * @param {Object} params - System parameters
     * @returns {Array} Array of recommendation strings
     */
    generateRecommendations(linkBudget, terrainAnalysis, optimalSF, params) {
        const recommendations = [];
        const margin = linkBudget.linkMargin;
        
        if (margin < 0) {
            recommendations.push(`⚠️ Link margin is ${margin.toFixed(1)}dB - connection may be unreliable`);
        }
        
        if (terrainAnalysis.hasObstructions) {
            const worstObstruction = terrainAnalysis.obstructions[0];
            recommendations.push(`🏔️ Terrain obstruction detected at ${worstObstruction.distance.toFixed(1)}km`);
            
            const requiredHeight = Math.ceil(worstObstruction.obstruction + 5);
            recommendations.push(`📡 Consider raising antennas by ${requiredHeight}m to clear obstacles`);
        }
        
        if (linkBudget.distance > 15) {
            recommendations.push(`📏 Long distance path (${linkBudget.distance.toFixed(1)}km) - consider repeaters`);
        }
        
        if (optimalSF !== 'SF7') {
            recommendations.push(`⚡ Use ${optimalSF} for optimal range vs. data rate balance`);
        }
        
        if (margin > 0 && margin < 10) {
            recommendations.push(`✅ Link is viable but consider adding fade margin for reliability`);
        } else if (margin >= 10) {
            recommendations.push(`🚀 Excellent link quality - reliable operation expected`);
        }
        
        // Power recommendations
        if (linkBudget.txPowerWatts < 1 && margin < 5) {
            recommendations.push(`🔋 Consider increasing transmit power to 1W for better link margin`);
        }
        
        return recommendations;
    }

    /**
     * Calculate great circle distance between two points
     * 
     * @param {Object} point1 - {lat, lng}
     * @param {Object} point2 - {lat, lng}
     * @returns {number} Distance in kilometers
     */
    calculateDistance(point1, point2) {
        const R = 6371; // Earth's radius in km
        const dLat = (point2.lat - point1.lat) * Math.PI / 180;
        const dLng = (point2.lng - point1.lng) * Math.PI / 180;
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    /**
     * Format link budget results for display
     * 
     * @param {Object} results - Link budget results
     * @returns {Object} Formatted results for UI
     */
    formatForDisplay(results) {
        return {
            distance: `${results.distance.toFixed(2)} km`,
            linkQuality: results.linkQuality,
            linkMargin: `${results.linkBudget.linkMargin.toFixed(1)} dB`,
            pathLoss: `${results.pathLoss.total.toFixed(1)} dB`,
            rxSignal: `${results.linkBudget.rxSignalStrength.toFixed(1)} dBm`,
            spreadingFactor: results.optimalSpreadingFactor,
            reliability: `${results.linkBudget.reliability.toFixed(1)}%`,
            recommendations: results.recommendations,
            hasObstructions: results.terrainAnalysis.hasObstructions,
            timestamp: results.timestamp
        };
    }
}

// Create singleton instance
export const linkBudgetCalculator = new LinkBudgetCalculator();
