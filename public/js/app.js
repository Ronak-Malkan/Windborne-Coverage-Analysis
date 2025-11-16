/**
 * WindBorne Coverage Analyzer - Main Application
 */

// Application State
const state = {
    map: null,
    layers: {
        balloons: null,
        paths: null,
        stations: null,
        unique: null
    },
    data: {
        balloons: [],
        paths: [],
        stations: [],
        stats: null
    },
    autoRefresh: true,
    refreshInterval: null
};

// API Base URL
const API_BASE = window.location.origin;

/**
 * Initialize the application
 */
async function init() {
    console.log('Initializing WindBorne Coverage Analyzer...');

    // Initialize map
    initMap();

    // Set up event listeners
    setupEventListeners();

    // Load initial data
    await loadData();

    // Start auto-refresh if enabled
    if (state.autoRefresh) {
        startAutoRefresh();
    }
}

/**
 * Initialize Leaflet map
 */
function initMap() {
    // Create map centered on the world
    state.map = L.map('map', {
        center: [20, 0],
        zoom: 2,
        minZoom: 2,
        maxZoom: 10,
        worldCopyJump: true
    });

    // Add tile layer (CartoDB Positron - clean, minimal style)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(state.map);

    // Initialize layer groups
    state.layers.balloons = L.layerGroup().addTo(state.map);
    state.layers.paths = L.layerGroup().addTo(state.map);
    state.layers.stations = L.layerGroup().addTo(state.map);
    state.layers.unique = L.layerGroup().addTo(state.map);

    console.log('Map initialized');
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Toggle controls
    document.getElementById('toggle-balloons').addEventListener('change', (e) => {
        toggleLayer('balloons', e.target.checked);
    });

    document.getElementById('toggle-paths').addEventListener('change', (e) => {
        toggleLayer('paths', e.target.checked);
    });

    document.getElementById('toggle-stations').addEventListener('change', (e) => {
        toggleLayer('stations', e.target.checked);
    });

    document.getElementById('toggle-unique').addEventListener('change', (e) => {
        toggleLayer('unique', e.target.checked);
    });

    // Refresh button
    document.getElementById('refresh-btn').addEventListener('click', () => {
        loadData();
    });

    // Auto-refresh toggle
    document.getElementById('auto-refresh').addEventListener('change', (e) => {
        state.autoRefresh = e.target.checked;
        if (state.autoRefresh) {
            startAutoRefresh();
        } else {
            stopAutoRefresh();
        }
    });
}

/**
 * Toggle map layer visibility
 */
function toggleLayer(layerName, visible) {
    if (visible) {
        state.map.addLayer(state.layers[layerName]);
    } else {
        state.map.removeLayer(state.layers[layerName]);
    }
}

/**
 * Load all data from API
 */
async function loadData() {
    showLoading(true);
    updateLoadingProgress(0, 'Initializing...');
    const refreshBtn = document.getElementById('refresh-btn');
    refreshBtn.classList.add('loading');

    try {
        console.log('Fetching data from API...');

        // Step 1: Fetch WindBorne balloon constellation data (25%)
        setStepActive('windborne');
        updateLoadingProgress(10, 'Fetching balloon constellation...');

        const coverageResponse = await fetch(`${API_BASE}/api/coverage`);
        const coverageData = await coverageResponse.json();

        if (!coverageData.success) {
            throw new Error('Failed to fetch coverage data');
        }

        setStepCompleted('windborne');
        updateLoadingProgress(40, 'Balloon data received!');

        // Step 2: Fetch weather stations data (50%)
        setStepActive('stations');
        updateLoadingProgress(45, 'Loading weather stations...');

        const stationsResponse = await fetch(`${API_BASE}/api/stations`);
        const stationsData = await stationsResponse.json();

        if (!stationsData.success) {
            throw new Error('Failed to fetch stations data');
        }

        setStepCompleted('stations');
        updateLoadingProgress(60, 'Weather stations loaded!');

        // Update state
        state.data.paths = coverageData.balloonData || [];
        state.data.stats = coverageData.statistics;
        state.data.stations = stationsData.stations || [];

        // Extract all balloon positions
        state.data.balloons = [];
        state.data.paths.forEach(path => {
            if (path && path.length > 0) {
                state.data.balloons.push(...path);
            }
        });

        console.log(`Loaded ${state.data.balloons.length} balloon positions, ${state.data.paths.length} paths, ${state.data.stations.length} stations`);

        // Step 3: Analyze coverage gaps (75%)
        setStepActive('analysis');
        updateLoadingProgress(65, 'Analyzing coverage gaps...');

        // Simulate analysis time for better UX
        await new Promise(resolve => setTimeout(resolve, 500));

        setStepCompleted('analysis');
        updateLoadingProgress(80, 'Analysis complete!');

        // Step 4: Render visualization (100%)
        setStepActive('render');
        updateLoadingProgress(85, 'Rendering interactive map...');

        // Update visualization
        updateMap();
        updateStats();

        setStepCompleted('render');
        updateLoadingProgress(100, 'Ready!');

        // Show errors if any
        if (coverageData.errors && coverageData.errors.length > 0) {
            showErrors(coverageData.errors);
        } else {
            hideErrors();
        }

        // Hide loading after a brief moment
        await new Promise(resolve => setTimeout(resolve, 500));
        showLoading(false);
        refreshBtn.classList.remove('loading');

    } catch (error) {
        console.error('Error loading data:', error);
        showLoading(false);
        refreshBtn.classList.remove('loading');
        showError('Failed to load data. Please try again.');
    }
}

