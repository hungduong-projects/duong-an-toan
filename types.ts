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

export enum VehicleType {
  CAR = 'car',
  MOTORCYCLE = 'motorcycle',
  PEDESTRIAN = 'pedestrian'
}

export enum ConfidenceLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export interface LocationData {
  elevation: number | null;
  precipitation: number; // mm current precipitation
  precipForecast6h?: number; // mm total precipitation forecast for next 6 hours
  precip72h?: number; // mm total precipitation in past 72 hours (ground saturation indicator)
  riverDischarge: number; // m3/s
  locationName: string;
}

export interface AnalysisResult {
  riskLevel: RiskLevel;
  advice: string;
  isLoading: boolean;
  type: 'point' | 'route'; // Distinguish between single point and route analysis
  confidence?: ConfidenceLevel; // Data quality indicator
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
  dangerousSegments?: DangerousSegment[]; // Optional dangerous segments along route
}

export interface DangerousSegment {
  coordinates: Coordinates; // Location of the dangerous segment
  segmentIndex: number; // Index in the route coordinates array
  riskLevel: RiskLevel; // Risk level for this segment
  reason: string; // Why it's dangerous (e.g., "Độ cao thấp (2m), mưa lớn")
  distanceFromStart?: number; // Distance in km from start (optional, for display)
}

export interface WeatherWarning {
  title: string; // Warning title in Vietnamese
  timestamp: string; // When the warning was issued
  severity: 'emergency' | 'high' | 'medium'; // Severity level
  category: 'flood' | 'rain' | 'landslide' | 'typhoon' | 'cold' | 'other'; // Type of warning
}

export interface GDACSFloodAlert {
  id: string; // Event ID
  alertLevel: 'Green' | 'Orange' | 'Red'; // GDACS alert level
  bbox: [number, number, number, number]; // Bounding box [minLng, minLat, maxLng, maxLat]
  fromDate: string; // Start date
  toDate: string; // End date
  affectedCountries: string[]; // List of affected countries
  description: string; // Event description
  severity: number; // Severity score
}

// NCHMF Station Data Types
export interface NCHMFStation {
  id: number; // Station ID
  commune_id: number; // Commune ID
  commune_name: string; // Commune name (Vietnamese)
  commune_id_2cap: number; // Alternative commune ID
  commune_name_2cap: string; // Alternative commune name
  district_name: string; // District name (Vietnamese)
  provinceName: string; // Province name (Vietnamese)
  provinceName_2cap: string; // Alternative province name
  province_ref: number; // Province reference ID
  lat: number; // Latitude
  lon: number; // Longitude
  luongmuatd: number | null; // Current rainfall (mm)
  luongmuadb: number; // 6h forecast rainfall (mm)
  luongmuatd_db: number; // Total rainfall (current + forecast)
  nguycoluquet: string; // Flash flood risk: "Thấp" | "Trung bình" | "Cao"
  nguycosatlo: string; // Landslide risk: "Thấp" | "Trung bình" | "Cao"
  nguonmuadubao: string; // Forecast source (e.g., "AMO")
  sogiodubao: number; // Forecast hours
  thoigian: string; // Timestamp in .NET format
  ngay_capnhat: string; // Last update timestamp
  nguoi_capnhat: string; // Who updated (e.g., "autoUpdateDuBaoThienTai")
}

export type NCHMFRiskLevel = 'Thấp' | 'Trung bình' | 'Cao'; // Low | Medium | High in Vietnamese