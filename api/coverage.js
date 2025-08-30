// Vercel API endpoint for generating terrain-based coverage polygons
const { RFCalculator } = require('./rf-utils.js');

const rfCalc = new RFCalculator();

/**
 * Generate coverage polygon for a transmitter location
 * @param {number} lat - Transmitter latitude
 * @param {number} lng - Transmitter longitude  
 * @param {number} power - Transmit power in watts
 * @param {number} resolution - Angular resolution in degrees (default 15)
 * @param {number} maxRange - Maximum range to check in km (default 30)
 * @returns {Object} Coverage polygon data
 */
async function generateCoveragePolygon(lat, lng, power, resolution = 10, maxRange = 30) {
    const coveragePoints = [];
    const angles = [];
    
    console.log(`Generating coverage polygon for ${lat}, ${lng} at ${power}W with ${resolution}° resolution`);
    
    // Generate angles around the transmitter with higher resolution
    for (let angle = 0; angle < 360; angle += resolution) {
        angles.push(angle);
    }
    
    // Calculate coverage in each direction with batching to avoid overwhelming the elevation API
    const batchSize = 8; // Process 8 directions at a time
    const results = [];
    
    for (let i = 0; i < angles.length; i += batchSize) {
        const batch = angles.slice(i, i + batchSize);
        const batchPromises = batch.map(async (angle) => {
            return await calculateCoverageInDirection(lat, lng, power, angle, maxRange);
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        // Small delay between batches to be respectful to the elevation API
        if (i + batchSize < angles.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    // Build polygon points
    results.forEach((result, index) => {
        if (result && result.coverageDistance > 0) {
            coveragePoints.push({
                lat: result.lat,
                lng: result.lng,
                distance: result.coverageDistance,
                angle: angles[index],
                linkMargin: result.linkMargin || 10
            });
        }
    });
    
    console.log(`Generated ${coveragePoints.length} coverage points`);
    
    // Ensure we have a minimum viable polygon
    if (coveragePoints.length < 3) {
        console.warn('Insufficient coverage points, using fallback circle');
        // Generate a simple circle as fallback
        const fallbackRadius = power >= 1.0 ? 10 : 6; // km
        for (let angle = 0; angle < 360; angle += 30) {
            const point = calculateDestination(lat, lng, angle, fallbackRadius);
            coveragePoints.push({
                lat: point.lat,
                lng: point.lng,
                distance: fallbackRadius,
                angle: angle,
                linkMargin: 15
            });
        }
    }
    
    const maxRange = coveragePoints.length > 0 ? Math.max(...coveragePoints.map(p => p.distance)) : 0;
    const avgRange = coveragePoints.length > 0 ? coveragePoints.reduce((sum, p) => sum + p.distance, 0) / coveragePoints.length : 0;
    
    return {
        success: true,
        transmitter: { lat, lng, power },
        polygon: coveragePoints,
        maxRange,
        avgRange,
        pointCount: coveragePoints.length
    };
}

/**
 * Calculate coverage distance in a specific direction
 */
async function calculateCoverageInDirection(txLat, txLng, power, bearing, maxRange) {
    const stepSize = 0.5; // km steps
    const minLinkMargin = 10; // dB minimum for coverage
    let lastGoodDistance = 0;
    let lastGoodPoint = { lat: txLat, lng: txLng };
    
    // Step outward from transmitter
    for (let distance = stepSize; distance <= maxRange; distance += stepSize) {
        const point = calculateDestination(txLat, txLng, bearing, distance);
        
        try {
            // Get elevation profile for this ray
            const elevationResponse = await fetch(
                `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/elevation?` +
                `lat1=${txLat}&lng1=${txLng}&lat2=${point.lat}&lng2=${point.lng}&samples=20`
            );
            
            let elevationProfile = [];
            if (elevationResponse.ok) {
                const elevationData = await elevationResponse.json();
                elevationProfile = elevationData.profile || [];
            }
            
            // Fallback if elevation data unavailable
            if (elevationProfile.length === 0) {
                const distanceM = distance * 1000;
                elevationProfile = [
                    { distance: 0, elevation: 100, lat: txLat, lng: txLng },
                    { distance: distanceM, elevation: 100, lat: point.lat, lng: point.lng }
                ];
            }
            
            // Calculate terrain analysis
            const totalDistance = distance * 1000; // Convert to meters
            const terrainAnalysis = rfCalc.analyzeTerrainProfile(
                elevationProfile,
                totalDistance,
                rfCalc.antennaHeight,
                rfCalc.antennaHeight
            );
            
            // Calculate link budget
            const linkBudget = rfCalc.calculateLinkBudget(
                power,
                power, // Assume same power receiver
                totalDistance,
                terrainAnalysis
            );
            
            // Check if link is still viable
            if (linkBudget.linkMargin >= minLinkMargin) {
                lastGoodDistance = distance;
                lastGoodPoint = point;
            } else {
                // Signal dropped below threshold, return last good point
                break;
            }
            
        } catch (error) {
            console.warn(`Coverage calculation error at ${distance}km on bearing ${bearing}:`, error.message);
            // Use simple distance-based fallback
            const estimatedRange = power >= 1.0 ? 15 : 8; // km
            if (distance <= estimatedRange) {
                lastGoodDistance = distance;
                lastGoodPoint = point;
            } else {
                break;
            }
        }
    }
    
    return {
        lat: lastGoodPoint.lat,
        lng: lastGoodPoint.lng,
        coverageDistance: lastGoodDistance,
        linkMargin: 10 // Minimum threshold
    };
}

/**
 * Calculate destination point given start point, bearing, and distance
 * @param {number} lat - Starting latitude
 * @param {number} lng - Starting longitude
 * @param {number} bearing - Bearing in degrees
 * @param {number} distance - Distance in km
 * @returns {Object} Destination point {lat, lng}
 */
function calculateDestination(lat, lng, bearing, distance) {
    const R = 6371; // Earth radius in km
    const bearingRad = bearing * Math.PI / 180;
    const latRad = lat * Math.PI / 180;
    const lngRad = lng * Math.PI / 180;
    
    const newLatRad = Math.asin(
        Math.sin(latRad) * Math.cos(distance / R) +
        Math.cos(latRad) * Math.sin(distance / R) * Math.cos(bearingRad)
    );
    
    const newLngRad = lngRad + Math.atan2(
        Math.sin(bearingRad) * Math.sin(distance / R) * Math.cos(latRad),
        Math.cos(distance / R) - Math.sin(latRad) * Math.sin(newLatRad)
    );
    
    return {
        lat: newLatRad * 180 / Math.PI,
        lng: newLngRad * 180 / Math.PI
    };
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
    
    if (req.method !== 'POST' && req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    
    try {
        // Parse parameters
        let params;
        if (req.method === 'GET') {
            params = req.query;
        } else {
            params = req.body || {};
        }
        
        const { lat, lng, power, resolution, maxRange } = params;
        
        // Validate required parameters
        if (!lat || !lng || !power) {
            res.status(400).json({ 
                error: 'Missing required parameters: lat, lng, power' 
            });
            return;
        }
        
        const numLat = parseFloat(lat);
        const numLng = parseFloat(lng);
        const numPower = parseFloat(power);
        const numResolution = resolution ? parseFloat(resolution) : 15;
        const numMaxRange = maxRange ? parseFloat(maxRange) : 30;
        
        // Validate parameters
        if (isNaN(numLat) || isNaN(numLng) || isNaN(numPower)) {
            res.status(400).json({ error: 'Invalid numeric parameters' });
            return;
        }
        
        if (Math.abs(numLat) > 90 || Math.abs(numLng) > 180) {
            res.status(400).json({ error: 'Invalid coordinate ranges' });
            return;
        }
        
        if (numPower < 0.1 || numPower > 5) {
            res.status(400).json({ error: 'Power must be between 0.1W and 5W' });
            return;
        }
        
        if (numResolution < 5 || numResolution > 90) {
            res.status(400).json({ error: 'Resolution must be between 5 and 90 degrees' });
            return;
        }
        
        const result = await generateCoveragePolygon(
            numLat, numLng, numPower, numResolution, numMaxRange
        );
        
        res.status(200).json(result);
        
    } catch (error) {
        console.error('Coverage API error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}
