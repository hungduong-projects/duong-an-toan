import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MapContainerWrapper from '../components/MapContainerWrapper';
import InfoPanel from '../components/InfoPanel';
import Navigation from '../components/Navigation';
import SearchBar from '../components/SearchBar';
import VehicleSelector from '../components/VehicleSelector';
import LocateMeButton from '../components/LocateMeButton';
import { Coordinates, LocationData, AnalysisResult, RiskLevel, RouteInfo, VehicleType, WeatherWarning, GDACSFloodAlert, NCHMFStation } from '../types';
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '../constants';
import { fetchElevation, fetchFloodData, fetchRoute, sampleRoutePoints, fetchLocationDataBatch, fetchVietnameseWarnings, fetchGDACSFloodAlerts, isWithinBBox, fetchNCHMFStations, findNearbyNCHMFStations } from '../services/geoService';
import { getSafetyAdvice, evaluateRouteSafety, identifyDangerousSegments } from '../services/geminiService';

interface LocationState {
  coords: Coordinates;
  name: string;
}

const MainPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [center, setCenter] = useState<Coordinates>(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);

  // Route State
  const [origin, setOrigin] = useState<LocationState | null>(null);
  const [destination, setDestination] = useState<LocationState | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  // Analysis State
  const [selectedLocationData, setSelectedLocationData] = useState<LocationData | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Vehicle Type State
  const [vehicleType, setVehicleType] = useState<VehicleType>(VehicleType.CAR);

  // Rate Limiting State
  const [requestCount, setRequestCount] = useState(0);
  const MAX_REQUESTS_PER_SESSION = 100;
  const mapClickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Weather Warnings State
  const [activeWarnings, setActiveWarnings] = useState<WeatherWarning[]>([]);

  // GDACS Flood Alerts State
  const [gdacsAlerts, setGdacsAlerts] = useState<GDACSFloodAlert[]>([]);

  // NCHMF Monitoring Stations State
  const [nchmfStations, setNchmfStations] = useState<NCHMFStation[]>([]);

  // Initialize: Try to get user location
  useEffect(() => {
    if (navigator.geolocation) {
       navigator.geolocation.getCurrentPosition((pos) => {
         const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
         setUserLocation(coords);
         // Set default origin to user location
         setOrigin({ coords, name: t('search.myLocation') });
       });
    }
  }, [t]);

  // Fetch Vietnamese weather warnings on mount
  useEffect(() => {
    fetchVietnameseWarnings().then(setActiveWarnings);
  }, []);

  // Fetch GDACS flood alerts on mount and refresh every 6 hours
  useEffect(() => {
    const loadGDACSAlerts = async () => {
      const alerts = await fetchGDACSFloodAlerts();
      setGdacsAlerts(alerts);
    };

    loadGDACSAlerts();

    // Refresh every 6 hours (21600000 ms)
    const interval = setInterval(loadGDACSAlerts, 6 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Fetch NCHMF monitoring stations on mount and refresh every 30 minutes
  useEffect(() => {
    const loadNCHMFStations = async () => {
      const stations = await fetchNCHMFStations();
      setNchmfStations(stations);
    };

    loadNCHMFStations();

    // Refresh every 30 minutes (1800000 ms)
    const interval = setInterval(loadNCHMFStations, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);


  // 1. Analyze a Single Point (Explore Mode)
  const analyzePoint = useCallback(async (coords: Coordinates, name?: string) => {
    // Check rate limit
    if (requestCount >= MAX_REQUESTS_PER_SESSION) {
      alert(i18n.language === 'en'
        ? 'Request limit reached. Please refresh the page to continue.'
        : 'Đã đạt giới hạn yêu cầu. Vui lòng làm mới trang để tiếp tục.');
      return;
    }

    setRequestCount(prev => prev + 1);
    setIsSidebarOpen(true);
    setCenter(coords);

    // Reset Route State
    setDestination(null);
    setRouteInfo(null);

    // Reset Analysis
    setSelectedLocationData(null);
    setAnalysis({ riskLevel: RiskLevel.UNKNOWN, advice: t('loading.loadingLocation'), isLoading: true, type: 'point' });

    // Fetch Data
    const elevation = await fetchElevation(coords);

    setAnalysis({ riskLevel: RiskLevel.UNKNOWN, advice: t('loading.checkingWeather'), isLoading: true, type: 'point' });
    const floodData = await fetchFloodData(coords);

    const data: LocationData = {
      elevation,
      precipitation: floodData.precip,
      precipForecast6h: floodData.precipForecast6h,
      precip72h: floodData.precip72h,
      riverDischarge: floodData.discharge,
      locationName: name || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
    };

    setSelectedLocationData(data);

    setAnalysis({ riskLevel: RiskLevel.UNKNOWN, advice: t('loading.analyzingRisk'), isLoading: true, type: 'point' });

    // Find nearby NCHMF monitoring stations for official data
    const nearbyStations = findNearbyNCHMFStations(coords, nchmfStations, 50, 3);

    // Get AI Advice with vehicle type, current language, and nearby official station data
    const aiResult = await getSafetyAdvice(data, vehicleType, i18n.language, nearbyStations);

    // Check if location is within any GDACS flood alert zone
    const matchingGDACSAlerts = gdacsAlerts.filter(alert => isWithinBBox(coords, alert.bbox));

    let finalRisk = aiResult.risk;
    let finalAdvice = aiResult.advice;

    // Override risk if within official flood zone
    if (matchingGDACSAlerts.length > 0) {
      const highestAlert = matchingGDACSAlerts.sort((a, b) => {
        const order = { 'Red': 3, 'Orange': 2, 'Green': 1 };
        return order[b.alertLevel] - order[a.alertLevel];
      })[0];

      // Always set to HIGH if Red or Orange GDACS alert
      if (highestAlert.alertLevel === 'Red' || highestAlert.alertLevel === 'Orange') {
        finalRisk = RiskLevel.HIGH;
        const gdacsWarning = i18n.language === 'en'
          ? `⚠️ GDACS ${highestAlert.alertLevel} Alert: Active flood event detected by satellite. ${aiResult.advice}`
          : `⚠️ Cảnh báo GDACS ${highestAlert.alertLevel}: Phát hiện lũ lụt đang diễn ra qua vệ tinh. ${aiResult.advice}`;
        finalAdvice = gdacsWarning;
      }
    }

    setAnalysis({
      riskLevel: finalRisk,
      advice: finalAdvice,
      isLoading: false,
      type: 'point',
      confidence: aiResult.confidence
    });
  }, [t, i18n, vehicleType, gdacsAlerts]);

  // 2. Analyze a Route
  const analyzeRoute = useCallback(async (start: LocationState, end: LocationState) => {
    setIsSidebarOpen(true);
    setCenter(end.coords); // Focus on destination

    setAnalysis({ riskLevel: RiskLevel.UNKNOWN, advice: t('loading.calculatingRoute'), isLoading: true, type: 'route' });

    // Calculate Route Geometry
    const route = await fetchRoute(start.coords, end.coords);

    if (!route) {
      setAnalysis({ riskLevel: RiskLevel.UNKNOWN, advice: t('error.noRouteFound'), isLoading: false, type: 'point' });
      return;
    }

    setAnalysis({ riskLevel: RiskLevel.UNKNOWN, advice: t('loading.checkingRouteWeather'), isLoading: true, type: 'route' });

    // Sample route points for detailed analysis (8 points along the route)
    const sampledPoints = sampleRoutePoints(route.coordinates, 8);

    // Fetch data for all sampled points
    const sampledData = await fetchLocationDataBatch(sampledPoints);

    setAnalysis({ riskLevel: RiskLevel.UNKNOWN, advice: t('loading.detectingDangers'), isLoading: true, type: 'route' });

    // Identify dangerous segments
    const segmentsWithCoords = sampledData.map((data, index) => ({
      data,
      coords: sampledPoints[index],
      index
    }));
    const dangerousSegments = identifyDangerousSegments(segmentsWithCoords, route.distance, vehicleType);

    // Add dangerous segments to route info
    const enhancedRoute = {
      ...route,
      dangerousSegments
    };
    setRouteInfo(enhancedRoute);

    // Use sampled data for start and end (index 0 and last)
    const startData = sampledData[0];
    const endData = sampledData[sampledData.length - 1];

    // Update location names
    startData.locationName = start.name;
    endData.locationName = end.name;

    setSelectedLocationData(endData);

    setAnalysis({ riskLevel: RiskLevel.UNKNOWN, advice: t('loading.analyzingRouteSafety'), isLoading: true, type: 'route' });

    // Find nearby NCHMF monitoring stations along the route (start, end, and dangerous segments)
    const stationsNearStart = findNearbyNCHMFStations(start.coords, nchmfStations, 50, 2);
    const stationsNearEnd = findNearbyNCHMFStations(end.coords, nchmfStations, 50, 2);

    // Also check for stations near dangerous segments
    const stationsNearDangers = dangerousSegments.flatMap(segment =>
      findNearbyNCHMFStations(segment.coordinates, nchmfStations, 30, 1)
    );

    // Combine and deduplicate stations by ID
    const allRouteStations = [...stationsNearStart, ...stationsNearEnd, ...stationsNearDangers];
    const uniqueStations = allRouteStations.filter((station, index, self) =>
      index === self.findIndex(s => s.id === station.id)
    );

    // AI Evaluate Route with vehicle type, current language, and nearby official station data
    const aiResult = await evaluateRouteSafety(startData, endData, enhancedRoute, vehicleType, i18n.language, uniqueStations);

    setAnalysis({
      riskLevel: aiResult.risk,
      advice: aiResult.advice,
      isLoading: false,
      type: 'route'
    });

  }, [t, i18n, vehicleType]);

  // Handlers for Input Selections
  const handleOriginSelect = (lat: number, lng: number, name: string) => {
    const newOrigin = { coords: { lat, lng }, name };
    setOrigin(newOrigin);

    // Just set the origin, don't auto-analyze
    // User will click "Find Safe Route" button to trigger analysis
    setCenter({ lat, lng });
  };

  const handleDestinationSelect = (lat: number, lng: number, name: string) => {
    const newDest = { coords: { lat, lng }, name };
    setDestination(newDest);

    // Just set the destination, don't auto-analyze
    // User will click "Find Safe Route" button to trigger analysis
    setCenter({ lat, lng });
  };

  const handleFindRoute = () => {
    if (!destination) return;

    // Ensure we have an origin
    if (origin) {
      analyzeRoute(origin, destination);
    } else if (userLocation) {
      const start = { coords: userLocation, name: t('search.myLocation') };
      setOrigin(start);
      analyzeRoute(start, destination);
    }
  };

  // Map Click Handler with debounce (1 second)
  const handleMapClick = (coords: Coordinates) => {
    // Clear existing timeout
    if (mapClickTimeoutRef.current) {
      clearTimeout(mapClickTimeoutRef.current);
    }

    // Set new timeout
    mapClickTimeoutRef.current = setTimeout(() => {
      analyzePoint(coords);
    }, 1000); // 1 second debounce
  };

  const handleLocateMe = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(coords);
          setCenter(coords);
          // If we are in route mode, update origin to be My Location
          if (destination) {
            const start = { coords, name: t('search.myLocation') };
            setOrigin(start);
            // Don't auto-analyze, let user click "Find Safe Route" button
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          alert(t('error.locationAccess'));
        }
      );
    }
  };

  const clearRoute = () => {
    setDestination(null);
    setRouteInfo(null);
    if (userLocation) {
      setOrigin({ coords: userLocation, name: t('search.myLocation') });
      setCenter(userLocation);
    }
    setIsSidebarOpen(false);
  };

  return (
    <div className="relative h-screen w-full flex flex-col overflow-hidden">
      {/* Header with Navigation - Same as About/Donate pages */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
            <h1 className="font-bold text-lg text-slate-900">
              {t('nav.brand')}
            </h1>
          </Link>
          <Navigation />
        </div>
      </header>

      {/* Search Controls - Below Navigation */}
      <div className="absolute top-[73px] left-0 right-0 z-40 pointer-events-none">
        <div className="container mx-auto px-4 py-3">
          <div className="max-w-2xl mx-auto flex flex-col gap-2 pointer-events-auto">
            {/* If Destination is set, show Origin Input too (Route Mode) */}
            {destination && (
              <SearchBar
                placeholder={t('search.origin')}
                initialValue={origin?.name || ""}
                onSelectLocation={handleOriginSelect}
                icon={<div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white"></div>}
              />
            )}

            <div className="flex gap-2 w-full">
              <SearchBar
                placeholder={destination ? t('search.destination') : t('search.placeholder')}
                initialValue={destination?.name || ""}
                onSelectLocation={handleDestinationSelect}
                icon={destination ? <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white"></div> : undefined}
              />

              {/* Reset/Cancel Button if Route Mode */}
              {destination && (
                <button
                  onClick={clearRoute}
                  className="bg-white text-slate-500 px-3 rounded-xl shadow-sm border border-slate-200 hover:bg-slate-100 transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Vehicle Selector & Find Route Button - Show only when destination is selected */}
            {destination && (
              <div className="flex flex-col gap-2">
                <VehicleSelector selectedVehicle={vehicleType} onSelect={setVehicleType} />
                <button
                  onClick={handleFindRoute}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg transition-all hover:shadow-xl active:scale-[0.98]"
                >
                  {t('button.findSafeRoute')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative z-0">
        <MapContainerWrapper
          center={center}
          zoom={DEFAULT_ZOOM}
          userLocation={userLocation}
          startLocation={origin ? origin.coords : null}
          routeCoordinates={routeInfo?.coordinates || null}
          dangerousSegments={routeInfo?.dangerousSegments || null}
          nchmfStations={nchmfStations}
          onLocationSelect={handleMapClick}
        />
      </div>

      {/* Locate Me Button - Fixed Bottom Right */}
      <LocateMeButton onLocateMe={handleLocateMe} />

      {/* Floating Info Panel */}
      {isSidebarOpen && selectedLocationData && analysis && (
        <InfoPanel
          locationData={selectedLocationData}
          analysis={analysis}
          routeInfo={routeInfo}
          activeWarnings={activeWarnings}
          onClose={() => {
            setIsSidebarOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default MainPage;
