import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { subscribeAnalyticsDebugEvents } from '../utils/analytics';
import './LiveAnalyticsOverlay.css';

const MAX_EVENTS = 20;

const RFQ_EVENT_NAMES = new Set([
  'rfq_feed_view',
  'rfq_feed_scroll_depth',
  'rfq_card_impression',
  'rfq_card_click',
  'rfq_create_open',
  'rfq_create_step_view',
  'rfq_create_step_abandon',
  'rfq_create_submit',
  'rfq_create_success',
  'rfq_premium_card_view',
  'rfq_premium_card_click',
  'rfq_location_detect_success',
  'rfq_location_detect_failed',
  'rfq_location_permission_reject',
  'rfq_location_manual_fallback',
  'rfq_location_reverse_geocode_success',
  'rfq_create_validation_blocked',
  'rfq_create_step_complete',
  'rfq_create_submit_failed'
]);

const getInitialPosition = () => {
  if (typeof window === 'undefined') {
    return { x: 16, y: 80 };
  }

  return {
    x: Math.max(12, window.innerWidth - 334),
    y: 84
  };
};

const compactValue = (value) => {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
};

const buildEventSummary = (event) => {
  const payload = event?.payload || {};
  const pairs = [
    ['step', payload.step],
    ['rfq', payload.rfqId],
    ['category', payload.category],
    ['source', payload.source],
    ['scroll', payload.scrollDepth ? `${payload.scrollDepth}%` : ''],
    ['cards', payload.visibleCardCount],
    ['location', payload.reason || payload.fallback],
    ['lat', payload.lat],
    ['lng', payload.lng],
    ['city', payload.city],
    ['district', payload.district],
    ['premium', payload.destination || payload.planCode]
  ].filter(([, value]) => compactValue(value));

  return pairs.slice(0, 5).map(([key, value]) => `${key}: ${compactValue(value)}`).join(' · ');
};

function MiniMetric({ label, value }) {
  return (
    <span className="live-analytics-overlay__metric">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </span>
  );
}

export default function LiveAnalyticsOverlay() {
  const location = useLocation();
  const [events, setEvents] = useState([]);
  const [minimized, setMinimized] = useState(() => {
    try {
      return window.localStorage.getItem('talepet_live_analytics_minimized') === 'true';
    } catch (_error) {
      return false;
    }
  });
  const [position, setPosition] = useState(getInitialPosition);
  const [dragState, setDragState] = useState(null);

  useEffect(() => {
    return subscribeAnalyticsDebugEvents((event) => {
      if (!RFQ_EVENT_NAMES.has(event.name)) {
        return;
      }
      setEvents((prev) => [{ ...event, id: `${event.timestamp}-${event.name}-${Math.random()}` }, ...prev].slice(0, MAX_EVENTS));
    });
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('talepet_live_analytics_minimized', String(minimized));
    } catch (_error) {
      // Ignore storage failures in native WebViews.
    }
  }, [minimized]);

  useEffect(() => {
    if (!dragState) {
      return undefined;
    }

    const onMove = (event) => {
      const pointer = event.touches?.[0] || event;
      const nextX = pointer.clientX - dragState.offsetX;
      const nextY = pointer.clientY - dragState.offsetY;
      const maxX = Math.max(12, window.innerWidth - 292);
      const maxY = Math.max(12, window.innerHeight - 88);
      setPosition({
        x: Math.min(Math.max(12, nextX), maxX),
        y: Math.min(Math.max(12, nextY), maxY)
      });
    };

    const onEnd = () => setDragState(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [dragState]);

  const latest = events[0] || null;
  const latestPayload = latest?.payload || {};
  const locationState = useMemo(() => {
    const locationEvent = events.find((event) => event.name.startsWith('rfq_location_'));
    if (!locationEvent) {
      return '-';
    }
    const payload = locationEvent.payload || {};
    if (payload.city || payload.district) {
      return [payload.city, payload.district].filter(Boolean).join(' / ');
    }
    if (payload.lat && payload.lng) {
      return `${payload.lat}, ${payload.lng}`;
    }
    if (payload.reason) return payload.reason;
    if (payload.fallback) return payload.fallback;
    if (payload.hasCoordinates) return 'coords ok';
    return locationEvent.name.replace('rfq_location_', '');
  }, [events]);

  const startDrag = (event) => {
    const pointer = event.touches?.[0] || event;
    setDragState({
      offsetX: pointer.clientX - position.x,
      offsetY: pointer.clientY - position.y
    });
  };

  return (
    <aside
      className={`live-analytics-overlay ${minimized ? 'is-minimized' : ''}`}
      style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0)` }}
      aria-live="polite"
    >
      <div
        className="live-analytics-overlay__bar"
        onMouseDown={startDrag}
        onTouchStart={startDrag}
      >
        <span className="live-analytics-overlay__pulse" aria-hidden="true" />
        <strong>RFQ Live</strong>
        <button
          type="button"
          className="live-analytics-overlay__toggle"
          onClick={() => setMinimized((value) => !value)}
        >
          {minimized ? 'Aç' : 'Küçült'}
        </button>
      </div>

      {!minimized ? (
        <div className="live-analytics-overlay__body">
          <div className="live-analytics-overlay__latest">
            <span>Son event</span>
            <strong>{latest?.name || 'Henüz event yok'}</strong>
            <small>{latest?.timestamp ? new Date(latest.timestamp).toLocaleTimeString('tr-TR') : '-'}</small>
            {latest ? <p>{buildEventSummary(latest) || 'Payload boş'}</p> : null}
          </div>

          <div className="live-analytics-overlay__metrics">
            <MiniMetric label="Route" value={location.pathname} />
            <MiniMetric label="Step" value={latestPayload.step} />
            <MiniMetric label="Location" value={locationState} />
            <MiniMetric label="Premium" value={latestPayload.destination || latestPayload.planCode || (latest?.name?.includes('premium') ? 'event' : '')} />
          </div>

          <div className="live-analytics-overlay__list">
            {events.map((event) => (
              <div key={event.id} className="live-analytics-overlay__item">
                <span>{new Date(event.timestamp).toLocaleTimeString('tr-TR')}</span>
                <strong>{event.name}</strong>
                <small>{buildEventSummary(event)}</small>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
