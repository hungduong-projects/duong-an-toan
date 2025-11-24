import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Circle, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';
import DOMPurify from 'dompurify';
import { Coordinates, DangerousSegment, RiskLevel, NCHMFStation } from '../types';
import { MAP_TILE_URL, MAP_ATTRIBUTION, MAP_MAX_BOUNDS } from '../constants';
import { fetchRainViewerTimestamp } from '../services/geoService';

// Helper function to sanitize text
const sanitizeText = (text: string | number | null | undefined): string => {
  if (text === null || text === undefined) return '';
  const str = String(text);
  return DOMPurify.sanitize(str, { ALLOWED_TAGS: [] });
};

// Fix for default Leaflet markers in React
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const destinationIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const startIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Warning icon for dangerous segments
const warningIcon = L.divIcon({
  html: `<div style="font-size: 24px; text-align: center; line-height: 1;">⚠️</div>`,
  className: 'warning-marker',
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

// NCHMF Station Icons (color-coded by risk level)
const createStationIcon = (riskLevel: string) => {
  const colors = {
    'Cao': '#dc2626',        // High - Red
    'Trung bình': '#f59e0b', // Medium - Amber
    'Thấp': '#10b981'         // Low - Green
  };

  const color = colors[riskLevel as keyof typeof colors] || '#6b7280'; // Default gray

  return L.divIcon({
    html: `<div style="
      width: 12px;
      height: 12px;
      background-color: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    className: 'nchmf-station-marker',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
};

interface MapProps {
  center: Coordinates;
  zoom: number;
  onLocationSelect: (coords: Coordinates) => void;
  userLocation: Coordinates | null;
  startLocation: Coordinates | null;
  routeCoordinates: Coordinates[] | null;
  dangerousSegments?: DangerousSegment[] | null;
  nchmfStations?: NCHMFStation[] | null;
}

// Component to handle map clicks
const MapEvents = ({ onSelect }: { onSelect: (coords: Coordinates) => void }) => {
  useMapEvents({
    click(e) {
      onSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
};

// Component to update view when center changes
const MapUpdater = ({ center }: { center: Coordinates }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng]);
  }, [center, map]);
  return null;
};

// Component to fix initial map rendering
const MapInitializer = () => {
  const map = useMap();
  useEffect(() => {
    // Force map to recalculate size after mount
    setTimeout(() => {
      map.invalidateSize();
    }, 100);
  }, [map]);
  return null;
};

const MapContainerWrapper: React.FC<MapProps> = ({
  center,
  zoom,
  onLocationSelect,
  userLocation,
  startLocation,
  routeCoordinates,
  dangerousSegments,
  nchmfStations
}) => {
  const [rainTimestamp, setRainTimestamp] = useState<number | null>(null);

  useEffect(() => {
    const loadRainLayer = async () => {
      const ts = await fetchRainViewerTimestamp();
      if (ts) setRainTimestamp(ts);
    };
    loadRainLayer();
    // Refresh rain layer every 30 mins to reduce rate limiting
    const interval = setInterval(loadRainLayer, 1800000); 
    return () => clearInterval(interval);
  }, []);

  return (
    <MapContainer 
      center={[center.lat, center.lng]} 
      zoom={zoom} 
      style={{ height: "100%", width: "100%", zIndex: 0 }}
      zoomControl={false}
      maxBounds={MAP_MAX_BOUNDS}
      minZoom={5}
    >
      <TileLayer
        attribution={MAP_ATTRIBUTION}
        url={MAP_TILE_URL}
      />
      
      {rainTimestamp && (
        <TileLayer
          url={`https://tilecache.rainviewer.com/v2/radar/${rainTimestamp}/256/{z}/{x}/{y}/2/1_1.png`}
          opacity={0.7}
          zIndex={10}
        />
      )}

      <MapEvents onSelect={onLocationSelect} />
      <MapUpdater center={center} />
      <MapInitializer />

      {/* 
         Logic for displaying markers:
         1. If Route exists: Show Start (Green) and Destination (Red).
         2. If only one point selected: Show Destination (Red) at center.
         3. Always show User Location (Blue Circle) if available.
      */}

      {/* Start Point Marker (Only if explicity set or different from user location in route mode) */}
      {startLocation && routeCoordinates && (
        <Marker position={[startLocation.lat, startLocation.lng]} icon={startIcon} />
      )}

      {/* Destination/Selected Point Marker */}
      <Marker position={[center.lat, center.lng]} icon={routeCoordinates ? destinationIcon : icon} />

      {/* User Location (Blue Dot) */}
      {userLocation && (
        <>
           <Circle 
            center={[userLocation.lat, userLocation.lng]}
            pathOptions={{ fillColor: 'blue', color: 'blue', opacity: 0.5, fillOpacity: 0.2 }}
            radius={50}
          />
          {/* Only show marker if it's not the same as startLocation marker to avoid overlap visual clutter */}
          {(!startLocation || (startLocation.lat !== userLocation.lat)) && (
             <Marker position={[userLocation.lat, userLocation.lng]} icon={icon} />
          )}
        </>
      )}

      {/* Route Polyline */}
      {routeCoordinates && (
        <Polyline
          positions={routeCoordinates.map(c => [c.lat, c.lng])}
          pathOptions={{ color: 'blue', weight: 5, opacity: 0.7 }}
        />
      )}

      {/* Dangerous Segment Markers */}
      {dangerousSegments && dangerousSegments.map((segment, index) => (
        <Marker
          key={`danger-${index}`}
          position={[segment.coordinates.lat, segment.coordinates.lng]}
          icon={warningIcon}
        >
          <Popup>
            <div className="text-xs">
              <div className="font-bold text-red-600 mb-1">
                ⚠️ Đoạn nguy hiểm
              </div>
              <div className="mb-1">
                <span className="font-semibold">Vị trí:</span> Km {segment.distanceFromStart?.toFixed(1) || '?'}
              </div>
              <div className="mb-1">
                <span className="font-semibold">Mức độ:</span>{' '}
                <span className={`font-bold ${
                  segment.riskLevel === RiskLevel.HIGH ? 'text-red-600' :
                  segment.riskLevel === RiskLevel.MEDIUM ? 'text-orange-600' :
                  'text-yellow-600'
                }`}>
                  {segment.riskLevel === RiskLevel.HIGH ? 'CAO' :
                   segment.riskLevel === RiskLevel.MEDIUM ? 'TRUNG BÌNH' : 'THẤP'}
                </span>
              </div>
              <div>
                <span className="font-semibold">Lý do:</span> {sanitizeText(segment.reason)}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* NCHMF Monitoring Station Markers */}
      {nchmfStations && nchmfStations.map((station, index) => {
        // Determine risk level from flash flood and landslide risks (use higher risk)
        const riskLevels = ['Thấp', 'Trung bình', 'Cao'];
        const floodRiskIndex = riskLevels.indexOf(station.nguycoluquet);
        const landslideRiskIndex = riskLevels.indexOf(station.nguycosatlo);
        const maxRiskIndex = Math.max(floodRiskIndex, landslideRiskIndex);
        const displayRisk = riskLevels[maxRiskIndex] || 'Thấp';

        return (
          <Marker
            key={`nchmf-station-${station.id}-${index}`}
            position={[station.lat, station.lon]}
            icon={createStationIcon(displayRisk)}
          >
            <Popup>
              <div className="text-sm max-w-xs">
                <div className="font-bold mb-2 text-blue-700">
                  📍 {sanitizeText(station.commune_name)}
                </div>
                <div className="mb-1 text-xs text-slate-600">
                  {sanitizeText(station.district_name)}, {sanitizeText(station.provinceName)}
                </div>

                <div className="my-2 pt-2 border-t border-slate-200">
                  <div className="text-xs mb-1">
                    <span className="font-semibold">🌧️ Mưa hiện tại:</span>{' '}
                    {station.luongmuatd !== null && station.luongmuatd !== undefined ? `${station.luongmuatd.toFixed(1)}mm` : 'N/A'}
                  </div>
                  <div className="text-xs mb-1">
                    <span className="font-semibold">🌦️ Dự báo 6h:</span>{' '}
                    {station.luongmuadb !== null && station.luongmuadb !== undefined ? `${station.luongmuadb.toFixed(1)}mm` : 'N/A'}
                  </div>
                  <div className="text-xs font-semibold">
                    <span>Tổng:</span>{' '}
                    {station.luongmuatd_db !== null && station.luongmuatd_db !== undefined ? `${station.luongmuatd_db.toFixed(1)}mm` : 'N/A'}
                  </div>
                </div>

                <div className="my-2 pt-2 border-t border-slate-200">
                  <div className="text-xs mb-1">
                    <span className="font-semibold">⚠️ Lũ quét:</span>{' '}
                    <span className={`font-bold ${
                      station.nguycoluquet === 'Cao' ? 'text-red-600' :
                      station.nguycoluquet === 'Trung bình' ? 'text-amber-600' :
                      'text-green-600'
                    }`}>
                      {station.nguycoluquet}
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="font-semibold">🏔️ Sạt lở:</span>{' '}
                    <span className={`font-bold ${
                      station.nguycosatlo === 'Cao' ? 'text-red-600' :
                      station.nguycosatlo === 'Trung bình' ? 'text-amber-600' :
                      'text-green-600'
                    }`}>
                      {station.nguycosatlo}
                    </span>
                  </div>
                </div>

                <div className="mt-2 text-xs bg-blue-50 px-2 py-1 rounded">
                  Nguồn: NCHMF ({sanitizeText(station.nguonmuadubao)})
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
};

export default MapContainerWrapper;