/**
 * Update map with new data
 */
function updateMap() {
    console.log('Updating map...');

    // Clear existing layers
    state.layers.balloons.clearLayers();
    state.layers.paths.clearLayers();
    state.layers.stations.clearLayers();
    state.layers.unique.clearLayers();

    // Add balloon paths (24H trajectories)
    state.data.paths.forEach((path, index) => {
        if (!path || path.length < 2) return;

        // Create polyline for path
        const coordinates = path.map(pos => [pos.latitude, pos.longitude]);
        const polyline = L.polyline(coordinates, {
            color: '#9ca3af',
            weight: 2,
            opacity: 0.5
        });

        polyline.bindPopup(createPathPopup(path, index));
        polyline.addTo(state.layers.paths);
    });

    // Add current balloon positions (hour 00)
    const currentBalloons = state.data.balloons.filter(b => b.hour === 0);
    currentBalloons.forEach((balloon, index) => {
        const marker = L.circleMarker([balloon.latitude, balloon.longitude], {
            radius: 6,
            fillColor: '#3b82f6',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        });

        marker.bindPopup(createBalloonPopup(balloon, index));
        marker.addTo(state.layers.balloons);
    });

    // Add WindBorne-only coverage (no stations within 200km)
    const uniqueCoverage = currentBalloons.filter(balloon => {
        const nearestStation = findNearestStation(balloon);
        return nearestStation && nearestStation.distance > 200;
    });

    uniqueCoverage.forEach((balloon, index) => {
        const marker = L.circleMarker([balloon.latitude, balloon.longitude], {
            radius: 8,
            fillColor: '#10b981',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9
        });

        const nearestStation = findNearestStation(balloon);
        marker.bindPopup(createUniqueCoveragePopup(balloon, nearestStation, index));
        marker.addTo(state.layers.unique);
    });

    // Add weather stations (sample to avoid overcrowding)
    const sampledStations = sampleStations(state.data.stations, 2000);
    sampledStations.forEach((station, index) => {
        const marker = L.circleMarker([station.latitude, station.longitude], {
            radius: 3,
            fillColor: '#ef4444',
            color: '#fff',
            weight: 1,
            opacity: 0.7,
            fillOpacity: 0.6
        });

        marker.bindPopup(createStationPopup(station));
        marker.addTo(state.layers.stations);
    });

    console.log('Map updated successfully');
}

/**
 * Update statistics dashboard
 */
function updateStats() {
    if (!state.data.stats) return;

    const stats = state.data.stats;

    document.getElementById('stat-balloons').textContent = stats.uniqueBalloons || 0;
    document.getElementById('stat-ocean').textContent = `${stats.oceanPercentage || 0}%`;
    document.getElementById('stat-unique').textContent = `${stats.uniqueCoveragePercentage || 0}%`;
    document.getElementById('stat-stations').textContent = (stats.weatherStationCount || 0).toLocaleString();

    const quality = stats.dataQuality || {};
    const qualityPercent = Math.round((quality.hoursAvailable / 24) * 100);
    document.getElementById('stat-quality').textContent = `${qualityPercent}%`;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('stat-updated').textContent = timeStr;
}

