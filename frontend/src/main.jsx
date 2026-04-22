import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { LocationProvider } from "./context/LocationContext";
import { resolveSurfaceLabel } from "./config/surfaces";
import "./styles.css";

document.documentElement.dataset.surface = resolveSurfaceLabel(window.location.pathname);

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true
    }}
  >
    <AuthProvider>
      <AdminAuthProvider>
        <LocationProvider>
          <App />
        </LocationProvider>
      </AdminAuthProvider>
    </AuthProvider>
  </BrowserRouter>
);

const enableServiceWorker = import.meta.env.VITE_ENABLE_SW === 'true';

if ('serviceWorker' in navigator) {
  if (enableServiceWorker) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // silent fail: app works without SW
      });
    });
  } else if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
      }
    });
  }
}
