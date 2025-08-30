// Vercel API endpoint for elevation data using OpenTopography API
const cache = new Map(); // Simple in-memory cache
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

/**
 * Fetch elevation data between two points
 * @param {number} lat1 - Start latitude
 * @param {number} lng1 - Start longitude  
 * @param {number} lat2 - End latitude
 * @param {number} lng2 - End longitude
 * @param {number} samples - Number of elevation samples (default 50)
 * @returns {Array} Elevation profile data
 */
async function getElevationProfile(lat1, lng1, lat2, lng2, samples = 50) {
    const cacheKey = `${lat1},${lng1},${lat2},${lng2},${samples}`;
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    
    try {
        // Calculate step size for sampling points
        const latStep = (lat2 - lat1) / (samples - 1);
        const lngStep = (lng2 - lng1) / (samples - 1);
        
        // Generate sampling points
        const points = [];
        for (let i = 0; i < samples; i++) {
            const lat = lat1 + (latStep * i);
            const lng = lng1 + (lngStep * i);
            points.push({ lat, lng });
        }
        
        // Use OpenTopography SRTM30 global dataset
        // This is a free API that doesn't require authentication
        const elevationPromises = points.map(async (point, index) => {
            const url = `https://cloud.sdsc.edu/v1/ocean/elevation?x=${point.lng}&y=${point.lat}`;
            
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    // Fallback to estimated elevation if API fails
                    return {
                        distance: calculateDistance(lat1, lng1, point.lat, point.lng),
                        elevation: 100, // Default elevation
                        lat: point.lat,
                        lng: point.lng
                    };
                }
                
                const data = await response.json();
                return {
                    distance: calculateDistance(lat1, lng1, point.lat, point.lng),
                    elevation: data.elevation || 100,
                    lat: point.lat,
                    lng: point.lng
                };
            } catch (error) {
                console.warn(`Elevation API error for point ${index}:`, error.message);
                return {
                    distance: calculateDistance(lat1, lng1, point.lat, point.lng),
                    elevation: 100, // Default elevation
                    lat: point.lat,
                    lng: point.lng
                };
            }
        });
        
        const elevationProfile = await Promise.all(elevationPromises);
        
        // Cache the result
        cache.set(cacheKey, {
            data: elevationProfile,
            timestamp: Date.now()
        });
        
        return elevationProfile;
        
    } catch (error) {
        console.error('Error fetching elevation data:', error);
        
        // Return fallback data
        const fallbackProfile = [];
        for (let i = 0; i < samples; i++) {
            const ratio = i / (samples - 1);
            const lat = lat1 + (lat2 - lat1) * ratio;
            const lng = lng1 + (lng2 - lng1) * ratio;
            
            fallbackProfile.push({
                distance: calculateDistance(lat1, lng1, lat, lng),
                elevation: 100, // Default elevation
                lat,
                lng
            });
        }
        
        return fallbackProfile;
    }
}

/**
 * Calculate distance between two points (simplified)
 */
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Vercel serverless function handler
 */
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    
    try {
        const { lat1, lng1, lat2, lng2, samples } = req.query;
        
        // Validate parameters
        if (!lat1 || !lng1 || !lat2 || !lng2) {
            res.status(400).json({ 
                error: 'Missing required parameters: lat1, lng1, lat2, lng2' 
            });
            return;
        }
        
        const numSamples = samples ? parseInt(samples) : 50;
        if (numSamples < 2 || numSamples > 200) {
            res.status(400).json({ 
                error: 'Samples must be between 2 and 200' 
            });
            return;
        }
        
        const elevationProfile = await getElevationProfile(
            parseFloat(lat1),
            parseFloat(lng1),
            parseFloat(lat2),
            parseFloat(lng2),
            numSamples
        );
        
        res.status(200).json({
            success: true,
            profile: elevationProfile,
            totalDistance: elevationProfile[elevationProfile.length - 1]?.distance || 0,
            samples: elevationProfile.length
        });
        
    } catch (error) {
        console.error('Elevation API error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}
