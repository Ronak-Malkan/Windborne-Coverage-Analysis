/**
 * Coverage Analysis Service
 * Analyzes coverage gaps between WindBorne balloons and traditional weather stations
 */

const { calculateDistance } = require('./windborne-service');

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
 * Calculate comprehensive coverage statistics
 */
function calculateCoverageStats(balloonData, stations) {
  const balloons = balloonData.balloons;

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
  const uniqueCoverage = balloons.filter((balloon) => {
    const nearestStation = stations.reduce((min, station) => {
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
