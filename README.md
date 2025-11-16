# WindBorne Coverage Analyzer

A real-time visualization tool demonstrating WindBorne's global weather balloon constellation and their unique coverage of Earth's observation gaps.

**Live Demo**: [windborne.ronakverse.net](https://windborne.ronakverse.net)

---

## Overview

This application addresses the critical challenge in global weather observation: **85% of Earth lacks weather data** due to sparse traditional weather station coverage. WindBorne Systems is solving this with a constellation of weather balloons that provide observations from previously unmeasured regions, particularly over oceans and remote areas.

The WindBorne Coverage Analyzer provides an interactive visualization that:
- **Tracks WindBorne's balloon constellation** in real-time across the globe
- **Maps traditional weather stations** from NOAA's Integrated Surface Database
- **Identifies unique coverage areas** where WindBorne balloons provide data >200km from the nearest weather station
- **Quantifies ocean vs. land coverage** to demonstrate WindBorne's oceanic observation capabilities
- **Visualizes 24-hour flight paths** showing balloon trajectory and persistence

---

## Key Features

### Real-Time Data Integration
- Fetches data from **24 hourly WindBorne API endpoints** (past 24 hours)
- Integrates **13,443+ NOAA weather stations** globally
- Auto-refreshes every 5 minutes to show latest balloon positions

### Interactive Map Visualization
- **Blue markers**: WindBorne balloon positions with altitude info
- **Red markers**: Traditional weather stations (sampled for performance)
- **Green markers**: Unique coverage areas (>200km from any station)
- **Gray paths**: 24-hour balloon flight trajectories
- Toggle layers on/off for customized views
- Click markers for detailed information

### Coverage Analytics
- **Total balloons** currently active
- **Weather stations** count
- **Unique coverage points** where WindBorne fills gaps
- **Ocean coverage percentage** demonstrating oceanic observation strength
- **Land coverage percentage** for continental observations

### User Experience
- **Responsive design** with Tailwind CSS (mobile, tablet, desktop)
- **Loading screen** with progress tracking and explanation
- **Clean, modern UI** with intuitive controls
- **Full-screen map** for optimal data visualization

---

## Technical Architecture

### Backend (Node.js + Express)
```
src/
├── server.js                    # Express server, API endpoints
└── services/
    ├── windborne-service.js     # Fetches & processes balloon data
    └── coverage-service.js      # Analyzes coverage gaps & statistics
```

**API Endpoints:**
- `GET /api/health` - Health check for deployment monitoring
- `GET /api/windborne` - Balloon constellation data
- `GET /api/stations` - Weather station locations
- `GET /api/coverage` - Combined data with analytics

### Frontend (Vanilla JS + Tailwind CSS)
```
public/
├── index.html                   # Main application UI
├── js/
│   └── app.js                  # Map initialization, data loading, interactivity
└── css/
    └── styles.css              # Custom styles (complementing Tailwind)
```

**Libraries:**
- **Leaflet.js** - Interactive map with marker clustering
- **Tailwind CSS** - Responsive utility-first styling
- **OpenStreetMap** - Base map tiles

### Data Layer
```
data/
└── weather-stations.json        # NOAA ISD station database (13,443 stations)

scripts/
└── fetch-stations.js           # One-time NOAA data fetcher
```

### Algorithms

**Balloon Path Reconstruction:**
- Groups positions within 500km/hour travel distance
- Creates flight path visualization from 24-hour history
- Handles missing data gracefully (API endpoints may return errors)

**Coverage Gap Analysis:**
- Haversine formula for geographic distance calculation
- Identifies balloon positions >200km from nearest weather station
- Calculates ocean vs. land coverage using continental bounding boxes

---

## Setup & Installation

### Prerequisites
- Node.js 18+
- npm or yarn

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Ronak-Malkan/windborne-coverage-analyzer.git
   cd windborne-coverage-analyzer
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Fetch weather station data (one-time):**
   ```bash
   npm run fetch-stations
   ```

4. **Start the development server:**
   ```bash
   npm start
   ```

5. **Open browser:**
   ```
   http://localhost:3000
   ```

### Environment Variables
No environment variables required! The application uses public APIs:
- WindBorne API: `https://a.windbornesystems.com/treasure/`
- NOAA ISD: `https://www.ncei.noaa.gov/pub/data/noaa/isd-history.txt`

---

## Deployment

### Docker Deployment (Recommended)

**Build image:**
```bash
docker build -t windborne-coverage .
```

**Run container:**
```bash
docker run -d \
  --name windborne-coverage \
  --restart unless-stopped \
  -p 3000:3000 \
  -e NODE_ENV=production \
  windborne-coverage
```

**Health check:**
```bash
curl http://localhost:3000/api/health
```

### Production Deployment

The application is deployed on [Ronak-Verse](https://ronakverse.net) infrastructure using:
1. **Automated deployment script** in `Ronak-Verse/services/WindBorne/deploy.sh`
2. **Docker containerization** for isolation and reproducibility
3. **Nginx reverse proxy** for SSL termination and subdomain routing
4. **Let's Encrypt SSL** for HTTPS security
5. **Auto-restart policy** for high availability

**Deployment process:**
```bash
# On production server
cd /root/Ronak-Verse/services/WindBorne
./deploy.sh
```

This script automatically:
- Clones/updates the GitHub repository
- Fetches weather station data if missing
- Builds the Docker image
- Starts the container on port 3005
- Verifies health check
- Cleans up old images

---

## API Documentation

### GET `/api/health`
**Description:** Health check endpoint for monitoring
**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-15T12:34:56.789Z"
}
```

### GET `/api/windborne`
**Description:** Balloon constellation data for the past 24 hours
**Response:**
```json
{
  "success": true,
  "balloonPaths": [
    {
      "positions": [
        { "lat": 37.7749, "lon": -122.4194, "altitude": 12500 }
      ]
    }
  ],
  "totalPositions": 1234
}
```

### GET `/api/stations`
**Description:** Weather station locations from NOAA ISD
**Response:**
```json
{
  "success": true,
  "stations": [
    {
      "id": "720381-00173",
      "name": "PORTLAND INTERNATIONAL",
      "lat": 45.5897,
      "lon": -122.5986,
      "elevation": 6.1,
      "country": "US"
    }
  ],
  "count": 13443
}
```

### GET `/api/coverage`
**Description:** Combined analysis with coverage statistics
**Response:**
```json
{
  "success": true,
  "statistics": {
    "totalBalloons": 42,
    "totalStations": 13443,
    "uniqueCoverage": 28,
    "oceanCoverage": 67.3,
    "landCoverage": 32.7
  },
  "balloonData": { ... }
}
```

---

## Technologies Used

### Backend
- **Node.js 18** - Runtime environment
- **Express.js** - Web framework
- **node-fetch** - HTTP client for external APIs
- **compression** - Response compression middleware
- **cors** - Cross-origin resource sharing

### Frontend
- **Vanilla JavaScript** - No framework overhead, fast performance
- **Tailwind CSS** - Responsive utility-first styling
- **Leaflet.js** - Interactive mapping library
- **OpenStreetMap** - Free, community-driven map tiles

### DevOps
- **Docker** - Containerization
- **Nginx** - Reverse proxy and SSL termination
- **Let's Encrypt** - Free SSL certificates
- **Digital Ocean** - Cloud hosting

### Data Sources
- **WindBorne Systems API** - Real-time balloon constellation data
- **NOAA ISD** - Weather station database (Integrated Surface Database)

---

## Project Structure

```
windborne-coverage-analyzer/
├── src/                          # Backend source code
│   ├── server.js                # Express server & API routes
│   └── services/
│       ├── windborne-service.js # Balloon data fetcher
│       └── coverage-service.js  # Coverage analysis
├── public/                       # Frontend static files
│   ├── index.html               # Main application UI
│   ├── js/
│   │   └── app.js              # Map & interactivity logic
│   └── css/
│       └── styles.css          # Custom styles
├── data/                         # Data storage
│   └── weather-stations.json   # NOAA station database
├── scripts/                      # Utility scripts
│   └── fetch-stations.js       # Station data fetcher
├── Dockerfile                    # Docker build instructions
├── .dockerignore                # Docker build exclusions
├── .gitignore                   # Git exclusions
├── package.json                 # Dependencies & scripts
└── README.md                    # This file
```

---

## Design Decisions

### Why No Framework?
Chose **vanilla JavaScript + Tailwind CSS** over React/Vue for:
- **Simplicity**: No build process, faster development
- **Performance**: Smaller bundle size, faster load times
- **Learning**: Demonstrates fundamentals without abstraction
- **Deployment**: Static files + Node.js server, easy to host

### Why This Architecture?
- **Separation of concerns**: Backend (src/) vs Frontend (public/)
- **Service layer**: Modular data fetching and analysis
- **Caching strategy**: Server-side data aggregation reduces client load
- **Error resilience**: Continues with partial data if some API endpoints fail

### Why These Tools?
- **Leaflet over Google Maps**: Free, open-source, no API key needed
- **Tailwind over Bootstrap**: Modern utility-first approach, smaller CSS
- **Express over Next.js**: Simpler for this use case, no SSR needed
- **Docker**: Reproducible deployments, matches existing infrastructure

---

## Challenges & Solutions

### Challenge 1: Unreliable API Endpoints
**Problem:** Some hourly WindBorne endpoints return 404 or malformed data
**Solution:** Parallel fetching with individual error handling, continues with available data

### Challenge 2: 13,443 Weather Stations Overwhelm Map
**Problem:** Rendering all stations makes map slow and cluttered
**Solution:** Sample to 2,000 stations for visualization, use full dataset for calculations

### Challenge 3: Balloon Path Reconstruction
**Problem:** API returns individual positions, not flight paths
**Solution:** Group positions within 500km/hour travel distance to reconstruct paths

### Challenge 4: Ocean vs Land Classification
**Problem:** No simple API for geographic classification
**Solution:** Implemented continental bounding box approximation (good enough for demo)

### Challenge 5: Loading Time User Experience
**Problem:** Fetching 24 API endpoints takes 10-15 seconds
**Solution:** Full-screen loading modal with progress tracking and explanation

---

## Future Enhancements

- **Real-time updates**: WebSocket connection for live balloon position updates
- **Historical playback**: Slider to visualize balloon paths over time
- **Advanced analytics**: Wind pattern correlation, forecast accuracy comparison
- **Station filtering**: Filter by country, elevation, or station type
- **Export functionality**: Download coverage data as CSV/GeoJSON
- **Mobile app**: Native iOS/Android app using React Native
- **3D visualization**: Three.js globe with altitude-based rendering

---

## License

This project was created as a coding challenge for WindBorne Systems. Feel free to use the code for educational purposes.

---

## Author

**Ronak Malkan**
Junior Web Developer Applicant | WindBorne Systems

- Portfolio: [ronakverse.net/portfolio](https://ronakverse.net/portfolio)
- GitHub: [Ronak-Malkan](https://github.com/Ronak-Malkan)
- LinkedIn: [ronak-malkan](https://linkedin.com/in/ronak-malkan)

---

## Acknowledgments

- **WindBorne Systems** for the coding challenge and API access
- **NOAA** for the comprehensive weather station database
- **OpenStreetMap** contributors for free map tiles
- **Leaflet.js** community for the excellent mapping library

---

**Built with care for WindBorne Systems | November 2025**
