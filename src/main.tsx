import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Detect older Smart TV Chromium engines (< 84 on LG webOS / Samsung Tizen) that do not support CSS Flexbox gap
(function detectFlexGapSupport() {
  try {
    const flex = document.createElement('div');
    flex.style.display = 'flex';
    flex.style.flexDirection = 'column';
    flex.style.rowGap = '1px';
    flex.appendChild(document.createElement('div'));
    flex.appendChild(document.createElement('div'));
    document.body.appendChild(flex);
    const isSupported = flex.scrollHeight === 1;
    if (flex.parentNode) {
      flex.parentNode.removeChild(flex);
    }
    if (!isSupported) {
      document.documentElement.classList.add('no-flex-gap');
    }
  } catch {
    // ignore
  }
})();

// In development (localhost), unregister any stale Service Worker so it never
// caches Vite HMR modules or triggers unexpected page reloads.
if ('serviceWorker' in navigator) {
  const isLocalDev =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.port === '8769';
  if (isLocalDev) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister();
        }
      })
      .catch(() => {});
    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => {
          for (const key of keys) {
            void caches.delete(key);
          }
        })
        .catch(() => {});
    }
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Service worker registration is progressive enhancement
      });
    });
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

