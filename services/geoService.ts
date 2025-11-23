import { Coordinates, RainViewerData, SearchResult, RouteInfo, WeatherWarning, LocationData, GDACSFloodAlert, NCHMFStation } from '../types';
import { RAINVIEWER_API, OPEN_ELEVATION_API, OPEN_METEO_FLOOD_API, OPEN_METEO_FORECAST_API } from '../constants';
import { z } from 'zod';
import DOMPurify from 'dompurify';

// Validation schemas
const NCHMFStationSchema = z.object({
  id: z.number(),
  commune_name: z.string(),
  district_name: z.string(),
  provinceName: z.string(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  luongmuatd: z.number().nullable(),
  luongmuadb: z.number(),
  nguycoluquet: z.enum(['Thấp', 'Trung bình', 'Cao']),
  nguycosatlo: z.enum(['Thấp', 'Trung bình', 'Cao'])
}).passthrough(); // Allow extra fields

const SearchResultSchema = z.object({
  lat: z.string(),
  lon: z.string(),
  display_name: z.string(),
  place_id: z.number().optional(),
  osm_id: z.number().optional(),
  osm_type: z.string().optional()
}).passthrough();

// Helper function: Retry fetch with exponential backoff
async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      // If not ok, throw to trigger retry
      if (i === retries) throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (i === retries) throw error;
      // Exponential backoff: wait 1s, then 2s
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  throw new Error('All retries failed');
}

// Cache configuration
const ELEVATION_CACHE_KEY = 'elevation_cache';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

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
  // Try cache first (round to 3 decimals for cache key)
  const cacheKey = `${coords.lat.toFixed(3)},${coords.lng.toFixed(3)}`;
  const cached = localStorage.getItem(ELEVATION_CACHE_KEY);

  if (cached) {
    try {
      const cache = JSON.parse(cached);
      const cachedData = cache[cacheKey];

      // Validate cached data structure and values
      if (cachedData &&
          typeof cachedData.elevation === 'number' &&
          cachedData.elevation >= -500 && cachedData.elevation <= 9000 && // Valid elevation range
          typeof cachedData.time === 'number' &&
          Date.now() - cachedData.time < CACHE_DURATION) {
        return cachedData.elevation;
      }
    } catch (e) {
      // Invalid/corrupted cache, clear it
      localStorage.removeItem(ELEVATION_CACHE_KEY);
    }
  }

  // Fetch from API with retry logic
  try {
    const response = await fetchWithRetry(`${OPEN_ELEVATION_API}?locations=${coords.lat},${coords.lng}`);
    const data = await response.json();
    const elevation = data?.results?.[0]?.elevation ?? null;

    // Save to cache
    try {
      const cache = cached ? JSON.parse(cached) : {};
      cache[cacheKey] = { elevation, time: Date.now() };
      localStorage.setItem(ELEVATION_CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      // Cache save failed, continue without caching
      console.warn("Failed to save elevation cache:", e);
    }

    return elevation;
  } catch (error) {
    console.error("Elevation API Error:", error);
    return null;
  }
};

