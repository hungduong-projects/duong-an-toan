export interface Coordinates {
  lat: number;
  lng: number;
}

export enum RiskLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  UNKNOWN = 'Unknown'
}

export interface LocationData {
  elevation: number | null;
  precipitation: number; // mm
  riverDischarge: number; // m3/s
  locationName: string;
}

export interface AnalysisResult {
  riskLevel: RiskLevel;
  advice: string;
  isLoading: boolean;
  type: 'point' | 'route'; // Distinguish between single point and route analysis
}

export interface RainViewerData {
  version: string;
  generated: number;
  host: string;
  radar: {
    past: Array<{ time: number; path: string }>;
    nowcast: Array<{ time: number; path: string }>;
  };
}

export interface SearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

export interface RouteInfo {
  coordinates: Coordinates[]; // For drawing the line
  distance: number; // meters
  duration: number; // seconds
}