// LoRa Mesh Network Planner - Main Application
import { linkBudgetCalculator } from './rf/link-budget.js';

class LoRaMeshPlanner {
    constructor() {
        this.map = null;
        this.transmitters = new Map(); // Store transmitter data
        this.linkLines = new Map(); // Store link polylines
        this.coverageCircles = new Map(); // Store coverage areas
        this.currentPower = 0.15; // Default 0.15W
        this.showCoverage = false;
        this.coverageOpacity = 0.3;
        
        // Map layer definitions
        this.mapLayers = {
            street: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap contributors'
            }),
            satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                maxZoom: 19,
                attribution: '© Esri'
            }),
            topo: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                maxZoom: 17,
                attribution: '© OpenTopoMap contributors'
            })
        };
        
        this.init();
    }

    init() {
        this.initMap();
        this.bindEvents();
        this.initPowerDropdown();
        this.loadFromStorage();
    }

    initMap() {
        // Initialize map centered on US (can be changed by user)
        this.map = L.map('map').setView([39.8283, -98.5795], 4);
        
        // Add default layer (street)
        this.mapLayers.street.addTo(this.map);
        
        // Add scale bar
        L.control.scale().addTo(this.map);
        
        // Add custom control for instructions
        const instructionsControl = L.control({ position: 'bottomleft' });
        instructionsControl.onAdd = function() {
            const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
            div.innerHTML = '<small>💡 Click map to add transmitter</small>';
            div.style.backgroundColor = 'rgba(255,255,255,0.9)';
            div.style.padding = '5px 8px';
            div.style.fontSize = '11px';
            return div;
        };
        instructionsControl.addTo(this.map);
        
        // Bind map click event for transmitter placement
        this.map.on('click', (e) => this.addTransmitter(e.latlng));
    }

    initPowerDropdown() {
        // Ensure the power dropdown shows the default value
        const powerSelect = document.getElementById('powerSelect');
        if (powerSelect) {
            powerSelect.value = this.currentPower;
            console.log(`Power dropdown initialized to ${this.currentPower}W`);
        }
    }

    bindEvents() {
        // Layer switching
        document.querySelectorAll('input[name="mapLayer"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.switchMapLayer(e.target.value);
            });
        });
        
        // Power selection
        document.getElementById('powerSelect').addEventListener('change', (e) => {
            this.currentPower = parseFloat(e.target.value);
            this.updateAllLinks(); // Recalculate links with new power
        });
        
        // Clear button
        document.getElementById('clearButton').addEventListener('click', () => {
            this.clearAll();
        });
        
        // Coverage toggle
        document.getElementById('showCoverage').addEventListener('change', (e) => {
            this.showCoverage = e.target.checked;
            this.toggleCoverage();
        });
        
        // Transparency slider
        const slider = document.getElementById('transparencySlider');
        const valueDisplay = document.getElementById('transparencyValue');
        
        slider.addEventListener('input', (e) => {
            this.coverageOpacity = e.target.value / 100;
            valueDisplay.textContent = e.target.value + '%';
            this.updateCoverageOpacity();
        });
    }

    switchMapLayer(layerType) {
        // Remove current layer
        Object.values(this.mapLayers).forEach(layer => {
            if (this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
            }
        });
        
        // Add new layer
        if (this.mapLayers[layerType]) {
            this.mapLayers[layerType].addTo(this.map);
        }
    }

    addTransmitter(latlng) {
        const id = 'tx_' + Date.now();
        const marker = L.marker(latlng, {
            draggable: true,
            icon: this.createTransmitterIcon(this.currentPower)
        }).addTo(this.map);
        
        // Store transmitter data
        const transmitterData = {
            id: id,
            marker: marker,
            latlng: latlng,
            power: this.currentPower,
            name: `TX-${this.transmitters.size + 1}`
        };
        
        this.transmitters.set(id, transmitterData);
        
        // Bind marker events
        marker.on('dragend', () => {
            transmitterData.latlng = marker.getLatLng();
            this.updateLinksForTransmitter(id);
            this.saveToStorage();
        });
        
        // Add popup
        marker.bindPopup(this.createTransmitterPopup(transmitterData));
        
        // Add context menu (right-click)
        marker.on('contextmenu', (e) => {
            this.showTransmitterMenu(e, transmitterData);
        });
        
        // Update display and recalculate links
        this.updateStats();
        this.updateLinksForTransmitter(id);
        this.saveToStorage();
        
        console.log(`Added transmitter ${id} at ${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)} with ${this.currentPower}W`);
    }

    createTransmitterIcon(power) {
        const color = power >= 1.0 ? '#ef4444' : '#f59e0b'; // Red for 1W, Orange for 0.15W
        const size = power >= 1.0 ? 12 : 8;
        
        return L.divIcon({
            html: `<div style="background: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
            className: 'transmitter-icon',
            iconSize: [size + 4, size + 4],
            iconAnchor: [size/2 + 2, size/2 + 2]
        });
    }

    createTransmitterPopup(transmitterData) {
        return `
            <div class="transmitter-popup">
                <h4>${transmitterData.name}</h4>
                <p class="power-info">Power: ${transmitterData.power}W</p>
                <p>Location: ${transmitterData.latlng.lat.toFixed(5)}, ${transmitterData.latlng.lng.toFixed(5)}</p>
                <small>Right-click for options</small>
            </div>
        `;
    }

    showTransmitterMenu(e, transmitterData) {
        // Simple implementation - in a full app, you'd want a proper context menu
        const options = [
            `Delete ${transmitterData.name}`,
            `Toggle Power (currently ${transmitterData.power}W)`,
            'Rename'
        ];
        
        const choice = prompt('Options:\n1. Delete\n2. Toggle Power\n3. Rename\n\nEnter choice (1-3):');
        
        switch (choice) {
            case '1':
                this.removeTransmitter(transmitterData.id);
                break;
            case '2':
                this.toggleTransmitterPower(transmitterData.id);
                break;
            case '3':
                const newName = prompt('Enter new name:', transmitterData.name);
                if (newName) {
                    transmitterData.name = newName;
                    transmitterData.marker.setPopupContent(this.createTransmitterPopup(transmitterData));
                    this.saveToStorage();
                }
                break;
        }
    }

    removeTransmitter(id) {
        const transmitterData = this.transmitters.get(id);
        if (!transmitterData) return;
        
        // Remove from map
        this.map.removeLayer(transmitterData.marker);
        
        // Remove associated links and coverage
        this.removeLinkLines(id);
        this.removeCoverageCircle(id);
        
        // Remove from storage
        this.transmitters.delete(id);
        
        this.updateStats();
        this.saveToStorage();
        
        console.log(`Removed transmitter ${id}`);
    }

    toggleTransmitterPower(id) {
        const transmitterData = this.transmitters.get(id);
        if (!transmitterData) return;
        
        // Toggle between 0.15W and 1W
        transmitterData.power = transmitterData.power >= 1.0 ? 0.15 : 1.0;
        
        // Update icon
        transmitterData.marker.setIcon(this.createTransmitterIcon(transmitterData.power));
        
        // Update popup
        transmitterData.marker.setPopupContent(this.createTransmitterPopup(transmitterData));
        
        // Recalculate links
        this.updateLinksForTransmitter(id);
        
        this.saveToStorage();
    }

    async updateLinksForTransmitter(transmitterId) {
        const transmitter = this.transmitters.get(transmitterId);
        if (!transmitter) return;
        
        // Remove existing links for this transmitter
        this.removeLinkLines(transmitterId);
        
        // Show loading indicator
        this.showLoading(true);
        
        try {
            // Calculate links to all other transmitters using advanced RF analysis
            const linkPromises = [];
            
            for (const [otherId, otherTransmitter] of this.transmitters) {
                if (otherId === transmitterId) continue;
                
                // Create link calculation promise
                const linkPromise = this.calculateAdvancedLink(
                    transmitter, 
                    otherTransmitter, 
                    transmitterId, 
                    otherId
                );
                linkPromises.push(linkPromise);
            }
            
            // Wait for all link calculations to complete
            await Promise.all(linkPromises);
            
        } catch (error) {
            console.error('Error calculating advanced links:', error);
            
            // Fallback to simple calculation
            for (const [otherId, otherTransmitter] of this.transmitters) {
                if (otherId === transmitterId) continue;
                
                const distance = this.calculateDistance(transmitter.latlng, otherTransmitter.latlng);
                const linkQuality = this.estimateLinkQuality(distance, transmitter.power, otherTransmitter.power);
                
                this.drawLinkLine(transmitterId, otherId, linkQuality, null, true); // fallback flag
            }
        }
        
        this.showLoading(false);
        this.updateStats();
    }

    calculateDistance(latlng1, latlng2) {
        // Simple great circle distance in kilometers
        const R = 6371; // Earth's radius in km
        const dLat = (latlng2.lat - latlng1.lat) * Math.PI / 180;
        const dLng = (latlng2.lng - latlng1.lng) * Math.PI / 180;
        
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(latlng1.lat * Math.PI / 180) * Math.cos(latlng2.lat * Math.PI / 180) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    /**
     * Calculate advanced RF link between two transmitters
     * Uses comprehensive link budget analysis with terrain data
     */
    async calculateAdvancedLink(tx1, tx2, id1, id2) {
        try {
            // Perform comprehensive link budget calculation
            const txPoint = { lat: tx1.latlng.lat, lng: tx1.latlng.lng, power: tx1.power };
            const rxPoint = { lat: tx2.latlng.lat, lng: tx2.latlng.lng };
            
            const linkAnalysis = await linkBudgetCalculator.calculateLinkBudget(txPoint, rxPoint);
            
            // Store detailed link data
            const linkId = [id1, id2].sort().join('-');
            const linkData = {
                analysis: linkAnalysis,
                quality: linkAnalysis.linkQuality,
                distance: linkAnalysis.distance,
                linkMargin: linkAnalysis.linkBudget.linkMargin,
                spreadingFactor: linkAnalysis.optimalSpreadingFactor,
                hasObstructions: linkAnalysis.terrainAnalysis.hasObstructions,
                recommendations: linkAnalysis.recommendations,
                timestamp: linkAnalysis.timestamp
            };
            
            // Draw the enhanced link line
            this.drawEnhancedLinkLine(id1, id2, linkData);
            
        } catch (error) {
            console.error('Advanced link calculation failed:', error);
            
            // Fallback to simple calculation
            const distance = this.calculateDistance(tx1.latlng, tx2.latlng);
            const quality = this.estimateLinkQuality(distance, tx1.power, tx2.power);
            this.drawLinkLine(id1, id2, quality, null, true);
        }
    }

    estimateLinkQuality(distanceKm, power1, power2) {
        // Simple distance-based estimation (fallback only)
        const avgPower = (power1 + power2) / 2;
        const maxRange = avgPower >= 1.0 ? 15 : 8; // km
        
        if (distanceKm <= maxRange * 0.6) return 'good';
        if (distanceKm <= maxRange) return 'marginal';
        return 'poor';
    }

    /**
     * Draw enhanced link line with comprehensive RF analysis data
     */
    drawEnhancedLinkLine(id1, id2, linkData) {
        const tx1 = this.transmitters.get(id1);
        const tx2 = this.transmitters.get(id2);
        if (!tx1 || !tx2) return;
        
        const quality = linkData.quality;
        const colors = {
            excellent: '#059669', // Green-600
            good: '#10b981',      // Emerald-500
            marginal: '#f59e0b',  // Amber-500
            poor: '#ef4444'       // Red-500
        };
        
        // Line styling based on quality and obstructions
        const lineOptions = {
            color: colors[quality] || colors.poor,
            weight: quality === 'excellent' ? 4 : quality === 'good' ? 3 : 2,
            opacity: 0.8
        };
        
        // Add dashed line for obstructed paths
        if (linkData.hasObstructions) {
            lineOptions.dashArray = '10, 5';
        }
        
        const line = L.polyline([tx1.latlng, tx2.latlng], lineOptions).addTo(this.map);
        
        // Create detailed popup with RF analysis
        const popup = this.createLinkPopup(tx1, tx2, linkData);
        line.bindPopup(popup);
        
        // Store enhanced link data
        const linkId = [id1, id2].sort().join('-');
        this.linkLines.set(linkId, { 
            line, 
            quality, 
            data: linkData,
            enhanced: true 
        });
        
        console.log(`Enhanced link ${linkId}: ${quality} (${linkData.distance.toFixed(2)}km, ${linkData.linkMargin.toFixed(1)}dB margin)`);
    }

    /**
     * Create detailed popup for RF link analysis
     */
    createLinkPopup(tx1, tx2, linkData) {
        const analysis = linkData.analysis;
        const quality = linkData.quality;
        const qualityEmojis = {
            excellent: '🟢',
            good: '🟡',
            marginal: '🟠',
            poor: '🔴'
        };
        
        let obstacleInfo = '';
        if (linkData.hasObstructions) {
            obstacleInfo = `
                <div class="obstacle-warning">
                    ⚠️ Terrain obstructions detected<br>
                    <small>Path may be blocked by hills/buildings</small>
                </div>
            `;
        }
        
        let recommendations = '';
        if (linkData.recommendations.length > 0) {
            recommendations = `
                <div class="recommendations">
                    <strong>Recommendations:</strong><br>
                    ${linkData.recommendations.slice(0, 3).map(rec => `<small>• ${rec}</small>`).join('<br>')}
                </div>
            `;
        }
        
        return `
            <div class="link-popup">
                <h4>${qualityEmojis[quality]} RF Link Analysis</h4>
                <div class="link-stats">
                    <table>
                        <tr><td><strong>Distance:</strong></td><td>${linkData.distance.toFixed(2)} km</td></tr>
                        <tr><td><strong>Link Quality:</strong></td><td>${quality.toUpperCase()}</td></tr>
                        <tr><td><strong>Link Margin:</strong></td><td>${linkData.linkMargin.toFixed(1)} dB</td></tr>
                        <tr><td><strong>Path Loss:</strong></td><td>${analysis.pathLoss.total.toFixed(1)} dB</td></tr>
                        <tr><td><strong>RX Signal:</strong></td><td>${analysis.linkBudget.rxSignalStrength.toFixed(1)} dBm</td></tr>
                        <tr><td><strong>Spreading Factor:</strong></td><td>${linkData.spreadingFactor}</td></tr>
                        <tr><td><strong>Reliability:</strong></td><td>${analysis.linkBudget.reliability.toFixed(1)}%</td></tr>
                    </table>
                </div>
                ${obstacleInfo}
                ${recommendations}
                <div class="link-path">
                    <small><strong>Path:</strong> ${tx1.name} ↔ ${tx2.name}</small><br>
                    <small><strong>Frequency:</strong> 915 MHz</small><br>
                    <small><strong>Analysis:</strong> ${new Date(linkData.timestamp).toLocaleTimeString()}</small>
                </div>
            </div>
        `;
    }

    drawLinkLine(id1, id2, quality) {
        const tx1 = this.transmitters.get(id1);
        const tx2 = this.transmitters.get(id2);
        if (!tx1 || !tx2) return;
        
        const colors = {
            good: '#10b981',
            marginal: '#f59e0b', 
            poor: '#ef4444'
        };
        
        const line = L.polyline([tx1.latlng, tx2.latlng], {
            color: colors[quality],
            weight: 3,
            opacity: 0.8
        }).addTo(this.map);
        
        // Store link with sorted IDs to avoid duplicates
        const linkId = [id1, id2].sort().join('-');
        this.linkLines.set(linkId, { line, quality, enhanced: false });
    }

    removeLinkLines(transmitterId) {
        // Remove all link lines associated with this transmitter
        for (const [linkId, linkData] of this.linkLines) {
            if (linkId.includes(transmitterId)) {
                this.map.removeLayer(linkData.line);
                this.linkLines.delete(linkId);
            }
        }
    }

    updateAllLinks() {
        // Clear all existing links
        this.linkLines.forEach(linkData => {
            this.map.removeLayer(linkData.line);
        });
        this.linkLines.clear();
        
        // Recalculate all links
        const transmitterIds = Array.from(this.transmitters.keys());
        for (let i = 0; i < transmitterIds.length; i++) {
            this.updateLinksForTransmitter(transmitterIds[i]);
        }
    }

    toggleCoverage() {
        if (this.showCoverage) {
            this.showAllCoverage();
        } else {
            this.hideAllCoverage();
        }
    }

    showAllCoverage() {
        this.transmitters.forEach((transmitter, id) => {
            this.showCoverageCircle(id, transmitter);
        });
    }

    hideAllCoverage() {
        this.coverageCircles.forEach(circle => {
            this.map.removeLayer(circle);
        });
        this.coverageCircles.clear();
    }

    showCoverageCircle(id, transmitter) {
        // Simple circle for fast, reliable coverage
        const radiusKm = transmitter.power >= 1.0 ? 15 : 8;
        const radiusMeters = radiusKm * 1000;
        
        const circle = L.circle(transmitter.latlng, {
            color: '#ef4444',
            fillColor: '#ef4444',
            fillOpacity: this.coverageOpacity,
            radius: radiusMeters,
            weight: 1
        }).addTo(this.map);
        
        // Add simple popup
        circle.bindPopup(`
            <div class="coverage-popup">
                <h4>📡 LoRa Coverage</h4>
                <p><strong>Power:</strong> ${transmitter.power}W</p>
                <p><strong>Radius:</strong> ${radiusKm} km (estimated)</p>
                <p><small>Simple circular coverage model</small></p>
            </div>
        `);
        
        this.coverageCircles.set(id, circle);
    }
    

    removeCoverageCircle(id) {
        const circle = this.coverageCircles.get(id);
        if (circle) {
            this.map.removeLayer(circle);
            this.coverageCircles.delete(id);
        }
    }

    updateCoverageOpacity() {
        this.coverageCircles.forEach(circle => {
            circle.setStyle({ fillOpacity: this.coverageOpacity });
        });
    }

    
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    updateStats() {
        document.getElementById('txCount').textContent = this.transmitters.size;
        document.getElementById('linkCount').textContent = this.linkLines.size;
    }

    clearAll() {
        if (!confirm('Clear all transmitters and links?')) return;
        
        // Remove all transmitters
        this.transmitters.forEach((transmitter, id) => {
            this.map.removeLayer(transmitter.marker);
        });
        this.transmitters.clear();
        
        // Remove all links
        this.linkLines.forEach(linkData => {
            this.map.removeLayer(linkData.line);
        });
        this.linkLines.clear();
        
        // Remove all coverage
        this.coverageCircles.forEach(circle => {
            this.map.removeLayer(circle);
        });
        this.coverageCircles.clear();
        
        this.updateStats();
        this.saveToStorage();
        
        console.log('Cleared all transmitters and links');
    }

    saveToStorage() {
        const data = {
            transmitters: Array.from(this.transmitters.entries()).map(([id, tx]) => ({
                id,
                name: tx.name,
                lat: tx.latlng.lat,
                lng: tx.latlng.lng,
                power: tx.power
            })),
            settings: {
                currentPower: this.currentPower,
                showCoverage: this.showCoverage,
                coverageOpacity: this.coverageOpacity
            }
        };
        
        localStorage.setItem('loraMeshPlannerData', JSON.stringify(data));
    }

    loadFromStorage() {
        try {
            const data = JSON.parse(localStorage.getItem('loraMeshPlannerData'));
            if (!data) return;
            
            // Restore settings
            if (data.settings) {
                this.currentPower = data.settings.currentPower || 0.15;
                this.showCoverage = data.settings.showCoverage || false;
                this.coverageOpacity = data.settings.coverageOpacity || 0.3;
                
                document.getElementById('powerSelect').value = this.currentPower;
                document.getElementById('showCoverage').checked = this.showCoverage;
                document.getElementById('transparencySlider').value = this.coverageOpacity * 100;
                document.getElementById('transparencyValue').textContent = Math.round(this.coverageOpacity * 100) + '%';
            }
            
            // Restore transmitters
            if (data.transmitters) {
                data.transmitters.forEach(txData => {
                    const latlng = L.latLng(txData.lat, txData.lng);
                    const marker = L.marker(latlng, {
                        draggable: true,
                        icon: this.createTransmitterIcon(txData.power)
                    }).addTo(this.map);
                    
                    const transmitterData = {
                        id: txData.id,
                        marker: marker,
                        latlng: latlng,
                        power: txData.power,
                        name: txData.name
                    };
                    
                    this.transmitters.set(txData.id, transmitterData);
                    
                    // Bind events
                    marker.on('dragend', () => {
                        transmitterData.latlng = marker.getLatLng();
                        this.updateLinksForTransmitter(txData.id);
                        this.saveToStorage();
                    });
                    
                    marker.bindPopup(this.createTransmitterPopup(transmitterData));
                    marker.on('contextmenu', (e) => {
                        this.showTransmitterMenu(e, transmitterData);
                    });
                });
                
                // Recalculate all links
                this.updateAllLinks();
                
                // Show coverage if enabled
                if (this.showCoverage) {
                    this.showAllCoverage();
                }
            }
            
            this.updateStats();
            
        } catch (error) {
            console.error('Error loading from storage:', error);
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.meshPlanner = new LoRaMeshPlanner();
});
