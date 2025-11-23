import { Coordinates, RainViewerData, SearchResult, RouteInfo } from '../types';
import { RAINVIEWER_API, OPEN_ELEVATION_API, OPEN_METEO_FLOOD_API, OPEN_METEO_FORECAST_API } from '../constants';

export const fetchRainViewerTimestamp = async (): Promise<number | null> => {
  try {
    const response = await fetch(RAINVIEWER_API);
    if (!response.ok) throw new Error('Failed to fetch rain data');
    const data: RainViewerData = await response.json();
    // Get the most recent 'past' frame or the first 'nowcast' frame
    if (data.radar.past.length > 0) {
      return data.radar.past[data.radar.past.length - 1].time;
    }
    return null;
  } catch (error) {
    console.error("RainViewer Error:", error);
    return null;
  }
};

export const fetchElevation = async (coords: Coordinates): Promise<number | null> => {
  try {
    // Note: Public OpenElevation can be slow/rate-limited. 
    // In a production app, we would use a more robust paid provider or a backend proxy.
    const response = await fetch(`${OPEN_ELEVATION_API}?locations=${coords.lat},${coords.lng}`);
    const data = await response.json();
    if (data && data.results && data.results.length > 0) {
      return data.results[0].elevation;
    }
    return null;
  } catch (error) {
    console.error("Elevation API Error:", error);
    // Fallback logic could go here
    return null;
  }
};

export const fetchFloodData = async (coords: Coordinates): Promise<{ discharge: number, precip: number }> => {
  try {
    // Fetch river discharge (Flood API) and Precipitation (Forecast API)
    const floodUrl = `${OPEN_METEO_FLOOD_API}?latitude=${coords.lat}&longitude=${coords.lng}&daily=river_discharge_mean&forecast_days=1`;
    const weatherUrl = `${OPEN_METEO_FORECAST_API}?latitude=${coords.lat}&longitude=${coords.lng}&current=precipitation`;

    const [floodRes, weatherRes] = await Promise.all([
      fetch(floodUrl),
      fetch(weatherUrl)
    ]);

    let discharge = 0;
    let precip = 0;

    if (floodRes.ok) {
      const floodData = await floodRes.json();
      if (floodData.daily && floodData.daily.river_discharge_mean) {
        discharge = floodData.daily.river_discharge_mean[0] || 0;
      }
    }

    if (weatherRes.ok) {
      const weatherData = await weatherRes.json();
      if (weatherData.current) {
        precip = weatherData.current.precipitation || 0;
      }
    }

    return { discharge, precip };
  } catch (error) {
    console.error("Meteo API Error:", error);
    return { discharge: 0, precip: 0 };
  }
};

// Search for places in Vietnam
export const searchPlaces = async (query: string): Promise<SearchResult[]> => {
  if (!query || query.length < 3) return [];
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=vn&limit=5`
    );
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error("Search Error:", error);
    return [];
  }
};

// Calculate Route using OSRM
export const fetchRoute = async (start: Coordinates, end: Coordinates): Promise<RouteInfo | null> => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];
    const coordinates = route.geometry.coordinates.map((coord: [number, number]) => ({
      lat: coord[1],
      lng: coord[0]
    }));

    return {
      coordinates,
      distance: route.distance, // meters
      duration: route.duration // seconds
    };
  } catch (error) {
    console.error("Routing Error:", error);
    return null;
  }
};