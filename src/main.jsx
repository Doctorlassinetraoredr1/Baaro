import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App.jsx";
import { AppProvider } from "./contexts/AppContext.jsx";
import { ToastProvider } from "./components/ToastContext.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { captureRefFromUrl } from "./lib/referralApi.js";
import "./index.css";

captureRefFromUrl();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AppProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

// VitePWA gère l'enregistrement du service worker en build.
// Fallback uniquement si aucun SW n'est déjà contrôlé (dev / ancien déploiement).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (!navigator.serviceWorker.controller) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {});
    }
  });
}
