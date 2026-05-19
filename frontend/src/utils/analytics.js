import api from '../api/axios';

const QUEUE_LIMIT = 100;
const FLUSH_SIZE = 20;
const FLUSH_DELAY_MS = 1800;
const SESSION_KEY = 'talepet_analytics_session_id';
let queue = [];
let flushTimer = null;
let isFlushing = false;

const safeStorage = () => {
  try {
    return window.localStorage;
  } catch (_error) {
    return null;
  }
};

const getAnonymousId = () => {
  if (typeof window === 'undefined') {
    return '';
  }
  const storage = safeStorage();
  const existing = storage?.getItem(SESSION_KEY);
  if (existing) {
    return existing;
  }
  const next = `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  try {
    storage?.setItem(SESSION_KEY, next);
  } catch (_error) {
    // Storage can be unavailable in restricted WebViews.
  }
  return next;
};

const getDeviceType = () => {
  if (typeof navigator === 'undefined') {
    return 'unknown';
  }
  const ua = navigator.userAgent || '';
  if (/Capacitor|wv|Android/i.test(ua)) {
    return /Android/i.test(ua) ? 'android_webview' : 'native_webview';
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    return 'ios_browser';
  }
  if (/Mobi|Android/i.test(ua)) {
    return 'mobile_web';
  }
  return 'desktop_web';
};

const getSource = () => {
  if (typeof window === 'undefined') {
    return 'unknown';
  }
  const host = window.location.hostname || '';
  if (host.startsWith('app.')) return 'app';
  if (host.startsWith('admin.')) return 'admin';
  if (host === 'localhost' || host === '127.0.0.1') return 'local';
  return 'web';
};

const normalizePayload = (payload = {}) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(payload)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => {
        if (typeof value === 'string') {
          return [key, value.slice(0, 300)];
        }
        return [key, value];
      })
  );
};

export const flushAnalyticsEvents = async () => {
  if (isFlushing || !queue.length) {
    return;
  }

  isFlushing = true;
  const events = queue.splice(0, FLUSH_SIZE);
  try {
    await api.post('/analytics/events', { events }, { timeout: 4000 });
  } catch (_error) {
    queue = [...events, ...queue].slice(0, QUEUE_LIMIT);
  } finally {
    isFlushing = false;
    if (queue.length) {
      scheduleFlush();
    }
  }
};

export const scheduleFlush = () => {
  if (flushTimer || typeof window === 'undefined') {
    return;
  }
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushAnalyticsEvents();
  }, FLUSH_DELAY_MS);
};

export const trackAnalyticsEvent = (name, payload = {}) => {
  const eventName = String(name || '').trim();
  if (!eventName) {
    return;
  }

  queue.push({
    name: eventName,
    payload: normalizePayload(payload),
    anonymousId: getAnonymousId(),
    source: getSource(),
    deviceType: getDeviceType(),
    timestamp: new Date().toISOString()
  });

  if (queue.length > QUEUE_LIMIT) {
    queue = queue.slice(-QUEUE_LIMIT);
  }

  if (queue.length >= FLUSH_SIZE) {
    void flushAnalyticsEvents();
    return;
  }

  scheduleFlush();
};

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    void flushAnalyticsEvents();
  });
}
