export const MAP_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const MAP_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// APIs
export const RAINVIEWER_API = "https://api.rainviewer.com/public/weather-maps.json";
export const OPEN_ELEVATION_API = "https://api.open-elevation.com/api/v1/lookup";
export const OPEN_METEO_FLOOD_API = "https://flood-api.open-meteo.com/v1/flood";
export const OPEN_METEO_FORECAST_API = "https://api.open-meteo.com/v1/forecast";

// Vietnam Focus
export const DEFAULT_CENTER = { lat: 15.9, lng: 105.8 }; // Central view covering Vietnam
export const DEFAULT_ZOOM = 6;

// Bounds to keep focus on Vietnam region
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [6.0, 100.0], // Southwest limit (covering sea south of Ca Mau)
  [24.5, 112.0] // Northeast limit (covering northern border and sea)
];