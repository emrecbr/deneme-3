import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { AdminAuthProvider } from "./context/AdminAuthContext";
import { LocationProvider } from "./context/LocationContext";
import { SURFACE_LABELS, resolveSurfaceLabel, resolveSurfaceLabelFromHostname } from "./config/surfaces";
import "./styles.css";

const surfaceLabel = resolveSurfaceLabel(window.location.pathname);
const hostSurface = resolveSurfaceLabelFromHostname(window.location.hostname);

const ensureThemeStylesheet = (href) => {
  const existing = document.head.querySelector(`link[data-surface-theme="${href}"]`);
  if (existing) {
    return existing;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.surfaceTheme = href;
  document.head.appendChild(link);
  return link;
};

const removeThemeStylesheet = (href) => {
  const existing = document.head.querySelector(`link[data-surface-theme="${href}"]`);
  if (existing) {
    existing.remove();
  }
};

const ADMIN_THEME_STYLES = [
  "/themes/admin/plugins/fontawesome-free/css/all.min.css",
  "/themes/admin/dist/css/adminlte.min.css"
];

const applySurfaceTheme = () => {
  document.documentElement.dataset.surface = surfaceLabel;

  if (hostSurface === SURFACE_LABELS.admin) {
    document.body.classList.add("hold-transition", "sidebar-mini", "layout-fixed");
    ADMIN_THEME_STYLES.forEach(ensureThemeStylesheet);
    return;
  }

  ADMIN_THEME_STYLES.forEach(removeThemeStylesheet);
  document.body.classList.remove("hold-transition", "sidebar-mini", "layout-fixed");
};

applySurfaceTheme();

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
