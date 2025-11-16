/**
 * Fetch and process NOAA weather station data
 * Source: NOAA Integrated Surface Database (ISD)
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

const STATIONS_URL = 'https://www.ncei.noaa.gov/pub/data/noaa/isd-history.txt';
const OUTPUT_DIR = path.join(__dirname, '..', 'data');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'weather-stations.json');

function fetchStations() {
  return new Promise((resolve, reject) => {
    console.log('Fetching NOAA weather station data...');

    https.get(STATIONS_URL, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        console.log('Data fetched successfully. Processing...');
        resolve(data);
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

function parseStations(data) {
  const lines = data.split('\n');
  const stations = [];

  // Skip header lines (first 20 lines)
  for (let i = 20; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    try {
      // Parse fixed-width format
      // USAF   WBAN  STATION NAME                  CTRY  ST CALL  LAT     LON      ELEV(.1M) BEGIN    END
      // 010010 99999 JAN MAYEN                     NO       ENJA  +70.933 -008.667 +0009.0   19310101 20250113

      const usaf = line.substring(0, 6).trim();
      const wban = line.substring(7, 12).trim();
      const name = line.substring(13, 42).trim();
      const country = line.substring(43, 45).trim();
      const state = line.substring(48, 50).trim();
      const latStr = line.substring(57, 64).trim();
      const lonStr = line.substring(65, 73).trim();
      const elevStr = line.substring(74, 81).trim();
      const begin = line.substring(82, 90).trim();
      const end = line.substring(91, 99).trim();

      // Convert lat/lon to numbers
      const latitude = parseFloat(latStr);
      const longitude = parseFloat(lonStr);
      const elevation = parseFloat(elevStr) / 10; // Convert from 0.1m to meters

      // Skip invalid coordinates
      if (isNaN(latitude) || isNaN(longitude)) continue;
      if (latitude < -90 || latitude > 90) continue;
      if (longitude < -180 || longitude > 180) continue;

      // Only include active stations (end date is recent)
      const endYear = parseInt(end.substring(0, 4));
      if (endYear < 2024) continue; // Only stations active in 2024+

      stations.push({
        id: `${usaf}-${wban}`,
        name: name || 'Unknown Station',
        country,
        state,
        latitude,
        longitude,
        elevation: isNaN(elevation) ? 0 : elevation,
        active: true
      });
    } catch (error) {
      // Skip malformed lines
      continue;
    }
  }

  return stations;
}

async function main() {
  try {
    // Create data directory if it doesn't exist
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Fetch and parse stations
    const data = await fetchStations();
    const stations = parseStations(data);

    console.log(`Parsed ${stations.length} active weather stations`);

    // Save to JSON file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(stations, null, 2));

    console.log(`✓ Saved station data to ${OUTPUT_FILE}`);
    console.log('\nSample stations:');
    console.log(stations.slice(0, 5).map(s => `  - ${s.name} (${s.country}) at ${s.latitude}, ${s.longitude}`).join('\n'));

    // Print statistics
    const countries = new Set(stations.map(s => s.country));
    console.log(`\n📊 Statistics:`);
    console.log(`   Total stations: ${stations.length}`);
    console.log(`   Countries: ${countries.size}`);
    console.log(`   Average elevation: ${(stations.reduce((sum, s) => sum + s.elevation, 0) / stations.length).toFixed(0)}m`);

  } catch (error) {
    console.error('Error fetching stations:', error);
    process.exit(1);
  }
}

main();
