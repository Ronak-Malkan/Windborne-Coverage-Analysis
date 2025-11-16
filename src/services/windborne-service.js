/**
 * WindBorne API Service
 * Handles fetching and processing data from WindBorne balloon constellation
 */

const fetch = require('node-fetch');

const WINDBORNE_BASE_URL = 'https://a.windbornesystems.com/treasure';

/**
 * Fetch WindBorne balloon data for all 24 hours with robust error handling
 */
async function fetchConstellationData() {
  console.log('Fetching WindBorne constellation data from 24 endpoints...');
  const startTime = Date.now();

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
      const url = `${WINDBORNE_BASE_URL}/${hour}.json`;
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
      const validPositions = data
        .filter(pos => {
          if (!Array.isArray(pos) || pos.length < 3) return false;
          const [lat, lon, alt] = pos;
          // Validate coordinates
          return (
            typeof lat === 'number' &&
            typeof lon === 'number' &&
            typeof alt === 'number' &&
            lat >= -90 &&
            lat <= 90 &&
            lon >= -180 &&
            lon <= 180 &&
            alt >= 0
          );
        })
        .map(([lat, lon, alt]) => ({
          latitude: lat,
          longitude: lon,
          altitude: alt,
          hour: parseInt(hour),
          timestamp: Date.now() - parseInt(hour) * 3600000 // Approximate timestamp
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
  responses.forEach((response) => {
    if (response && response.positions) {
      results.balloons.push(...response.positions);
    }
  });

  // Track unique balloon paths
  const uniqueBalloons = groupNearbyPositions(results.balloons);
  results.uniqueBalloonCount = uniqueBalloons.length;
  results.balloonPaths = uniqueBalloons;

  const fetchTime = Date.now() - startTime;
  console.log(`✓ Fetched ${results.balloons.length.toLocaleString()} positions in ${fetchTime}ms (${results.successCount}/${results.totalRequests} endpoints succeeded)`);

  return results;
}

/**
 * Group nearby positions into balloon flight paths
 * This is a heuristic approach since we don't have balloon IDs from the API
 */
function groupNearbyPositions(positions) {
  if (positions.length === 0) return [];

  // Sort by hour (most recent first)
  const sorted = [...positions].sort((a, b) => a.hour - b.hour);

  const paths = [];
  const used = new Set();

  // Find the lowest available hour (most recent data)
  const availableHours = [...new Set(sorted.map(p => p.hour))].sort((a, b) => a - b);
  const startHour = availableHours[0] || 0;

  // For each position in the earliest available hour, try to track it through time
  const currentPositions = sorted.filter((p) => p.hour === startHour);

  currentPositions.forEach((startPos) => {
    const path = [startPos];
    let lastPos = startPos;

    // Try to find this balloon in subsequent hours
    for (let hour = startHour + 1; hour < 24; hour++) {
      const hourPositions = sorted.filter((p) => p.hour === hour);

      // Find closest position within reasonable distance
      let closestPos = null;
      let minDist = Infinity;

      hourPositions.forEach((pos) => {
        const key = `${pos.latitude},${pos.longitude},${pos.hour}`;
        if (used.has(key)) return;

        const dist = calculateDistance(
          lastPos.latitude,
          lastPos.longitude,
          pos.latitude,
          pos.longitude
        );

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
 * Calculate distance between two lat/lon points using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = {
  fetchConstellationData,
  calculateDistance
};
