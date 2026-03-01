import { io } from 'socket.io-client';

let socketInstance = null;

const normalizeCity = (cityValue) => String(cityValue || '').trim().toLowerCase();

export const getSocket = ({ userId, city } = {}) => {
  if (!socketInstance) {
    const apiBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
    const socketBase = apiBase
      ? apiBase.replace(/\/api\/?$/, '')
      : window.location.origin;
    socketInstance = io(socketBase, {
      autoConnect: false,
      transports: ['websocket'],
      path: '/socket.io'
    });
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
