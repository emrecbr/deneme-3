import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const watchIdRef = useRef(null);
  const [liveLocation, setLiveLocation] = useState(null);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [highAccuracy, setHighAccuracy] = useState(true);

  const stopLiveLocation = useCallback(() => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  const startLiveLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('error');
      setErrorMessage('Konum desteklenmiyor');
      return;
    }
    if (watchIdRef.current !== null) {
      return;
    }
    setStatus('requesting');
    setErrorMessage(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setLiveLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        });
        setAccuracy(position.coords.accuracy);
        setStatus('active');
      },
      (geoError) => {
        if (geoError.code === 1) {
          setStatus('denied');
          setErrorMessage('Konum izni verilmedi');
        } else {
          setStatus('error');
          setErrorMessage('Konum alinamadi');
        }
        if (watchIdRef.current !== null && navigator.geolocation) {
          navigator.geolocation.clearWatch(watchIdRef.current);
          watchIdRef.current = null;
        }
      },
      {
        enableHighAccuracy: highAccuracy,
        timeout: 10000,
        maximumAge: 5000
      }
    );
  }, [highAccuracy]);

  const value = useMemo(
    () => ({
      liveLocation,
      status,
      errorMessage,
      accuracy,
      highAccuracy,
      setHighAccuracy,
      startLiveLocation,
      stopLiveLocation
    }),
    [liveLocation, status, errorMessage, accuracy, highAccuracy, startLiveLocation, stopLiveLocation]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLiveLocation() {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLiveLocation must be used within LocationProvider');
  }
  return context;
}
