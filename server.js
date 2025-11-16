const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.static('public'));

// Cache for weather stations (loaded once at startup)
let weatherStations = [];

/**
 * Fetch WindBorne balloon data with robust error handling
 * Fetches all 24 hours (00.json through 23.json)
 */
async function fetchWindBorneData() {
  const baseUrl = 'https://a.windbornesystems.com/treasure';
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));

  const results = {
    balloons: [],
    hourlyData: {},
    errors: [],
    successCount: 0,
    totalRequests: 24
  };

  // Fetch all hours in parallel
  const promises = hours.map(async (hour) => {
    try {
      const url = `${baseUrl}/${hour}.json`;
      const response = await fetch(url, { timeout: 5000 });

      if (!response.ok) {
        results.errors.push({ hour, error: `HTTP ${response.status}` });
        return null;
      }

      const data = await response.json();

      // Validate data structure
      if (!Array.isArray(data)) {
        results.errors.push({ hour, error: 'Invalid data structure (not an array)' });
        return null;
      }

      // Parse and validate each balloon position
      const validPositions = data.filter(pos => {
        if (!Array.isArray(pos) || pos.length < 3) return false;
        const [lat, lon, alt] = pos;
        // Validate coordinates
        return typeof lat === 'number' &&
               typeof lon === 'number' &&
               typeof alt === 'number' &&
               lat >= -90 && lat <= 90 &&
               lon >= -180 && lon <= 180 &&
               alt >= 0;
      }).map(([lat, lon, alt]) => ({
        latitude: lat,
        longitude: lon,
        altitude: alt,
        hour: parseInt(hour),
        timestamp: Date.now() - (parseInt(hour) * 3600000) // Approximate timestamp
      }));

      results.hourlyData[hour] = validPositions;
      results.successCount++;

      return { hour, positions: validPositions };
    } catch (error) {
      results.errors.push({
        hour,
        error: error.message || 'Unknown error'
      });
      return null;
    }
  });

  const responses = await Promise.all(promises);

  // Combine all valid positions
  responses.forEach(response => {
    if (response && response.positions) {
      results.balloons.push(...response.positions);
    }
  });

  // Track unique balloon IDs (approximate by grouping nearby positions)
  const uniqueBalloons = groupNearbyPositions(results.balloons);
  results.uniqueBalloonCount = uniqueBalloons.length;
  results.balloonPaths = uniqueBalloons;

  return results;
}

/**
 * Group nearby positions into balloon flight paths
 * This is a heuristic approach since we don't have balloon IDs
 */
