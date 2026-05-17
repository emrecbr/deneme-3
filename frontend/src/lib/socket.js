import { io } from 'socket.io-client';
import { API_BASE_URL } from '../api/axios';

let socketInstance = null;
let resolvedSocketBase = null;
let hasResolvedSocketBase = false;
let missingSocketBaseWarned = false;
let activeSocketQuerySignature = '';

const normalizeCity = (cityValue) => String(cityValue || '').trim().toLowerCase();

const buildQuerySignature = (query) => JSON.stringify(query || {});

const resolveSocketBase = () => {
  if (hasResolvedSocketBase) {
    return resolvedSocketBase;
  }

  const socketBaseEnv = (import.meta.env.VITE_SOCKET_URL || '').trim();
  const apiBase = String(API_BASE_URL || '').trim();
  const sameOriginBase =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';

  resolvedSocketBase =
    socketBaseEnv ||
    (apiBase ? apiBase.replace(/\/api\/?$/, '') : '') ||
    sameOriginBase ||
    null;
  hasResolvedSocketBase = true;

  if (!resolvedSocketBase && !missingSocketBaseWarned) {
    missingSocketBaseWarned = true;
    debugWarn('Socket base URL could not be resolved; socket connection disabled.');
  }

  return resolvedSocketBase;
};

export const getSocket = ({ userId, city } = {}) => {
  if (!socketInstance) {
    const socketBase = resolveSocketBase();
    if (!socketBase) {
      return null;
    }
    socketInstance = io(socketBase, {
      autoConnect: false,
      transports: ['websocket'],
      path: '/socket.io'
    });
  }

  if (!socketInstance) {
    return null;
  }
  const query = {};
  if (userId) {
    query.userId = String(userId);
  }
  const normalizedCity = normalizeCity(city);
  if (normalizedCity) {
    query.city = normalizedCity;
  }

  const nextQuerySignature = buildQuerySignature(query);
  const queryChanged = activeSocketQuerySignature !== nextQuerySignature;

  if (queryChanged && socketInstance.connected) {
    socketInstance.disconnect();
  }

  socketInstance.io.opts.query = query;
  activeSocketQuerySignature = nextQuerySignature;

  if (!socketInstance.connected) {
    socketInstance.connect();
  }

  return socketInstance;
};

export const disconnectSocket = ({ resetInstance = false } = {}) => {
  if (!socketInstance) {
    activeSocketQuerySignature = '';
    return;
  }

  socketInstance.disconnect();
  activeSocketQuerySignature = '';

  if (resetInstance) {
    socketInstance.removeAllListeners();
    socketInstance = null;
  }
};

export const normalizeSocketCity = normalizeCity;
import { debugWarn } from '../utils/debugLog';
