import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import { useAuth } from './AuthContext';
import { getSocket } from '../lib/socket';

const ChatUnreadContext = createContext({
  globalUnreadCount: 0,
  refreshChatUnreadCount: () => Promise.resolve()
});

const normalizeUnreadCount = (value) => {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue) || numberValue < 0) return 0;
  return numberValue;
};

export function ChatUnreadProvider({ children }) {
  const { user } = useAuth();
  const [globalUnreadCount, setGlobalUnreadCount] = useState(0);
  const userId = user?.id || user?._id || '';

  const refreshChatUnreadCount = useCallback(async () => {
    if (!userId) {
      setGlobalUnreadCount(0);
      return 0;
    }

    try {
      const response = await api.get('/chats/unread-count');
      const nextCount = normalizeUnreadCount(response.data?.data?.globalUnreadCount);
      setGlobalUnreadCount(nextCount);
      return nextCount;
    } catch (_error) {
      return 0;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setGlobalUnreadCount(0);
      return;
    }

    refreshChatUnreadCount();
  }, [refreshChatUnreadCount, userId]);

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    const socket = getSocket({ userId, city: user?.city });
    if (!socket) {
      return undefined;
    }

    const handleUnreadCount = (payload) => {
      if (typeof payload?.globalUnreadCount === 'number') {
        setGlobalUnreadCount(normalizeUnreadCount(payload.globalUnreadCount));
      } else {
        refreshChatUnreadCount();
      }
    };

    const handleRead = (payload) => {
      if (String(payload?.readerId || '') === String(userId)) {
        refreshChatUnreadCount();
      }
    };

    const handleConnect = () => {
      refreshChatUnreadCount();
    };

    socket.on('chat:unread-count', handleUnreadCount);
    socket.on('message:read', handleRead);
    socket.on('connect', handleConnect);

    return () => {
      socket.off('chat:unread-count', handleUnreadCount);
      socket.off('message:read', handleRead);
      socket.off('connect', handleConnect);
    };
  }, [refreshChatUnreadCount, user?.city, userId]);

  const value = useMemo(
    () => ({
      globalUnreadCount,
      refreshChatUnreadCount
    }),
    [globalUnreadCount, refreshChatUnreadCount]
  );

  return <ChatUnreadContext.Provider value={value}>{children}</ChatUnreadContext.Provider>;
}

export const useChatUnreadCount = () => useContext(ChatUnreadContext);
