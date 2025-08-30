// Development server that handles both frontend and API endpoints
const express = require('express');
const path = require('path');
const { createServer } = require('vite');

async function createDevServer() {
    const app = express();
    
    // Enable JSON parsing for API endpoints
    app.use(express.json());
    
    // Import API handlers
    const elevationHandler = require('./api/elevation.js');
    const linkbudgetHandler = require('./api/linkbudget.js');
    const coverageHandler = require('./api/coverage.js');
    
    // API routes
    app.use('/api/elevation', async (req, res) => {
        try {
            await elevationHandler.default(req, res);
        } catch (error) {
            console.error('Elevation API error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    
    app.use('/api/linkbudget', async (req, res) => {
        try {
            await linkbudgetHandler.default(req, res);
        } catch (error) {
            console.error('Link budget API error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    
    app.use('/api/coverage', async (req, res) => {
        try {
            await coverageHandler.default(req, res);
        } catch (error) {
            console.error('Coverage API error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });
    
    // Create Vite server for frontend
    const vite = await createServer({
        server: { middlewareMode: true },
        appType: 'spa',
        root: 'src',
        publicDir: '../public',
        build: {
            outDir: '../dist'
        }
    });
    
    // Use Vite's connect instance as middleware
    app.use(vite.ssrFixStacktrace);
    app.use(vite.middlewares);
    
    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`🚀 Dev server running at http://localhost:${port}`);
        console.log('📡 API endpoints available:');
        console.log(`   /api/elevation`);
        console.log(`   /api/linkbudget`);
        console.log(`   /api/coverage`);
    });
}

createDevServer().catch(error => {
    console.error('Failed to start dev server:', error);
    process.exit(1);
});
