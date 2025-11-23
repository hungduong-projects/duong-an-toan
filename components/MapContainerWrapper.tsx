import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { Coordinates } from '../types';
import { MAP_TILE_URL, MAP_ATTRIBUTION, MAP_MAX_BOUNDS } from '../constants';
import { fetchRainViewerTimestamp } from '../services/geoService';

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

interface MapProps {
  center: Coordinates;
  zoom: number;
  onLocationSelect: (coords: Coordinates) => void;
  userLocation: Coordinates | null;
  startLocation: Coordinates | null;
  routeCoordinates: Coordinates[] | null;
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

const MapContainerWrapper: React.FC<MapProps> = ({ 
  center, 
  zoom, 
  onLocationSelect, 
  userLocation, 
  startLocation,
  routeCoordinates 
}) => {
  const [rainTimestamp, setRainTimestamp] = useState<number | null>(null);

  useEffect(() => {
    const loadRainLayer = async () => {
      const ts = await fetchRainViewerTimestamp();
      if (ts) setRainTimestamp(ts);
    };
    loadRainLayer();
    // Refresh rain layer every 10 mins
    const interval = setInterval(loadRainLayer, 600000); 
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
    </MapContainer>
  );
};

export default MapContainerWrapper;