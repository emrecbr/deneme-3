import { io } from 'socket.io-client';

let socketInstance = null;

const normalizeCity = (cityValue) => String(cityValue || '').trim().toLowerCase();

export const getSocket = ({ userId, city } = {}) => {
  if (!socketInstance) {
    const apiBase = (import.meta.env.VITE_API_URL || '').trim();
    const socketBaseEnv = (import.meta.env.VITE_SOCKET_URL || '').trim();
    const socketBase =
      socketBaseEnv ||
      (apiBase ? apiBase.replace(/\/api\/?$/, '') : '');
    if (!socketBase) {
      console.warn('VITE_SOCKET_URL missing; socket connection disabled.');
    }
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