/**
 * Create popup content for balloon marker
 */
function createBalloonPopup(balloon, index) {
    return `
        <div class="popup-title">WindBorne Balloon #${index + 1}</div>
        <div class="popup-info">
            <div><strong>Position:</strong> ${balloon.latitude.toFixed(4)}°, ${balloon.longitude.toFixed(4)}°</div>
            <div><strong>Altitude:</strong> ${balloon.altitude.toFixed(2)} km</div>
            <div><strong>Type:</strong> ${isOverOcean(balloon.latitude, balloon.longitude) ? 'Over Ocean' : 'Over Land'}</div>
            <div><strong>Data Age:</strong> Current (0H)</div>
        </div>
    `;
}

/**
 * Create popup content for flight path
 */
function createPathPopup(path, index) {
    const startPos = path[0];
    const endPos = path[path.length - 1];
    const distance = calculatePathDistance(path);

    return `
        <div class="popup-title">Flight Path #${index + 1}</div>
        <div class="popup-info">
            <div><strong>Duration:</strong> ${path.length} hours</div>
            <div><strong>Distance:</strong> ~${distance.toFixed(0)} km</div>
            <div><strong>Start:</strong> ${startPos.latitude.toFixed(2)}°, ${startPos.longitude.toFixed(2)}°</div>
            <div><strong>End:</strong> ${endPos.latitude.toFixed(2)}°, ${endPos.longitude.toFixed(2)}°</div>
            <div><strong>Alt Range:</strong> ${Math.min(...path.map(p => p.altitude)).toFixed(1)} - ${Math.max(...path.map(p => p.altitude)).toFixed(1)} km</div>
        </div>
    `;
}

/**
 * Create popup content for unique coverage marker
 */
function createUniqueCoveragePopup(balloon, nearestStation, index) {
    return `
        <div class="popup-title">✨ WindBorne-Only Coverage</div>
        <div class="popup-info">
            <div><strong>Position:</strong> ${balloon.latitude.toFixed(4)}°, ${balloon.longitude.toFixed(4)}°</div>
            <div><strong>Altitude:</strong> ${balloon.altitude.toFixed(2)} km</div>
            <div><strong>Nearest Station:</strong> ${nearestStation.distance.toFixed(0)} km away</div>
            <div><strong>Significance:</strong> No weather stations within 200km - WindBorne fills this gap!</div>
        </div>
    `;
}

/**
 * Create popup content for weather station marker
 */
function createStationPopup(station) {
    return `
        <div class="popup-title">${station.name}</div>
        <div class="popup-info">
            <div><strong>Country:</strong> ${station.country}</div>
            <div><strong>Position:</strong> ${station.latitude.toFixed(4)}°, ${station.longitude.toFixed(4)}°</div>
            <div><strong>Elevation:</strong> ${station.elevation.toFixed(0)} m</div>
            <div><strong>Type:</strong> Traditional Weather Station</div>
        </div>
    `;
}

/**
 * Find nearest weather station to a balloon position
 */
function findNearestStation(balloon) {
    let nearest = null;
    let minDistance = Infinity;

    state.data.stations.forEach(station => {
        const distance = calculateDistance(
            balloon.latitude,
            balloon.longitude,
            station.latitude,
            station.longitude
        );

        if (distance < minDistance) {
            minDistance = distance;
            nearest = station;
        }
    });

    return nearest ? { station: nearest, distance: minDistance } : null;
}

/**
 * Calculate total distance of a flight path
 */
function calculatePathDistance(path) {
    let totalDistance = 0;

    for (let i = 1; i < path.length; i++) {
        const dist = calculateDistance(
            path[i - 1].latitude,
            path[i - 1].longitude,
            path[i].latitude,
            path[i].longitude
        );
        totalDistance += dist;
    }

    return totalDistance;
}

/**
 * Calculate distance between two lat/lon points (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Check if position is over ocean (simplified heuristic)
 */
