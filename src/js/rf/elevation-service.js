/**
 * Elevation Service for Terrain Data Retrieval
 * Supports multiple elevation APIs with fallback and caching
 * Author: K7CFO
 */

export class ElevationService {
    constructor() {
        this.cache = new Map();
        this.cacheTimeout = 1800000; // 30 minutes in milliseconds
        this.maxCacheSize = 1000; // Maximum number of cached profiles
        
        // API endpoints (free services)
        this.apis = {
            // Open-Meteo Elevation API (free, no key required)
            openMeteo: {
                name: 'Open-Meteo',
                url: 'https://api.open-meteo.com/v1/elevation',
                rateLimit: 10000, // requests per day (generous)
                pointsPerRequest: 100 // max points in single request
            },
            
            // OpenTopoData (free, no key required)
            openTopo: {
                name: 'OpenTopoData',
                url: 'https://api.opentopodata.org/v1/aster30m',
                rateLimit: 100, // requests per day for free tier
                pointsPerRequest: 100
            },
            
            // Backup: Manual SRTM data (for offline capability)
            manual: {
                name: 'Manual/Offline',
                enabled: false
            }
        };
        
        this.currentApi = 'openMeteo'; // Default API
        this.requestCount = 0;
        this.lastRequestReset = Date.now();
    }

    /**
     * Get elevation profile between two points
     * 
     * @param {Object} startPoint - {lat, lng}
     * @param {Object} endPoint - {lat, lng}
     * @param {number} samples - Number of elevation samples (default: 50)
     * @returns {Promise<Array>} Array of {distance, lat, lng, elevation} points
     */
    async getElevationProfile(startPoint, endPoint, samples = 50) {
        const cacheKey = `${startPoint.lat},${startPoint.lng}-${endPoint.lat},${endPoint.lng}-${samples}`;
        
        // Check cache first
        const cached = this.getCached(cacheKey);
        if (cached) {
            console.log('Using cached elevation profile');
            return cached;
        }

        try {
            // Generate intermediate points along the path
            const pathPoints = this.generatePathPoints(startPoint, endPoint, samples);
            
            // Get elevation data from API
            let elevationData;
            if (this.currentApi === 'openMeteo') {
                elevationData = await this.getOpenMeteoElevation(pathPoints);
            } else if (this.currentApi === 'openTopo') {
                elevationData = await this.getOpenTopoElevation(pathPoints);
            } else {
                // Fallback to estimated elevation
                elevationData = this.getEstimatedElevation(pathPoints);
            }
            
            // Calculate distances and format results
            const profile = this.formatElevationProfile(elevationData, startPoint, endPoint);
            
            // Cache the results
            this.setCached(cacheKey, profile);
            
            return profile;
            
        } catch (error) {
            console.error('Elevation service error:', error);
            
            // Try fallback API
            if (this.currentApi === 'openMeteo') {
                console.log('Trying OpenTopoData as fallback...');
                this.currentApi = 'openTopo';
                return this.getElevationProfile(startPoint, endPoint, samples);
            }
            
            // If all APIs fail, return estimated profile
            console.log('Using estimated elevation profile');
            const pathPoints = this.generatePathPoints(startPoint, endPoint, samples);
            const estimatedData = this.getEstimatedElevation(pathPoints);
            return this.formatElevationProfile(estimatedData, startPoint, endPoint);
        }
    }

    /**
     * Generate intermediate points along the great circle path
     * 
     * @param {Object} start - {lat, lng}
     * @param {Object} end - {lat, lng}
     * @param {number} samples - Number of points
     * @returns {Array} Array of {lat, lng} points
     */
    generatePathPoints(start, end, samples) {
        const points = [];
        const R = 6371; // Earth radius in km
        
        // Convert to radians
        const lat1 = start.lat * Math.PI / 180;
        const lon1 = start.lng * Math.PI / 180;
        const lat2 = end.lat * Math.PI / 180;
        const lon2 = end.lng * Math.PI / 180;
        
        // Calculate total distance
        const dLat = lat2 - lat1;
        const dLon = lon2 - lon1;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const totalDistance = R * c;
        
        // Generate intermediate points
        for (let i = 0; i < samples; i++) {
            const fraction = i / (samples - 1);
            
            if (fraction === 0) {
                points.push({ lat: start.lat, lng: start.lng });
            } else if (fraction === 1) {
                points.push({ lat: end.lat, lng: end.lng });
            } else {
                // Spherical interpolation
                const A = Math.sin((1 - fraction) * c) / Math.sin(c);
                const B = Math.sin(fraction * c) / Math.sin(c);
                
                const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
                const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
                const z = A * Math.sin(lat1) + B * Math.sin(lat2);
                
                const lat = Math.atan2(z, Math.sqrt(x*x + y*y));
                const lon = Math.atan2(y, x);
                
                points.push({
                    lat: lat * 180 / Math.PI,
                    lng: lon * 180 / Math.PI
                });
            }
        }
        
        return points;
    }

