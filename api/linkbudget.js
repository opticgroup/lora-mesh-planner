// Vercel API endpoint for RF link budget calculations
const { RFCalculator } = require('./rf-utils.js');

const rfCalc = new RFCalculator();

/**
 * Fetch elevation profile and calculate link budget
 */
async function calculateLinkBudgetWithTerrain(lat1, lng1, lat2, lng2, txPower, rxPower) {
    try {
        // First, get elevation profile
        const elevationResponse = await fetch(
            `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/elevation?` +
            `lat1=${lat1}&lng1=${lng1}&lat2=${lat2}&lng2=${lng2}&samples=50`
        );
        
        let elevationProfile = [];
        if (elevationResponse.ok) {
            const elevationData = await elevationResponse.json();
            elevationProfile = elevationData.profile || [];
        }
        
        // If elevation data is not available, create a simple flat profile
        if (elevationProfile.length === 0) {
            const distance = rfCalc.calculateDistance(lat1, lng1, lat2, lng2);
            elevationProfile = [
                { distance: 0, elevation: 100, lat: lat1, lng: lng1 },
                { distance: distance, elevation: 100, lat: lat2, lng: lng2 }
            ];
        }
        
        // Calculate total distance
        const totalDistance = rfCalc.calculateDistance(lat1, lng1, lat2, lng2);
        
        // Analyze terrain profile
        const terrainAnalysis = rfCalc.analyzeTerrainProfile(
            elevationProfile, 
            totalDistance,
            rfCalc.antennaHeight,
            rfCalc.antennaHeight
        );
        
        // Calculate link budget
        const linkBudget = rfCalc.calculateLinkBudget(
            txPower, 
            rxPower, 
            totalDistance, 
            terrainAnalysis
        );
        
        return {
            success: true,
            linkBudget,
            elevationProfile: elevationProfile.length > 10 ? 
                elevationProfile.filter((_, i) => i % Math.ceil(elevationProfile.length / 10) === 0) : 
                elevationProfile, // Reduce profile size for response
            terrainAnalysis,
            metadata: {
                frequency: '915 MHz',
                antennaGain: rfCalc.antennaGain + ' dBi',
                antennaHeight: rfCalc.antennaHeight + ' m',
                receiverSensitivity: rfCalc.receiverSensitivity + ' dBm'
            }
        };
        
    } catch (error) {
        console.error('Link budget calculation error:', error);
        
        // Fallback calculation without terrain data
        const distance = rfCalc.calculateDistance(lat1, lng1, lat2, lng2);
        const simpleTerrain = { clearance: 1.0, obstruction: 0, minClearance: 1.0 };
        const linkBudget = rfCalc.calculateLinkBudget(txPower, rxPower, distance, simpleTerrain);
        
        return {
            success: true,
            linkBudget,
            elevationProfile: [],
            terrainAnalysis: simpleTerrain,
            warning: 'Calculated without terrain data due to elevation service error',
            metadata: {
                frequency: '915 MHz',
                antennaGain: rfCalc.antennaGain + ' dBi',
                antennaHeight: rfCalc.antennaHeight + ' m',
                receiverSensitivity: rfCalc.receiverSensitivity + ' dBm'
            }
        };
    }
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
        // Parse parameters from query string (GET) or body (POST)
        let params;
        if (req.method === 'GET') {
            params = req.query;
        } else {
            params = req.body || {};
        }
        
        const { lat1, lng1, lat2, lng2, txPower, rxPower } = params;
        
        // Validate required parameters
        if (!lat1 || !lng1 || !lat2 || !lng2 || !txPower) {
            res.status(400).json({ 
                error: 'Missing required parameters: lat1, lng1, lat2, lng2, txPower' 
            });
            return;
        }
        
        // Validate numeric parameters
        const numLat1 = parseFloat(lat1);
        const numLng1 = parseFloat(lng1);
        const numLat2 = parseFloat(lat2);
        const numLng2 = parseFloat(lng2);
        const numTxPower = parseFloat(txPower);
        const numRxPower = parseFloat(rxPower) || numTxPower; // Default rx power = tx power
        
        if (isNaN(numLat1) || isNaN(numLng1) || isNaN(numLat2) || isNaN(numLng2) || isNaN(numTxPower)) {
            res.status(400).json({ 
                error: 'Invalid numeric parameters' 
            });
            return;
        }
        
        // Validate coordinate ranges
        if (Math.abs(numLat1) > 90 || Math.abs(numLat2) > 90 || 
            Math.abs(numLng1) > 180 || Math.abs(numLng2) > 180) {
            res.status(400).json({ 
                error: 'Invalid coordinate ranges' 
            });
            return;
        }
        
        // Validate power ranges (0.1W to 5W for LoRa)
        if (numTxPower < 0.1 || numTxPower > 5 || numRxPower < 0.1 || numRxPower > 5) {
            res.status(400).json({ 
                error: 'Power must be between 0.1W and 5W' 
            });
            return;
        }
        
        const result = await calculateLinkBudgetWithTerrain(
            numLat1, numLng1, numLat2, numLng2, 
            numTxPower, numRxPower
        );
        
        res.status(200).json(result);
        
    } catch (error) {
        console.error('Link budget API error:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}
