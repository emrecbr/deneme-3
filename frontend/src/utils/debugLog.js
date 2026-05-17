const canDebugLog = import.meta.env.DEV;

export const debugInfo = (...args) => {
  if (canDebugLog) {
    console.info(...args);
  }
};

export const debugWarn = (...args) => {
  if (canDebugLog) {
    console.warn(...args);
  }
};

export const debugError = (...args) => {
  if (canDebugLog) {
    console.error(...args);
  }
};
