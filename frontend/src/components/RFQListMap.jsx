import { useCallback, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Popup, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { applyLeafletIconFix } from '../lib/leafletIconFix';

function MapZoomSync({ onZoomChange, onBoundsChange, onUserMove, suppressUpdates }) {
  useMapEvents({
    zoomend: (event) => {
      if (suppressUpdates) {
        return;
      }
      onZoomChange(event.target.getZoom());
      if (onBoundsChange) {
        const bounds = event.target.getBounds();
        onBoundsChange({
          south: bounds.getSouth(),
          west: bounds.getWest(),
          north: bounds.getNorth(),
          east: bounds.getEast()
        });
      }
    },
    moveend: (event) => {
      if (suppressUpdates) {
        return;
      }
      if (onBoundsChange) {
        const bounds = event.target.getBounds();
        onBoundsChange({
          south: bounds.getSouth(),
          west: bounds.getWest(),
          north: bounds.getNorth(),
          east: bounds.getEast()
        });
      }
      if (onUserMove) {
        onUserMove();
      }
    }
  });

  return null;
}

function buildMarkerCategory(rfq, getCategoryName) {
  return (
    rfq?.category?.name ||
    rfq?.category?.title ||
    rfq?.categoryName ||
    getCategoryName(rfq.category) ||
    'Kategori'
  );
}

export default function RFQListMap({
  mapCenter,
  mapItems,
  mapTileUrl,
  mapAttribution,
  radiusCenter,
  mapRadiusKm,
  showRadiusCircle = true,
  clusterRef,
  mapZoom,
  mapMinZoom = 6,
  mapMaxZoom = 18,
  clusterEnabled = true,
  setMapZoom,
  setMapBounds,
  setMapHasMoved,
  shouldSuppressMapUpdates,
  getRFQCoords,
  getCardImages,
  getCategoryName,
  isPremiumRFQ,
  isFeaturedRFQ,
  isActiveRequest,
  nowTs,
  newRFQMarkers,
  selectedRfq,
  setSelectedRfq,
  navigate,
  routePoints,
  userPosition,
  isDarkMode,
  mapAreaFilterActive,
  escapeHtml
}) {
  const mapRef = useRef(null);

  useEffect(() => {
    applyLeafletIconFix();
  }, []);

  const createMarkerIcon = useCallback(
    (title, subTitle, isPremium, isNew, isActive, isFeatured) =>
      L.divIcon({
        className: 'custom-marker',
        html: `<div class="marker-badge ${isPremium ? 'premium-marker' : ''} ${isNew ? 'new-rfq-marker' : ''} ${isDarkMode ? 'dark-marker' : ''} ${!isActive ? 'inactive-marker' : ''}"><div class="marker-title">${escapeHtml(isFeatured ? `⭐ Öne ${title}` : title)}</div><div class="marker-sub">${escapeHtml(subTitle)}</div></div>`,
        iconSize: [150, 44],
        iconAnchor: [75, 44]
      }),
    [escapeHtml, isDarkMode]
  );

  const userMarkerIcon = useMemo(
    () =>
      L.divIcon({
        html: '<div class="user-marker"></div>',
        className: 'user-live-marker',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      }),
    []
  );

  const createClusterIcon = useCallback(
    (cluster) => {
      const count = cluster.getChildCount();
      const baseSize = 52 - mapZoom * 1.3 + count * 0.28;
      const size = Math.max(32, Math.min(60, Math.round(baseSize)));
      const hasPremiumChild = cluster.getAllChildMarkers().some((marker) => Boolean(marker.options?.isPremium));

      return L.divIcon({
        html: `<div class="cluster-bubble ${hasPremiumChild ? 'premium-cluster' : ''} ${isDarkMode ? 'dark-cluster' : ''}">${count}</div>`,
        className: 'custom-cluster',
        iconSize: L.point(size, size)
      });
    },
    [isDarkMode, mapZoom]
  );

  useEffect(() => {
    if (!mapRef.current || mapAreaFilterActive) {
      return;
    }
    if (!mapItems.length) {
      return;
    }

    const coordsList = mapItems
      .map((item) => getRFQCoords(item))
      .filter(Boolean)
      .map((coords) => L.latLng(coords.lat, coords.lng));

    if (!coordsList.length) {
      return;
    }

    if (coordsList.length === 1) {
      mapRef.current.setView(coordsList[0], Math.max(12, mapRef.current.getZoom()));
      return;
    }

    const bounds = L.latLngBounds(coordsList);
    mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [getRFQCoords, mapAreaFilterActive, mapItems]);

  return (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom || 11}
      minZoom={mapMinZoom}
      maxZoom={mapMaxZoom}
      scrollWheelZoom
      className="rfq-map"
      whenCreated={(map) => {
        mapRef.current = map;
        const bounds = map.getBounds();
        setMapBounds({
          south: bounds.getSouth(),
          west: bounds.getWest(),
          north: bounds.getNorth(),
          east: bounds.getEast()
        });
      }}
    >
      <MapZoomSync
        onZoomChange={setMapZoom}
        onBoundsChange={(next) =>
          setMapBounds((prev) => {
            if (
              prev &&
              prev.south === next.south &&
              prev.west === next.west &&
              prev.north === next.north &&
              prev.east === next.east
            ) {
              return prev;
            }
            return next;
          })
        }
        onUserMove={() => setMapHasMoved(true)}
        suppressUpdates={shouldSuppressMapUpdates}
      />
      <TileLayer url={mapTileUrl} attribution={mapAttribution} />
      {radiusCenter && mapRadiusKm > 0 && showRadiusCircle ? (
        <Circle
          center={[radiusCenter.lat, radiusCenter.lng]}
          radius={mapRadiusKm * 1000}
          pathOptions={{ color: '#2563eb', weight: 2, opacity: 0.6, fillOpacity: 0.08 }}
        />
      ) : null}
      {clusterEnabled ? (
        <MarkerClusterGroup
          ref={clusterRef}
          chunkedLoading
          iconCreateFunction={createClusterIcon}
        >
          {mapItems.map((rfq) => {
            const coords = getRFQCoords(rfq);
            if (!coords) {
              return null;
            }

            const images = getCardImages(rfq);
            const firstImage = images[0];
            const markerCategory = buildMarkerCategory(rfq, getCategoryName);
            const markerSub = rfq?.title || (rfq?.description ? String(rfq.description).slice(0, 40) : 'Talep');
            const premium = isPremiumRFQ(rfq);
            const featured = isFeaturedRFQ(rfq);
            const isActive = isActiveRequest(rfq, nowTs);
            return (
              <Marker
                key={rfq._id}
                position={[coords.lat, coords.lng]}
                icon={createMarkerIcon(
                  markerCategory,
                  markerSub,
                  premium,
                  Boolean(newRFQMarkers[rfq._id]),
                  isActive,
                  featured
                )}
                isPremium={premium}
                zIndexOffset={featured ? 1200 : premium ? 800 : 0}
                eventHandlers={{
                  click: () => setSelectedRfq(rfq),
                  popupclose: () => {
                    if (selectedRfq?._id === rfq._id) {
                      setSelectedRfq(null);
                    }
                  }
                }}
              >
                {selectedRfq?._id === rfq._id ? (
                  <Popup autoPan maxWidth={260} minWidth={200} closeButton>
                    <div className="map-popup">
                      {firstImage ? <img src={firstImage} alt={rfq.title} className="map-popup-image" /> : null}
                      <div className="map-popup-category">{markerCategory}</div>
                      <div className="map-popup-sub">{markerSub}</div>
                      <button
                        type="button"
                        className="map-popup-action"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedRfq(null);
                          navigate(`/rfq/${rfq._id}`);
                        }}
                      >
                        Detay
                      </button>
                    </div>
                  </Popup>
                ) : null}
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      ) : (
        mapItems.map((rfq) => {
          const coords = getRFQCoords(rfq);
          if (!coords) {
            return null;
          }

          const images = getCardImages(rfq);
          const firstImage = images[0];
          const markerCategory = buildMarkerCategory(rfq, getCategoryName);
          const markerSub = rfq?.title || (rfq?.description ? String(rfq.description).slice(0, 40) : 'Talep');
          const premium = isPremiumRFQ(rfq);
          const featured = isFeaturedRFQ(rfq);
          const isActive = isActiveRequest(rfq, nowTs);
          return (
            <Marker
              key={rfq._id}
              position={[coords.lat, coords.lng]}
              icon={createMarkerIcon(
                markerCategory,
                markerSub,
                premium,
                Boolean(newRFQMarkers[rfq._id]),
                isActive,
                featured
              )}
              isPremium={premium}
              zIndexOffset={featured ? 1200 : premium ? 800 : 0}
              eventHandlers={{
                click: () => setSelectedRfq(rfq),
                popupclose: () => {
                  if (selectedRfq?._id === rfq._id) {
                    setSelectedRfq(null);
                  }
                }
              }}
            >
              {selectedRfq?._id === rfq._id ? (
                <Popup autoPan maxWidth={260} minWidth={200} closeButton>
                  <div className="map-popup">
                    {firstImage ? <img src={firstImage} alt={rfq.title} className="map-popup-image" /> : null}
                    <div className="map-popup-category">{markerCategory}</div>
                    <div className="map-popup-sub">{markerSub}</div>
                    <button
                      type="button"
                      className="map-popup-action"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedRfq(null);
                        navigate(`/rfq/${rfq._id}`);
                      }}
                    >
                      Detay
                    </button>
                  </div>
                </Popup>
              ) : null}
            </Marker>
          );
        })
      )}
      {routePoints ? (
        <Polyline positions={routePoints} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.9 }} />
      ) : null}
      {userPosition ? (
        <Marker position={[userPosition.lat, userPosition.lng]} icon={userMarkerIcon} zIndexOffset={1200}>
          <Popup>Konumunuz</Popup>
        </Marker>
      ) : null}
    </MapContainer>
  );
}