export const fetchFloodData = async (coords: Coordinates): Promise<{ discharge: number, precip: number, precipForecast6h: number, precip72h: number }> => {
  try {
    // Fetch river discharge (Flood API), current precipitation + 6h forecast, and 72h historical
    const floodUrl = `${OPEN_METEO_FLOOD_API}?latitude=${coords.lat}&longitude=${coords.lng}&daily=river_discharge_mean&forecast_days=1`;
    const weatherUrl = `${OPEN_METEO_FORECAST_API}?latitude=${coords.lat}&longitude=${coords.lng}&current=precipitation&hourly=precipitation&forecast_hours=6`;

    const [floodRes, weatherRes, precip72h] = await Promise.all([
      fetchWithRetry(floodUrl),
      fetchWithRetry(weatherUrl),
      fetchPrecipitation72h(coords) // NEW: Fetch 72h accumulated rainfall
    ]);

    let discharge = 0;
    let precip = 0;
    let precipForecast6h = 0;

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
      // Sum next 6 hours of precipitation
      if (weatherData.hourly?.precipitation) {
        precipForecast6h = weatherData.hourly.precipitation
          .slice(0, 6)
          .reduce((sum: number, val: number) => sum + (val || 0), 0);
      }
    }

    return { discharge, precip, precipForecast6h, precip72h };
  } catch (error) {
    console.error("Meteo API Error:", error);
    return { discharge: 0, precip: 0, precipForecast6h: 0, precip72h: 0 };
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

    const data = await response.json();

    // Validate each search result against schema
    try {
      const validatedResults = z.array(SearchResultSchema).parse(data);

      // Sanitize display names and validate coordinates
      return validatedResults.map(result => ({
        ...result,
        display_name: DOMPurify.sanitize(result.display_name, { ALLOWED_TAGS: [] }),
        lat: result.lat, // Keep as string for compatibility
        lon: result.lon
      })) as SearchResult[];
    } catch (validationError) {
      console.error('Search results validation failed:', validationError);
      // Try to salvage valid results
      if (Array.isArray(data)) {
        return data.filter((result: any) => {
          try {
            SearchResultSchema.parse(result);
            return true;
          } catch {
            return false;
          }
        }).map((result: any) => ({
          ...result,
          display_name: DOMPurify.sanitize(result.display_name, { ALLOWED_TAGS: [] })
        })) as SearchResult[];
      }
      return [];
    }
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

// Sample points evenly along a route for analysis
export const sampleRoutePoints = (coordinates: Coordinates[], numSamples: number = 8): Coordinates[] => {
  if (coordinates.length === 0) return [];
  if (coordinates.length <= numSamples) return coordinates;

  const samples: Coordinates[] = [];
  const step = (coordinates.length - 1) / (numSamples - 1);

  for (let i = 0; i < numSamples; i++) {
    const index = Math.round(i * step);
    samples.push(coordinates[index]);
  }

  return samples;
};

// Fetch location data for multiple coordinates in parallel
export const fetchLocationDataBatch = async (
  coordinates: Coordinates[]
): Promise<LocationData[]> => {
  try {
    // Fetch all data in parallel
    const dataPromises = coordinates.map(async (coords) => {
      const [elevation, floodData] = await Promise.all([
        fetchElevation(coords),
        fetchFloodData(coords)
      ]);

      return {
        elevation,
        precipitation: floodData.precip,
        precipForecast6h: floodData.precipForecast6h,
        precip72h: floodData.precip72h,
        riverDischarge: floodData.discharge,
        locationName: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
      };
    });

    return await Promise.all(dataPromises);
  } catch (error) {
    console.error("Batch fetch error:", error);
    // Return empty data for failed fetches
    return coordinates.map(coords => ({
      elevation: null,
      precipitation: 0,
      precipForecast6h: 0,
      precip72h: 0,
      riverDischarge: 0,
      locationName: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`
    }));
  }
};

// Fetch Vietnamese weather warnings from NCHMF
export const fetchVietnameseWarnings = async (): Promise<WeatherWarning[]> => {
  try {
    const response = await fetch('https://www.nchmf.gov.vn');
    if (!response.ok) return [];

    const html = await response.text();
    const warnings: WeatherWarning[] = [];

    // Parse warnings from the HTML
    // Look for patterns like: <a href="..." alt="TIN ...">TIN ...
    const warningRegex = /<a[^>]+href="([^"]+)"[^>]+alt="([^"]+)"[^>]*>([^<]+)<label>\(([^)]+)\)<\/label>/gi;
    let match;

    while ((match = warningRegex.exec(html)) && warnings.length < 5) {
      // Sanitize extracted HTML content to prevent XSS
      const rawTitle = match[2] || match[3];
      const rawTimestamp = match[4];

      // Strip all HTML tags and entities
      const title = DOMPurify.sanitize(rawTitle, { ALLOWED_TAGS: [] });
      const timestamp = DOMPurify.sanitize(rawTimestamp, { ALLOWED_TAGS: [] });

      // Skip if sanitization resulted in empty strings
      if (!title || !timestamp) continue;

      // Categorize based on keywords
      let category: WeatherWarning['category'] = 'other';
      let severity: WeatherWarning['severity'] = 'medium';

      const titleUpper = title.toUpperCase();
      if (titleUpper.includes('LŨ') || titleUpper.includes('FLOODING')) {
        category = 'flood';
      } else if (titleUpper.includes('MƯA') || titleUpper.includes('RAIN')) {
        category = 'rain';
      } else if (titleUpper.includes('SẠT LỞ') || titleUpper.includes('LANDSLIDE')) {
        category = 'landslide';
      } else if (titleUpper.includes('BÃO') || titleUpper.includes('TYPHOON')) {
        category = 'typhoon';
      } else if (titleUpper.includes('LẠNH') || titleUpper.includes('COLD')) {
        category = 'cold';
      }

      // Determine severity
      if (titleUpper.includes('KHẨN CẤP') || titleUpper.includes('EMERGENCY')) {
        severity = 'emergency';
      } else if (titleUpper.includes('NGUY HIỂM') || titleUpper.includes('RẤT LỚN')) {
        severity = 'high';
      }

      warnings.push({
        title,
        timestamp,
        severity,
        category
      });
    }

    return warnings;
  } catch (error) {
    console.error("NCHMF fetch error:", error);
    return [];
  }
};

// Fetch 72-hour accumulated precipitation for ground saturation detection
export const fetchPrecipitation72h = async (coords: Coordinates): Promise<number> => {
  try {
    // Use Open-Meteo Forecast API with past_days parameter
    const url = `${OPEN_METEO_FORECAST_API}?latitude=${coords.lat}&longitude=${coords.lng}&hourly=precipitation&past_days=3&forecast_days=0&timezone=Asia/Bangkok`;
    const response = await fetchWithRetry(url);
    const data = await response.json();

    if (data.hourly?.precipitation) {
      // Sum all precipitation values from the past 72 hours
      const total72h = data.hourly.precipitation.reduce((sum: number, val: number) => sum + (val || 0), 0);
      return total72h;
    }
    return 0;
  } catch (error) {
    console.error("72h precipitation error:", error);
    return 0;
  }
};

// Fetch active flood alerts from GDACS (Global Disaster Alert and Coordination System)
export const fetchGDACSFloodAlerts = async (): Promise<GDACSFloodAlert[]> => {
  try {
    const response = await fetch(
      'https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventtypes=FL&country=Vietnam'
    );

    if (!response.ok) return [];

    const data = await response.json();

    // Filter for current/active floods only and map to our interface
    return data.features
      .filter((f: any) => f.properties.iscurrent === 'true')
      .map((f: any) => ({
        id: f.properties.eventid,
        alertLevel: f.properties.alertlevel,
        bbox: f.bbox, // [minLng, minLat, maxLng, maxLat]
        fromDate: f.properties.fromdate,
        toDate: f.properties.todate,
        affectedCountries: f.properties.affectedcountries?.split(',').map((c: string) => c.trim()) || [],
        description: f.properties.name || f.properties.description || 'Flood event',
        severity: parseFloat(f.properties.episodealertscore) || 0
      }));
  } catch (error) {
    console.error("GDACS API Error:", error);
    return [];
  }
};

// Helper: Check if coordinates are within a bounding box
export const isWithinBBox = (coords: Coordinates, bbox: [number, number, number, number]): boolean => {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return coords.lat >= minLat && coords.lat <= maxLat && coords.lng >= minLng && coords.lng <= maxLng;
};

// Helper: Calculate distance between two coordinates using Haversine formula
const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (coord2.lat - coord1.lat) * Math.PI / 180;
  const dLon = (coord2.lng - coord1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(coord1.lat * Math.PI / 180) * Math.cos(coord2.lat * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// Find nearby NCHMF monitoring stations within specified radius
export const findNearbyNCHMFStations = (
  targetCoords: Coordinates,
  allStations: NCHMFStation[],
  radiusKm: number = 50,
  maxResults: number = 3
): Array<NCHMFStation & { distance: number }> => {
  // Calculate distances and filter by radius
  const stationsWithDistance = allStations
    .map(station => ({
      ...station,
      distance: calculateDistance(targetCoords, { lat: station.lat, lng: station.lon })
    }))
    .filter(station => station.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxResults);

  return stationsWithDistance;
};

// Fetch NCHMF monitoring stations with rainfall and risk data
export const fetchNCHMFStations = async (date?: Date): Promise<NCHMFStation[]> => {
  try {
    // Use provided date or current date rounded to nearest hour
    const queryDate = date || new Date();
    queryDate.setMinutes(0, 0, 0);

    // Format date as YYYY-MM-DD HH:mm:ss (required by API)
    const dateStr = queryDate.toISOString().slice(0, 19).replace('T', ' ');

    // Prepare form data
    const formData = new URLSearchParams({
      sogiodubao: '6', // 6-hour forecast
      date: dateStr
    });

    const response = await fetch('https://luquetsatlo.nchmf.gov.vn/LayerMapBox/getDSCanhbaoSLLQ', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: formData.toString()
    });

    if (!response.ok) {
      console.error('NCHMF stations fetch failed:', response.status);
      return [];
    }

    const data = await response.json();

    // Validate each station against schema
    try {
      const validatedStations = z.array(NCHMFStationSchema).parse(data);
      return validatedStations as unknown as NCHMFStation[];
    } catch (validationError) {
      console.error('NCHMF stations validation failed:', validationError);
      // Try to salvage valid stations
      if (Array.isArray(data)) {
        return data.filter((station: any) => {
          try {
            NCHMFStationSchema.parse(station);
            return true;
          } catch {
            return false;
          }
        }) as NCHMFStation[];
      }
      return [];
    }
  } catch (error) {
    console.error('Error fetching NCHMF stations:', error);
    return [];
  }
};