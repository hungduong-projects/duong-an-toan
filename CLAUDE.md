# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Đường An Toàn** (Safe Road) - A Vietnamese-language React web application that provides real-time flood risk assessment and route safety analysis during storms in Vietnam. The app uses Google Gemini AI to analyze environmental data and provide localized safety advice.

## Development Commands

```bash
# Install dependencies
npm install

# Run development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm preview
```

## Environment Configuration

**Required:** Create a `.env` file in the project root:
```
GEMINI_API_KEY=your_api_key_here
```

The Vite config (vite.config.ts:14-15) injects this as `process.env.API_KEY` at build time. Get a free key at https://aistudio.google.com/apikey.

## Architecture

### Core Application Flow

The app operates in two modes controlled by state in `App.tsx`:

1. **Point Analysis Mode** (default): User clicks on map or searches for a location → fetches elevation, precipitation, and river discharge data → sends to Gemini AI for risk assessment with vehicle type context → displays risk level and Vietnamese safety advice

2. **Route Analysis Mode**: User sets both origin and destination → calculates route via OSRM → **samples 8 points along route** → fetches environmental data for all sampled points → **identifies dangerous segments** → Gemini evaluates overall travel safety with vehicle-specific advice → displays route on map with warning markers at dangerous segments

State transitions: Setting a destination switches to route mode. Clicking the map or clearing the route returns to point mode.

### Vehicle Type Integration

Users select their mode of transport (car 🚗, motorcycle 🏍️, or pedestrian 🚶) via `VehicleSelector` component. This affects:
- **Risk thresholds**: Different water depth tolerances (car: 30cm, motorcycle: 15cm, pedestrian: 15cm)
- **AI advice**: Vehicle-specific safety recommendations in Vietnamese
- **Segment identification**: More conservative warnings for vulnerable vehicles

### Service Layer Architecture