function groupNearbyPositions(positions) {
  if (positions.length === 0) return [];

  // Sort by hour (most recent first)
  const sorted = [...positions].sort((a, b) => a.hour - b.hour);

  const paths = [];
  const used = new Set();

  // For each position in hour 00 (most recent), try to track it backwards
  const currentPositions = sorted.filter(p => p.hour === 0);

  currentPositions.forEach(startPos => {
    const path = [startPos];
    let lastPos = startPos;

    // Try to find this balloon in previous hours
    for (let hour = 1; hour < 24; hour++) {
      const hourPositions = sorted.filter(p => p.hour === hour);

      // Find closest position within reasonable distance
      let closestPos = null;
      let minDist = Infinity;

      hourPositions.forEach(pos => {
        const key = `${pos.latitude},${pos.longitude},${pos.hour}`;
        if (used.has(key)) return;

        const dist = calculateDistance(lastPos.latitude, lastPos.longitude, pos.latitude, pos.longitude);

        // Balloons can travel up to ~200km per hour at high altitudes
        if (dist < 500 && dist < minDist) {
          minDist = dist;
          closestPos = pos;
        }
      });

      if (closestPos) {
        path.push(closestPos);
        used.add(`${closestPos.latitude},${closestPos.longitude},${closestPos.hour}`);
        lastPos = closestPos;
      }
    }

    paths.push(path);
  });

  return paths;
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
 * Determine if a position is over ocean or land
 * This is a simplified heuristic - for production, use a proper land/ocean dataset
 */
function isOverOcean(lat, lon) {
  // Major land masses (simplified bounding boxes)
  const landRegions = [
    // North America
    { latMin: 15, latMax: 70, lonMin: -170, lonMax: -50 },
    // South America
    { latMin: -55, latMax: 15, lonMin: -82, lonMax: -35 },
    // Europe
    { latMin: 35, latMax: 71, lonMin: -10, lonMax: 40 },
    // Africa
    { latMin: -35, latMax: 37, lonMin: -18, lonMax: 52 },
    // Asia
    { latMin: -10, latMax: 75, lonMin: 40, lonMax: 150 },
    // Australia
    { latMin: -45, latMax: -10, lonMin: 110, lonMax: 155 },
  ];

  for (const region of landRegions) {
    if (lat >= region.latMin && lat <= region.latMax &&
        lon >= region.lonMin && lon <= region.lonMax) {
      return false; // Over land
    }
  }

  return true; // Over ocean
}

/**
 * Calculate coverage statistics
 */
function calculateCoverageStats(balloonData, stations) {
  const balloons = balloonData.balloons;

  // Count balloons over ocean vs land
  let overOcean = 0;
  let overLand = 0;

  balloons.forEach(balloon => {
    if (isOverOcean(balloon.latitude, balloon.longitude)) {
      overOcean++;
    } else {
      overLand++;
    }
  });

  // Find positions where WindBorne provides unique coverage
  // (no weather stations within 200km)
  const uniqueCoverage = balloons.filter(balloon => {
    const nearestStation = stations.reduce((min, station) => {
      const dist = calculateDistance(
        balloon.latitude,
        balloon.longitude,
        station.latitude,
        station.longitude
      );
      return Math.min(min, dist);
    }, Infinity);

    return nearestStation > 200; // 200km threshold
  });

  return {
    totalBalloonPositions: balloons.length,
    uniqueBalloons: balloonData.uniqueBalloonCount,
    overOcean,
    overLand,
    oceanPercentage: ((overOcean / balloons.length) * 100).toFixed(1),
    landPercentage: ((overLand / balloons.length) * 100).toFixed(1),
    uniqueCoveragePositions: uniqueCoverage.length,
    uniqueCoveragePercentage: ((uniqueCoverage.length / balloons.length) * 100).toFixed(1),
    weatherStationCount: stations.length,
    dataQuality: {
      hoursAvailable: balloonData.successCount,
      hoursMissing: 24 - balloonData.successCount,
      errorCount: balloonData.errors.length
    }
  };
}

// API Endpoints

/**
 * GET /api/windborne
 * Fetch current WindBorne balloon constellation data
 */
app.get('/api/windborne', async (req, res) => {
  try {
    console.log('Fetching WindBorne data...');
    const data = await fetchWindBorneData();

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
 * Get weather station locations
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
 * Get comprehensive coverage analysis
 */
app.get('/api/coverage', async (req, res) => {
  try {
    console.log('Calculating coverage statistics...');
    const balloonData = await fetchWindBorneData();
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
 * GET /api/health
 * Health check endpoint
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    stationsLoaded: weatherStations.length
  });
});

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * Initialize server
 */
async function initialize() {
  try {
    console.log('Loading weather station data...');

    // Load weather stations from data file
    const fs = require('fs');
    const stationsPath = path.join(__dirname, 'data', 'weather-stations.json');

    if (fs.existsSync(stationsPath)) {
      const stationsData = JSON.parse(fs.readFileSync(stationsPath, 'utf8'));
      weatherStations = stationsData;
      console.log(`Loaded ${weatherStations.length} weather stations`);
    } else {
      console.warn('Weather stations data file not found. Using empty dataset.');
      weatherStations = [];
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`\n🎈 WindBorne Coverage Analyzer running on http://localhost:${PORT}`);
      console.log(`   API endpoints:`);
      console.log(`   - GET /api/windborne    - Fetch balloon constellation data`);
      console.log(`   - GET /api/stations     - Get weather station locations`);
      console.log(`   - GET /api/coverage     - Get coverage analysis`);
      console.log(`   - GET /api/health       - Health check\n`);
    });
  } catch (error) {
    console.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

initialize();
