import { useCallback, useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { applyLeafletIconFix } from '../lib/leafletIconFix';

const BOUNDS_EPSILON = 0.00001;

function areBoundsEqual(a, b) {
  if (!a || !b) {
    return false;
  }
  return (
    Math.abs(a.south - b.south) < BOUNDS_EPSILON &&
    Math.abs(a.west - b.west) < BOUNDS_EPSILON &&
    Math.abs(a.north - b.north) < BOUNDS_EPSILON &&
    Math.abs(a.east - b.east) < BOUNDS_EPSILON
  );
}

function MapZoomSync({ onZoomChange, onBoundsChange, onUserMove, suppressUpdates }) {
  const lastBoundsRef = useRef(null);
  const lastZoomRef = useRef(null);

  const publishViewport = useCallback(
    (map, markUserMove = false) => {
      const nextZoom = map.getZoom();
      const rawBounds = map.getBounds();
      const nextBounds = {
        south: rawBounds.getSouth(),
        west: rawBounds.getWest(),
        north: rawBounds.getNorth(),
        east: rawBounds.getEast()
      };
      const zoomChanged = lastZoomRef.current !== nextZoom;
      const boundsChanged = !areBoundsEqual(lastBoundsRef.current, nextBounds);

      if (zoomChanged) {
        lastZoomRef.current = nextZoom;
        onZoomChange(nextZoom);
      }

      if (boundsChanged) {
        lastBoundsRef.current = nextBounds;
        if (onBoundsChange) {
          onBoundsChange(nextBounds);
        }
        if (markUserMove && onUserMove) {
          onUserMove();
        }
      }
    },
    [onBoundsChange, onUserMove, onZoomChange]
  );

  useMapEvents({
    zoomend: (event) => {
      if (suppressUpdates) {
        return;
      }
      publishViewport(event.target);
    },
    moveend: (event) => {
      if (suppressUpdates) {
        return;
      }
      publishViewport(event.target, true);
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

function getRFQIdentity(rfq) {
  return String(rfq?._id || rfq?.id || '');
}

function isObjectIdLike(value) {
  return /^[a-f0-9]{24}$/i.test(String(value || '').trim());
}

function buildMarkerTitle(rfq) {
  const directTitle = String(rfq?.title || '').trim();
  if (directTitle && !isObjectIdLike(directTitle)) {
    return directTitle;
  }

  const fallbackDescription = String(rfq?.description || '').trim().slice(0, 40);
  if (fallbackDescription && !isObjectIdLike(fallbackDescription)) {
    return fallbackDescription;
  }

  return 'Talep';
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
  mapFocusTarget,
  escapeHtml
}) {
  const mapRef = useRef(null);
  const lastFitSignatureRef = useRef('');
  const lastFocusKeyRef = useRef('');
  const selectedRfqId = getRFQIdentity(selectedRfq) || null;

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

    const fitSignature = coordsList
      .map((coords) => `${coords.lat.toFixed(5)}:${coords.lng.toFixed(5)}`)
      .join('|');
    if (lastFitSignatureRef.current === fitSignature) {
      return;
    }
    lastFitSignatureRef.current = fitSignature;

    if (coordsList.length === 1) {
      mapRef.current.setView(coordsList[0], Math.max(12, mapRef.current.getZoom()));
      return;
    }

    const bounds = L.latLngBounds(coordsList);
    mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [getRFQCoords, mapAreaFilterActive, mapItems]);

  useEffect(() => {
    if (!mapRef.current || !mapFocusTarget?.key || selectedRfqId) {
      return;
    }
    if (lastFocusKeyRef.current === mapFocusTarget.key) {
      return;
    }
    lastFocusKeyRef.current = mapFocusTarget.key;

    if (mapFocusTarget.bounds) {
      const { south, west, north, east } = mapFocusTarget.bounds;
      mapRef.current.fitBounds(
        [
          [south, west],
          [north, east]
        ],
        {
          padding: [40, 40],
          maxZoom: mapFocusTarget.maxZoom || 12
        }
      );
      return;
    }

    if (mapFocusTarget.center) {
      mapRef.current.setView(
        [mapFocusTarget.center.lat, mapFocusTarget.center.lng],
        mapFocusTarget.zoom || mapRef.current.getZoom(),
        { animate: true }
      );
    }
  }, [mapFocusTarget, selectedRfqId]);

  useEffect(() => {
    if (!mapRef.current || !selectedRfqId) {
      return;
    }
    const selectedItem = mapItems.find((item) => getRFQIdentity(item) === selectedRfqId);
    const coords = getRFQCoords(selectedItem);
    if (!coords) {
      return;
    }
    const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
    mapRef.current.panInside([coords.lat, coords.lng], {
      paddingTopLeft: [24, 24],
      paddingBottomRight: isMobile ? [24, 260] : [24, 40],
      animate: true
    });
  }, [getRFQCoords, mapItems, selectedRfqId]);

  const handleMarkerSelect = useCallback(
    (rfq) => {
      setSelectedRfq((prev) => (getRFQIdentity(prev) === getRFQIdentity(rfq) ? prev : rfq));
    },
    [setSelectedRfq]
  );

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

            const markerTitle = buildMarkerTitle(rfq);
            const markerSub = buildMarkerCategory(rfq, getCategoryName);
            const premium = isPremiumRFQ(rfq);
            const featured = isFeaturedRFQ(rfq);
            const isActive = isActiveRequest(rfq, nowTs);
            return (
              <Marker
                key={getRFQIdentity(rfq)}
                position={[coords.lat, coords.lng]}
                icon={createMarkerIcon(
                  markerTitle,
                  markerSub,
                  premium,
                  Boolean(newRFQMarkers[getRFQIdentity(rfq)]),
                  isActive,
                  featured
                )}
                isPremium={premium}
                zIndexOffset={featured ? 1200 : premium ? 800 : 0}
                eventHandlers={{
                  click: () => handleMarkerSelect(rfq)
                }}
              />
            );
          })}
        </MarkerClusterGroup>
      ) : (
        mapItems.map((rfq) => {
          const coords = getRFQCoords(rfq);
          if (!coords) {
            return null;
          }

          const markerTitle = buildMarkerTitle(rfq);
          const markerSub = buildMarkerCategory(rfq, getCategoryName);
          const premium = isPremiumRFQ(rfq);
          const featured = isFeaturedRFQ(rfq);
          const isActive = isActiveRequest(rfq, nowTs);
          return (
            <Marker
              key={getRFQIdentity(rfq)}
              position={[coords.lat, coords.lng]}
              icon={createMarkerIcon(
                markerTitle,
                markerSub,
                premium,
                Boolean(newRFQMarkers[getRFQIdentity(rfq)]),
                isActive,
                featured
              )}
              isPremium={premium}
              zIndexOffset={featured ? 1200 : premium ? 800 : 0}
              eventHandlers={{
                click: () => handleMarkerSelect(rfq)
              }}
            />
          );
        })
      )}
      {routePoints ? (
        <Polyline positions={routePoints} pathOptions={{ color: '#2563eb', weight: 4, opacity: 0.9 }} />
      ) : null}
      {userPosition ? (
        <Marker position={[userPosition.lat, userPosition.lng]} icon={userMarkerIcon} zIndexOffset={1200} />
      ) : null}
    </MapContainer>
  );
}