**services/geoService.ts**: Handles all external geographic data APIs with performance optimizations
- `fetchElevation()`: Open-Elevation API for terrain height **with 7-day localStorage caching** (reduces API calls ~70%)
- `fetchFloodData()`: Fetches current precipitation + **6-hour forecast** from Open-Meteo Forecast API
- `fetchRoute()`: OSRM routing engine for route geometry and travel time
- `searchPlaces()`: Nominatim (OSM) for Vietnamese place name search
- `sampleRoutePoints()`: Evenly samples N points (default 8) along route coordinates for detailed analysis
- `fetchLocationDataBatch()`: Parallel data fetching for multiple coordinates (used for route sampling)
- `fetchVietnameseWarnings()`: Scrapes real-time weather warnings from NCHMF (Vietnam's National Center for Hydro-Meteorological Forecasting)
- `fetchNCHMFStations()`: Fetches real-time monitoring station data from NCHMF API endpoint `/LayerMapBox/getDSCanhbaoSLLQ` with rainfall measurements, flash flood risk, and landslide risk for ~60-90 active stations across Vietnam
- `findNearbyNCHMFStations()`: **NEW** - Finds nearby monitoring stations using Haversine distance formula. Takes target coordinates, station array, search radius (default 50km), and max results (default 3). Returns stations sorted by distance with calculated distance field. Used to provide local expert data to AI analysis.
- `fetchWithRetry()`: Helper function with 2 retries + exponential backoff for all API calls (reduces failures ~30-40%)

**services/geminiService.ts**: Google Gemini AI integration with enhanced accuracy
- `getSafetyAdvice(data, vehicleType?, language?, nearbyStations?)`: Analyzes single point flood risk with Vietnam-specific context, vehicle type, **and returns confidence level** (High/Medium/Low based on data quality). **NEW**: Accepts nearby NCHMF stations array - when provided, AI considers official expert assessments (flash flood/landslide risk) and boosts confidence to HIGH.
- `evaluateRouteSafety(start, end, routeInfo, vehicleType?, language?, nearbyStations?)`: Assesses overall travel safety **including dangerous segments** for consistent recommendations. **NEW**: Accepts nearby stations found along the route for enhanced local accuracy.
- `identifyDangerousSegments(segmentData, totalDistance, vehicleType?)`: Identifies HIGH/MEDIUM risk segments using **current + forecast precipitation** (>30mm = extended rain warning)
- All functions use `gemini-2.5-flash` model with JSON response mode
- **AI prompts include NCHMF station context** when available: Shows station name, distance, official risk levels (flash flood/landslide), current rainfall, and 6h forecast. AI gives significant weight to these expert assessments.
- **Improved fallback logic** with Vietnam-specific thresholds:
  - Elevation <3m = HIGH (delta), 3-10m = MEDIUM, >10m = LOW
  - Precipitation >20mm = HIGH, 10-20mm = MEDIUM, <10mm = LOW
  - **Total rain (current + 6h forecast) >30mm = HIGH risk** (extended rainfall)
  - Considers worst-case risk across all factors
  - **Note**: River discharge logic removed (unreliable data)

### Component Structure

**MainPage.tsx**: Main orchestrator managing:
- Dual mode state (point vs route analysis)
- Vehicle type selection (car/motorcycle/pedestrian)
- Location selection handling (map clicks, search, geolocation)
- Route sampling and dangerous segment identification
- **NCHMF station management**: Fetches stations on mount, refreshes every 30 minutes, finds nearby stations for AI analysis
- **Point analysis**: Finds up to 3 nearby stations (50km radius) and passes to `getSafetyAdvice()`
- **Route analysis**: Finds stations near start (2), end (2), and dangerous segments (1 each, 30km radius), deduplicates by ID, passes to `evaluateRouteSafety()`
- Coordinates all data fetching and AI analysis with vehicle context and official NCHMF station data
- Controls InfoPanel visibility

**MapContainerWrapper.tsx**: Leaflet map integration
- Renders OpenStreetMap tiles with RainViewer overlay
- Displays user location marker (blue circle)
- Shows route polyline when in route mode
- **Warning markers (⚠️) at dangerous segment locations** with clickable popups
- **NCHMF station markers (color-coded dots)**: Red (high risk), amber (medium), green (low risk) with popups showing rainfall data and risk levels
- Handles map click events

**SearchBar.tsx**: Place search with Vietnamese location support
- Debounced Nominatim search (Vietnam country code filter)
- Dropdown results with selection callback

**InfoPanel.tsx**: Floating panel displaying analysis results with enhanced information
- **Official Warnings Section**: Displays NCHMF weather warnings (🚨 Emergency, ⚠️ High, ⚡ Medium severity) at the top when available
- Shows location data (elevation, precipitation **with 6h forecast indicator**)
- Risk level indicator with color coding
- AI-generated Vietnamese safety advice **with confidence level** (✓ High, ⚠️ Medium/Low)
- Route information when applicable (distance, duration)
- **Dangerous segments list** (route mode): scrollable list showing each risky segment with Km marker, risk level, and reason
- **Loading states**: Shows detailed progress ("🗺️ Đang tính toán tuyến đường...", "🌦️ Đang kiểm tra thời tiết...", "🤖 Đang phân tích...")

**VehicleSelector.tsx**: Vehicle type selection component
- Icon-based toggle buttons (🚗 🏍️ 🚶)
- Displays Vietnamese labels: Ô tô, Xe máy, Đi bộ
- Integrates with header UI

### Type System

All shared types defined in `types.ts`:
- `RiskLevel` enum: Low/Medium/High/Unknown
- `VehicleType` enum: CAR/MOTORCYCLE/PEDESTRIAN
- `LocationData`: Environmental metrics for a point
- `AnalysisResult`: AI assessment with loading state and mode type
- `RouteInfo`: Route geometry, travel metrics, and **optional dangerousSegments array**
- `DangerousSegment`: Coordinates, risk level, reason, distance from start
- `NCHMFStation`: Monitoring station data with coordinates, rainfall (current + 6h forecast), flash flood risk, and landslide risk levels
- `NCHMFRiskLevel`: Vietnamese risk levels type ("Thấp" | "Trung bình" | "Cao")
- `Coordinates`: Standard lat/lng interface

### Constants Configuration

`constants.ts` defines:
- Map bounds constraining view to Vietnam region (6.0°N to 24.5°N)
- Default center (15.9°N, 105.8°E) for central Vietnam view
- All external API endpoints (no backend proxy)

### Vietnamese Language Support

All user-facing content is in Vietnamese:
- Gemini prompts contextualized for Vietnam geography (Mekong Delta, Red River Delta, Central Coast)
- Safety advice references Vietnamese cities (Hà Nội, TP.HCM)
- UI text, placeholders, and error messages in Vietnamese
- Location search filtered to Vietnam (`countrycodes=vn`)

## Key Technical Details

- **Vite Dev Server**: Runs on port 3000, host 0.0.0.0 for network access
- **Path Alias**: `@/*` maps to project root in both tsconfig and Vite
- **React Version**: React 19.2.0 with new JSX transform
- **Map Library**: React-Leaflet 5.0 (wraps Leaflet 1.9.4)
- **Styling**: Tailwind CSS via CDN in index.html
- **PWA Support**: Service worker and manifest for offline capability

## API Dependencies

All external APIs are free/public with optimizations:
- **Open-Elevation**: Can be slow, no auth required - **Now with 7-day caching to reduce calls**
- **Open-Meteo**: Free tier, no key needed - **Fetches current + 6h forecast data**
- **NCHMF Vietnam**:
  - Official weather warnings scraped from nchmf.gov.vn (no API, HTML parsing)
  - **Real-time monitoring stations API** at luquetsatlo.nchmf.gov.vn/LayerMapBox/getDSCanhbaoSLLQ - Returns ~60-90 active stations with rainfall data, flash flood risk, and landslide risk levels
- **OSRM**: Public demo server (project-osrm.org)
- **Nominatim**: OSM search with usage policy limits
- **Google Gemini**: Requires API key (free tier available)
- **Performance**: All APIs use retry logic (2 retries with exponential backoff)

## Important Implementation Notes

1. **AI Error Handling**: Gemini services always return a result. If AI fails, fallback uses rule-based risk assessment based on elevation and precipitation thresholds specific to Vietnamese flood conditions. **Returns confidence level** indicating data quality.

2. **API Reliability**: **Retry logic with exponential backoff** (2 retries) reduces failures by ~30-40%. External API failures gracefully degrade to fallback data (e.g., null elevation, zero precipitation). **Elevation data is cached for 7 days** in localStorage.

3. **Geolocation**: User location is optional. App defaults to origin = user location when calculating routes, but can work without it.

4. **Vietnam Focus**: Map bounds prevent panning too far from Vietnam. Search is restricted to Vietnamese locations. AI prompts include Vietnamese geographic context. **Official warnings** from NCHMF displayed when available.

5. **Performance Optimizations**:
   - **~70% fewer elevation API calls** thanks to localStorage caching
   - **6-hour precipitation forecast** improves prediction accuracy
   - **Detailed loading states** improve perceived performance
   - **Dangerous segments passed to AI** ensures consistent advice
   - **NCHMF station data integration**: AI analysis now includes official Vietnamese meteorological expert assessments, significantly improving accuracy and confidence levels

## Route Segment Analysis Feature

When analyzing a route, the app performs detailed segment-level risk assessment:

1. **Sampling Strategy**: Route coordinates are sampled at 8 evenly-distributed points (configurable via `sampleRoutePoints(coords, 8)`)
2. **Parallel Data Fetching**: All sampled points fetch elevation + precipitation (current + 6h forecast) data simultaneously
3. **Threshold-Based Identification**: Each sampled point is evaluated against Vietnam-specific thresholds:
   - Elevation <3m = HIGH risk, 3-10m = MEDIUM risk
   - Current precipitation >20mm = HIGH risk, 10-20mm = MEDIUM risk
   - **Total rain (current + 6h forecast) >30mm = HIGH risk** (extended rainfall warning)
4. **Dangerous Segment Creation**: Points with MEDIUM or HIGH risk become `DangerousSegment` objects with:
   - Exact coordinates for map markers
   - Calculated distance from route start (in km)
   - Risk level and human-readable reason in Vietnamese
5. **UI Presentation**:
   - Map: ⚠️ warning markers at dangerous coordinates with hover popups
   - InfoPanel: Scrollable list format "Km 5.2: độ cao thấp (2.1m), mưa lớn kéo dài (32mm)"
   - **Official warnings** from NCHMF shown at top of panel
   - **Confidence level** displayed with AI advice
6. **AI Integration**: **Dangerous segments are now included in the AI prompt**, ensuring the AI sees all identified hazards and provides consistent overall risk assessment that aligns with segment-level warnings