    /**
     * Get elevation data from Open-Meteo API
     * 
     * @param {Array} points - Array of {lat, lng} points
     * @returns {Promise<Array>} Array of {lat, lng, elevation} points
     */
    async getOpenMeteoElevation(points) {
        if (!this.checkRateLimit('openMeteo')) {
            throw new Error('Rate limit exceeded for Open-Meteo');
        }

        // Batch points for API efficiency
        const batches = this.batchPoints(points, this.apis.openMeteo.pointsPerRequest);
        const allResults = [];

        for (const batch of batches) {
            const latitudes = batch.map(p => p.lat).join(',');
            const longitudes = batch.map(p => p.lng).join(',');
            
            const url = `${this.apis.openMeteo.url}?latitude=${latitudes}&longitude=${longitudes}`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Open-Meteo API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Format results
            for (let i = 0; i < batch.length; i++) {
                allResults.push({
                    lat: batch[i].lat,
                    lng: batch[i].lng,
                    elevation: data.elevation[i] || 0
                });
            }
            
            this.requestCount++;
        }

        return allResults;
    }

    /**
     * Get elevation data from OpenTopoData API
     * 
     * @param {Array} points - Array of {lat, lng} points
     * @returns {Promise<Array>} Array of {lat, lng, elevation} points
     */
    async getOpenTopoElevation(points) {
        if (!this.checkRateLimit('openTopo')) {
            throw new Error('Rate limit exceeded for OpenTopoData');
        }

        // Batch points for API efficiency
        const batches = this.batchPoints(points, this.apis.openTopo.pointsPerRequest);
        const allResults = [];

        for (const batch of batches) {
            const locations = batch.map(p => `${p.lat},${p.lng}`).join('|');
            
            const url = `${this.apis.openTopo.url}?locations=${locations}`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`OpenTopoData API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Format results
            data.results.forEach((result, i) => {
                allResults.push({
                    lat: batch[i].lat,
                    lng: batch[i].lng,
                    elevation: result.elevation || 0
                });
            });
            
            this.requestCount++;
        }

        return allResults;
    }

    /**
     * Generate estimated elevation profile (fallback when APIs fail)
     * 
     * @param {Array} points - Array of {lat, lng} points
     * @returns {Array} Array of {lat, lng, elevation} points
     */
    getEstimatedElevation(points) {
        console.log('Using estimated elevation (flat terrain assumed)');
        
        return points.map(point => ({
            lat: point.lat,
            lng: point.lng,
            elevation: 300 // Assume 300m average elevation
        }));
    }

    /**
     * Format elevation profile with distances
     * 
     * @param {Array} elevationData - Array of {lat, lng, elevation} points
     * @param {Object} startPoint - {lat, lng}
     * @param {Object} endPoint - {lat, lng}
     * @returns {Array} Formatted profile with distances
     */
    formatElevationProfile(elevationData, startPoint, endPoint) {
        const totalDistance = this.calculateDistance(startPoint, endPoint);
        const profile = [];
        
        elevationData.forEach((point, i) => {
            const distanceFromStart = i === 0 ? 0 : 
                i === elevationData.length - 1 ? totalDistance :
                (totalDistance * i) / (elevationData.length - 1);
            
            profile.push({
                distance: distanceFromStart, // km from start
                lat: point.lat,
                lng: point.lng,
                elevation: point.elevation // meters
            });
        });
        
        return profile;
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
     * Batch points for API requests
     * 
     * @param {Array} points - Array of points
     * @param {number} batchSize - Maximum points per batch
     * @returns {Array} Array of point batches
     */
    batchPoints(points, batchSize) {
        const batches = [];
        for (let i = 0; i < points.length; i += batchSize) {
            batches.push(points.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * Check if API rate limit allows request
     * 
     * @param {string} apiName - API identifier
     * @returns {boolean} True if request is allowed
     */
    checkRateLimit(apiName) {
        const now = Date.now();
        
        // Reset count daily
        if (now - this.lastRequestReset > 24 * 60 * 60 * 1000) {
            this.requestCount = 0;
            this.lastRequestReset = now;
        }
        
        return this.requestCount < this.apis[apiName].rateLimit;
    }

    /**
     * Get cached elevation profile
     * 
     * @param {string} key - Cache key
     * @returns {Array|null} Cached profile or null
     */
    getCached(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.data;
        }
        
        // Remove expired entry
        if (cached) {
            this.cache.delete(key);
        }
        
        return null;
    }

    /**
     * Cache elevation profile
     * 
     * @param {string} key - Cache key
     * @param {Array} data - Profile data
     */
    setCached(key, data) {
        // Limit cache size
        if (this.cache.size >= this.maxCacheSize) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    /**
     * Clear elevation cache
     */
    clearCache() {
        this.cache.clear();
        console.log('Elevation cache cleared');
    }

    /**
     * Get cache statistics
     * 
     * @returns {Object} Cache statistics
     */
    getCacheStats() {
        const expired = Array.from(this.cache.entries()).filter(
            ([key, value]) => Date.now() - value.timestamp >= this.cacheTimeout
        ).length;
        
        return {
            total: this.cache.size,
            valid: this.cache.size - expired,
            expired: expired,
            requestCount: this.requestCount,
            currentApi: this.currentApi
        };
    }
}

// Create singleton instance
export const elevationService = new ElevationService();
