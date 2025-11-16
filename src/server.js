/**
 * WindBorne Coverage Analyzer - Express Server
 * Serves frontend and provides API endpoints for balloon constellation data
 */

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const { fetchConstellationData } = require('./services/windborne-service');
const { calculateCoverageStats } = require('./services/coverage-service');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// Cache for weather stations (loaded once at startup)
let weatherStations = [];

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    stationsLoaded: weatherStations.length,
    service: 'windborne-coverage-analyzer'
  });
});

/**
 * GET /api/windborne
 * Fetch current WindBorne balloon constellation data (all 24 hours)
 */
app.get('/api/windborne', async (req, res) => {
  try {
    console.log('Fetching WindBorne constellation data...');
    const data = await fetchConstellationData();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      data
    });
  } catch (error) {
    console.error('Error fetching WindBorne data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch WindBorne data',
      message: error.message
    });
  }
});

/**
 * GET /api/stations
 * Get weather station locations from NOAA ISD
 */
app.get('/api/stations', (req, res) => {
  res.json({
    success: true,
    count: weatherStations.length,
    stations: weatherStations
  });
});

/**
 * GET /api/coverage
 * Get comprehensive coverage analysis comparing WindBorne to traditional stations
 */
app.get('/api/coverage', async (req, res) => {
  try {
    console.log('Calculating coverage statistics...');
    const balloonData = await fetchConstellationData();
    const stats = calculateCoverageStats(balloonData, weatherStations);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      statistics: stats,
      balloonData: balloonData.balloonPaths,
      errors: balloonData.errors
    });
  } catch (error) {
    console.error('Error calculating coverage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate coverage',
      message: error.message
    });
  }
});

/**
 * Catch-all route - serve index.html for SPA
 */
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// ============================================================================
// Server Initialization
// ============================================================================

async function initialize() {
  try {
    console.log('Initializing WindBorne Coverage Analyzer...');
    console.log('');

    // Load weather station data
    const stationsPath = path.join(__dirname, '..', 'data', 'weather-stations.json');

    if (fs.existsSync(stationsPath)) {
      const stationsData = JSON.parse(fs.readFileSync(stationsPath, 'utf8'));
      weatherStations = stationsData;
      console.log(`✓ Loaded ${weatherStations.length.toLocaleString()} weather stations from NOAA ISD`);
    } else {
      console.warn('⚠ Weather stations data file not found.');
      console.warn('  Run: npm run fetch-stations');
      console.warn('  Using empty dataset for now.');
      weatherStations = [];
    }

    console.log('');

    // Start server
    app.listen(PORT, () => {
      console.log('====================================================================');
      console.log('  🎈 WindBorne Coverage Analyzer');
      console.log('====================================================================');
      console.log('');
      console.log(`  Server running on:  http://localhost:${PORT}`);
      console.log('');
      console.log('  API Endpoints:');
      console.log('    GET /api/health      - Health check');
      console.log('    GET /api/windborne   - Balloon constellation data (24H)');
      console.log('    GET /api/stations    - Weather station locations');
      console.log('    GET /api/coverage    - Coverage gap analysis');
      console.log('');
      console.log('  Frontend:');
      console.log(`    http://localhost:${PORT}`);
      console.log('');
      console.log('====================================================================');
      console.log('');
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Start the server
initialize();
