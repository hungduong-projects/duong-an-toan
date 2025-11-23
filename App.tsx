import React, { useState, useEffect, useCallback } from 'react';
import MapContainerWrapper from './components/MapContainerWrapper';
import InfoPanel from './components/InfoPanel';
import SearchBar from './components/SearchBar';
import { Coordinates, LocationData, AnalysisResult, RiskLevel, RouteInfo } from './types';
import { DEFAULT_CENTER, DEFAULT_ZOOM } from './constants';
import { fetchElevation, fetchFloodData, fetchRoute } from './services/geoService';
import { getSafetyAdvice, evaluateRouteSafety } from './services/geminiService';

interface LocationState {
  coords: Coordinates;
  name: string;
}

const App: React.FC = () => {
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

  // Initialize: Try to get user location
  useEffect(() => {
    if (navigator.geolocation) {
       navigator.geolocation.getCurrentPosition((pos) => {
         const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
         setUserLocation(coords);
         // Set default origin to user location
         setOrigin({ coords, name: "Vị trí của tôi" });
       });
    }
  }, []);

  // 1. Analyze a Single Point (Explore Mode)
  const analyzePoint = useCallback(async (coords: Coordinates, name?: string) => {
    setIsSidebarOpen(true);
    setCenter(coords);
    
    // Reset Route State
    setDestination(null); 
    setRouteInfo(null);
    
    // Reset Analysis
    setSelectedLocationData(null);
    setAnalysis({ riskLevel: RiskLevel.UNKNOWN, advice: "Đang tải dữ liệu...", isLoading: true, type: 'point' });

    // Fetch Data
    const elevation = await fetchElevation(coords);
    const floodData = await fetchFloodData(coords);

    const data: LocationData = {
      elevation,
      precipitation: floodData.precip,
      riverDischarge: floodData.discharge,
      locationName: name || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
    };

    setSelectedLocationData(data);

    // Get AI Advice
    const aiResult = await getSafetyAdvice(data);

    setAnalysis({
      riskLevel: aiResult.risk,
      advice: aiResult.advice,
      isLoading: false,
      type: 'point'
    });
  }, []);

  // 2. Analyze a Route
  const analyzeRoute = useCallback(async (start: LocationState, end: LocationState) => {
    setIsSidebarOpen(true);
    setCenter(end.coords); // Focus on destination
    
    setAnalysis({ riskLevel: RiskLevel.UNKNOWN, advice: "Đang tính toán tuyến đường...", isLoading: true, type: 'route' });
    
    // Calculate Route Geometry
    const route = await fetchRoute(start.coords, end.coords);
    
    if (!route) {
      setAnalysis({ riskLevel: RiskLevel.UNKNOWN, advice: "Không tìm thấy đường đi.", isLoading: false, type: 'point' });
      return;
    }
    setRouteInfo(route);

    // Fetch Data for Start and End points
    const [startElev, startFlood, endElev, endFlood] = await Promise.all([
      fetchElevation(start.coords),
      fetchFloodData(start.coords),
      fetchElevation(end.coords),
      fetchFloodData(end.coords)
    ]);

    const startData: LocationData = {
      elevation: startElev,
      precipitation: startFlood.precip,
      riverDischarge: startFlood.discharge,
      locationName: start.name
    };

    const endData: LocationData = {
      elevation: endElev,
      precipitation: endFlood.precip,
      riverDischarge: endFlood.discharge,
      locationName: end.name
    };

    setSelectedLocationData(endData); 

    // AI Evaluate Route
    const aiResult = await evaluateRouteSafety(startData, endData, route);

    setAnalysis({
      riskLevel: aiResult.risk,
      advice: aiResult.advice,
      isLoading: false,
      type: 'route'
    });

  }, []);

  // Handlers for Input Selections
  const handleOriginSelect = (lat: number, lng: number, name: string) => {
    const newOrigin = { coords: { lat, lng }, name };
    setOrigin(newOrigin);
    
    if (destination) {
      analyzeRoute(newOrigin, destination);
    } else {
      setCenter({ lat, lng }); // Just show it on map if no destination yet
    }
  };

  const handleDestinationSelect = (lat: number, lng: number, name: string) => {
    const newDest = { coords: { lat, lng }, name };
    setDestination(newDest);

    // If we have an origin (either user loc or explicitly set), calculate route
    if (origin) {
      analyzeRoute(origin, newDest);
    } else if (userLocation) {
       // Fallback if origin state was cleared for some reason
       const start = { coords: userLocation, name: "Vị trí của tôi" };
       setOrigin(start);
       analyzeRoute(start, newDest);
    } else {
      // Just analyze the point if we absolutely have no start point
      analyzePoint({ lat, lng }, name);
    }
  };

  // Map Click Handler
  const handleMapClick = (coords: Coordinates) => {
    // If we are in route mode (destination set), maybe update destination? 
    // For simplicity, map click always analyzes that specific point, clearing route mode.
    // Use can then hit "Directions" (conceptually) - but here we just reset to point mode.
    analyzePoint(coords);
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
            const start = { coords, name: "Vị trí của tôi" };
            setOrigin(start);
            analyzeRoute(start, destination);
          }
        },
        (error) => {
          console.error("Geolocation error:", error);
          alert("Không thể truy cập vị trí.");
        }
      );
    }
  };

  const clearRoute = () => {
    setDestination(null);
    setRouteInfo(null);
    if (userLocation) {
      setOrigin({ coords: userLocation, name: "Vị trí của tôi" });
      setCenter(userLocation);
    }
    setIsSidebarOpen(false);
  };

  return (
    <div className="relative h-screen w-full flex flex-col overflow-hidden">
      {/* Header & Search */}
      <header className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none p-4 flex flex-col gap-2">
        
        {/* Top Row: Brand & Simple Search OR Route Inputs */}
        <div className="flex flex-col md:flex-row gap-2 items-start md:items-start md:justify-between">
          
          {/* Brand */}
          <div className="hidden md:flex items-center gap-2 pointer-events-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 py-2 rounded-full shadow-lg border border-slate-200 dark:border-slate-700">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
            <h1 className="font-bold text-slate-800 dark:text-white whitespace-nowrap">Dự Đoán Lũ</h1>
          </div>

          {/* Search Container */}
          <div className="w-full md:max-w-md pointer-events-auto flex flex-col gap-2">
            
            {/* If Destination is set, show Origin Input too (Route Mode) */}
            {destination && (
               <div className="animate-in slide-in-from-top-2 fade-in duration-300">
                 <SearchBar 
                   placeholder="Chọn điểm đi..." 
                   initialValue={origin?.name || ""}
                   onSelectLocation={handleOriginSelect}
                   className="shadow-sm"
                   icon={<div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white"></div>}
                 />
               </div>
            )}

            <div className="flex gap-2 w-full">
              <SearchBar 
                placeholder={destination ? "Chọn điểm đến..." : "Tìm địa điểm hoặc xem lộ trình..."}
                initialValue={destination?.name || ""}
                onSelectLocation={handleDestinationSelect}
                icon={destination ? <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white"></div> : undefined}
              />
              
              {/* Reset/Cancel Button if Route Mode */}
              {destination && (
                <button 
                  onClick={clearRoute}
                  className="bg-white dark:bg-slate-800 text-slate-500 px-3 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          
          {/* Locate Button */}
          <button 
            onClick={handleLocateMe}
            className="pointer-events-auto bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors absolute right-4 bottom-[-60px] md:static"
            aria-label="Định vị tôi"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>

        </div>
      </header>

      {/* Map */}
      <div className="flex-1 relative z-0">
        <MapContainerWrapper 
          center={center} 
          zoom={DEFAULT_ZOOM}
          userLocation={userLocation}
          startLocation={origin ? origin.coords : null}
          routeCoordinates={routeInfo?.coordinates || null}
          onLocationSelect={handleMapClick}
        />
      </div>

      {/* Floating Info Panel */}
      {isSidebarOpen && selectedLocationData && analysis && (
        <InfoPanel 
          locationData={selectedLocationData}
          analysis={analysis}
          routeInfo={routeInfo}
          onClose={() => {
            setIsSidebarOpen(false);
          }}
        />
      )}
    </div>
  );
};

export default App;