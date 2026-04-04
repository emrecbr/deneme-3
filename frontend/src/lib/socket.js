import { io } from 'socket.io-client';

let socketInstance = null;
let resolvedSocketBase = null;
let hasResolvedSocketBase = false;
let missingSocketBaseWarned = false;

const normalizeCity = (cityValue) => String(cityValue || '').trim().toLowerCase();

const resolveSocketBase = () => {
  if (hasResolvedSocketBase) {
    return resolvedSocketBase;
  }

  const apiBase = (import.meta.env.VITE_API_URL || '').trim();
  const socketBaseEnv = (import.meta.env.VITE_SOCKET_URL || '').trim();
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
    console.warn('Socket base URL could not be resolved; socket connection disabled.');
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

  socketInstance.io.opts.query = query;

  if (!socketInstance.connected) {
    socketInstance.connect();
  }

  return socketInstance;
};

export const normalizeSocketCity = normalizeCity;
