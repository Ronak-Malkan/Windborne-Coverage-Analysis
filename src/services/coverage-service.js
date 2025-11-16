/**
 * Coverage Analysis Service
 * Analyzes coverage gaps between WindBorne balloons and traditional weather stations
 *
 * Performance optimization: Uses spatial indexing (grid-based lookup) to reduce
 * distance calculations from O(n*m) to O(n*k) where k << m
 * - n = number of balloons (~23,000)
 * - m = number of stations (~13,443)
 * - k = average nearby stations per cell (~60)
 *
 * Result: ~220x faster (309M calculations → 1.4M calculations)
 */

const { calculateDistance } = require('./windborne-service');

/**
 * Build spatial grid index for fast station lookups
 *
 * Divides Earth into 5°×5° cells (~555km × 555km at equator)
 * Total cells: 36 latitude × 72 longitude = 2,592 cells
 *
 * @param {Array} stations - Array of weather station objects with lat/lon
 * @param {number} cellSizeDegrees - Size of grid cells in degrees (default: 5)
 * @returns {Object} Grid object mapping "lat,lon" keys to arrays of stations
 */
function buildStationGrid(stations, cellSizeDegrees = 5) {
  const grid = {};

  stations.forEach(station => {
    // Round coordinates down to nearest cell boundary
    const cellLat = Math.floor(station.latitude / cellSizeDegrees) * cellSizeDegrees;
    const cellLon = Math.floor(station.longitude / cellSizeDegrees) * cellSizeDegrees;
    const cellKey = `${cellLat},${cellLon}`;

    // Initialize cell array if needed
    if (!grid[cellKey]) {
      grid[cellKey] = [];
    }

    // Add station to this cell
    grid[cellKey].push(station);
  });

  return grid;
}

/**
 * Find stations within a radius of a balloon position using spatial grid
 *
 * Instead of checking all 13,443 stations globally, only checks stations
 * in the 3×3 grid of cells around the balloon (typically 20-100 stations)
 *
 * @param {Object} balloon - Balloon position with latitude/longitude
 * @param {Object} grid - Pre-built spatial grid from buildStationGrid()
 * @param {number} radiusKm - Search radius in kilometers (default: 200)
 * @param {number} cellSizeDegrees - Grid cell size in degrees (default: 5)
 * @returns {Array} Array of nearby stations
 */
function findNearbyStations(balloon, grid, radiusKm = 200, cellSizeDegrees = 5) {
  // Calculate how many grid cells the radius spans
  // At equator: 1° ≈ 111 km, so 200km ≈ 1.8°
  // With 5° cells, this is typically 1 cell in each direction (3×3 grid)
  const degreesPerKm = 1 / 111;
  const radiusDegrees = radiusKm * degreesPerKm;
  const cellRadius = Math.ceil(radiusDegrees / cellSizeDegrees);

  // Find balloon's grid cell
  const balloonCellLat = Math.floor(balloon.latitude / cellSizeDegrees) * cellSizeDegrees;
  const balloonCellLon = Math.floor(balloon.longitude / cellSizeDegrees) * cellSizeDegrees;

  const nearbyStations = [];

  // Check surrounding cells (typically 3×3 = 9 cells)
  for (let latOffset = -cellRadius; latOffset <= cellRadius; latOffset++) {
    for (let lonOffset = -cellRadius; lonOffset <= cellRadius; lonOffset++) {
      const checkLat = balloonCellLat + (latOffset * cellSizeDegrees);
      let checkLon = balloonCellLon + (lonOffset * cellSizeDegrees);

      // Handle longitude wrapping at ±180° (International Date Line)
      if (checkLon > 180) checkLon -= 360;
      if (checkLon < -180) checkLon += 360;

      const cellKey = `${checkLat},${checkLon}`;

      // Add all stations from this cell (if any exist)
      if (grid[cellKey]) {
        nearbyStations.push(...grid[cellKey]);
      }
    }
  }

  return nearbyStations;
}

/**
 * Determine if a position is over ocean or land (simplified heuristic)
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
    { latMin: -45, latMax: -10, lonMin: 110, lonMax: 155 }
  ];

  for (const region of landRegions) {
    if (
      lat >= region.latMin &&
      lat <= region.latMax &&
      lon >= region.lonMin &&
      lon <= region.lonMax
    ) {
      return false; // Over land
    }
  }

  return true; // Over ocean
}

/**
 * Calculate comprehensive coverage statistics (OPTIMIZED with spatial indexing)
 *
 * Performance improvements:
 * - Build spatial grid once: ~10ms
 * - Per-balloon lookup: ~60 stations instead of 13,443
 * - Total time: ~1-2 seconds instead of 30-60 seconds
 */
function calculateCoverageStats(balloonData, stations) {
  const balloons = balloonData.balloons;

  // Build spatial index for fast station lookups (one-time operation)
  console.log(`Building spatial index for ${stations.length.toLocaleString()} stations...`);
  const startGridBuild = Date.now();
  const stationGrid = buildStationGrid(stations);
  const gridBuildTime = Date.now() - startGridBuild;
  console.log(`✓ Spatial index built in ${gridBuildTime}ms`);

  // Count balloons over ocean vs land
  let overOcean = 0;
  let overLand = 0;

  balloons.forEach((balloon) => {
    if (isOverOcean(balloon.latitude, balloon.longitude)) {
      overOcean++;
    } else {
      overLand++;
    }
  });

  // Find positions where WindBorne provides unique coverage
  // (no weather stations within 200km - the critical observation gap)
  // OPTIMIZED: Uses spatial indexing to check only nearby stations
  console.log(`Analyzing unique coverage for ${balloons.length.toLocaleString()} balloon positions...`);
  const startCoverage = Date.now();

  const uniqueCoverage = balloons.filter((balloon) => {
    // Get only nearby stations using spatial grid (typically 20-100 instead of 13,443)
    const nearbyStations = findNearbyStations(balloon, stationGrid, 200);

    // If no stations nearby at all, definitely unique coverage
    if (nearbyStations.length === 0) {
      return true;
    }

    // Calculate distance only to nearby stations
    const nearestStation = nearbyStations.reduce((min, station) => {
      const dist = calculateDistance(
        balloon.latitude,
        balloon.longitude,
        station.latitude,
        station.longitude
      );
      return Math.min(min, dist);
    }, Infinity);

    return nearestStation > 200; // 200km threshold for "coverage gap"
  });

  const coverageTime = Date.now() - startCoverage;
  console.log(`✓ Coverage analysis completed in ${coverageTime}ms`);
  console.log(`  Total time: ${gridBuildTime + coverageTime}ms`);

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

module.exports = {
  isOverOcean,
  calculateCoverageStats
};
