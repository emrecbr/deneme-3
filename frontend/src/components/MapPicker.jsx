import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow
});

function ClickHandler({ onPick }) {
  useMapEvents({
    click: (event) => {
      onPick({ lat: event.latlng.lat, lng: event.latlng.lng });
    }
  });
  return null;
}

function MapPicker({ value, onChange, height = 240 }) {
  const mapRef = useRef(null);
  const center = useMemo(() => {
    if (value?.lat && value?.lng) {
      return [value.lat, value.lng];
    }
    return [41.0082, 28.9784];
  }, [value?.lat, value?.lng]);

  return (
    <div className="map-picker">
      <MapContainer
        center={center}
        zoom={value ? 13 : 11}
        scrollWheelZoom
        className="map-picker-map"
        style={{ height }}
        whenCreated={(map) => {
          mapRef.current = map;
        }}
      >
        {value ? (
          <MapViewSync value={value} />
        ) : null}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution="&copy; OpenStreetMap contributors &copy; CARTO"
        />
        <ClickHandler onPick={onChange} />
        {value ? (
          <Marker
            position={[value.lat, value.lng]}
            draggable
            eventHandlers={{
              dragend: (event) => {
                const next = event.target.getLatLng();
                onChange({ lat: next.lat, lng: next.lng });
              }
            }}
          />
        ) : null}
      </MapContainer>
      <div className="map-picker-coords">
        {value ? `Lat: ${value.lat.toFixed(6)} · Lng: ${value.lng.toFixed(6)}` : 'Haritaya dokunarak konum seç'}
      </div>
    </div>
  );
}

function MapViewSync({ value }) {
  const map = useMapEvents({});

  useEffect(() => {
    if (!value) {
      return;
    }
    const next = [value.lat, value.lng];
    map.setView(next, Math.max(map.getZoom(), 13), { animate: true });
  }, [map, value]);

  return null;
}

export default MapPicker;