function isOverOcean(lat, lon) {
    const landRegions = [
        { latMin: 15, latMax: 70, lonMin: -170, lonMax: -50 },
        { latMin: -55, latMax: 15, lonMin: -82, lonMax: -35 },
        { latMin: 35, latMax: 71, lonMin: -10, lonMax: 40 },
        { latMin: -35, latMax: 37, lonMin: -18, lonMax: 52 },
        { latMin: -10, latMax: 75, lonMin: 40, lonMax: 150 },
        { latMin: -45, latMax: -10, lonMin: 110, lonMax: 155 },
    ];

    for (const region of landRegions) {
        if (lat >= region.latMin && lat <= region.latMax &&
            lon >= region.lonMin && lon <= region.lonMax) {
            return false;
        }
    }

    return true;
}

/**
 * Sample stations to avoid overcrowding the map
 */
function sampleStations(stations, maxCount) {
    if (stations.length <= maxCount) return stations;

    const step = Math.ceil(stations.length / maxCount);
    const sampled = [];

    for (let i = 0; i < stations.length; i += step) {
        sampled.push(stations[i]);
    }

    return sampled;
}

/**
 * Show/hide loading indicator
 */
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
        loading.classList.remove('hidden');
        // Reset all steps
        resetLoadingSteps();
    } else {
        loading.classList.add('hidden');
    }
}

/**
 * Update loading progress bar
 */
function updateLoadingProgress(percentage, status) {
    const progressFill = document.getElementById('progress-fill');
    const progressPercentage = document.getElementById('progress-percentage');
    const progressStatus = document.getElementById('progress-status');

    if (progressFill) progressFill.style.width = `${percentage}%`;
    if (progressPercentage) progressPercentage.textContent = `${percentage}%`;
    if (progressStatus) progressStatus.textContent = status;
}

/**
 * Set a loading step as active
 */
function setStepActive(stepName) {
    const step = document.getElementById(`step-${stepName}`);
    if (step) {
        step.classList.add('active');
        step.classList.remove('completed');
    }
}

/**
 * Set a loading step as completed
 */
function setStepCompleted(stepName) {
    const step = document.getElementById(`step-${stepName}`);
    const status = document.getElementById(`status-${stepName}`);

    if (step) {
        step.classList.remove('active');
        step.classList.add('completed');
    }

    if (status) {
        status.textContent = '✅';
    }
}

/**
 * Reset all loading steps
 */
function resetLoadingSteps() {
    const steps = ['windborne', 'stations', 'analysis', 'render'];

    steps.forEach(stepName => {
        const step = document.getElementById(`step-${stepName}`);
        const status = document.getElementById(`status-${stepName}`);

        if (step) {
            step.classList.remove('active', 'completed');
        }

        if (status) {
            status.textContent = '⏳';
        }
    });

    updateLoadingProgress(0, 'Initializing...');
}

/**
 * Show error message
 */
function showError(message) {
    const errorNotice = document.getElementById('error-notice');
    errorNotice.textContent = message;
    errorNotice.style.display = 'block';
}

/**
 * Show API errors
 */
function showErrors(errors) {
    const errorNotice = document.getElementById('error-notice');
    const errorCount = errors.length;
    const message = `Warning: ${errorCount} hour(s) of data unavailable. Showing available data.`;
    errorNotice.textContent = message;
    errorNotice.style.display = 'block';
}

/**
 * Hide error message
 */
function hideErrors() {
    const errorNotice = document.getElementById('error-notice');
    errorNotice.style.display = 'none';
}

/**
 * Start auto-refresh timer
 */
function startAutoRefresh() {
    stopAutoRefresh(); // Clear any existing timer

    // Refresh every 5 minutes
    state.refreshInterval = setInterval(() => {
        console.log('Auto-refreshing data...');
        loadData();
    }, 5 * 60 * 1000);

    console.log('Auto-refresh enabled (5 minutes)');
}

/**
 * Stop auto-refresh timer
 */
function stopAutoRefresh() {
    if (state.refreshInterval) {
        clearInterval(state.refreshInterval);
        state.refreshInterval = null;
        console.log('Auto-refresh disabled');
    }
}

// Initialize application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
