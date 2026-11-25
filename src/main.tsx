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

// In development (localhost) or Smart TV / Media Station X embedded WebViews,
// unregister any stale Service Worker so it never caches Vite HMR modules,
// triggers unexpected reloads, or stalls LG/Samsung TV boot on live HTTPS.
if ('serviceWorker' in navigator) {
  const devHost = window.location.hostname.toLowerCase();
  const uaStr = navigator.userAgent || '';
  let isFramedWebView = false;
  try {
    isFramedWebView = window.self !== window.top;
  } catch {
    isFramedWebView = true;
  }
  const isSmartTvOrMsx =
    Boolean((window as unknown as { __IS_SMART_TV_DEVICE__?: boolean }).__IS_SMART_TV_DEVICE__) ||
    document.documentElement.classList.contains('smart-tv-mode') ||
    /Web0S|WebOS|NetCast|SmartTV|SMART-TV|Tizen|MSX|BRAVIA|Android TV|GoogleTV|VIDAA|HbbTV/i.test(
      uaStr
    ) ||
    isFramedWebView;
  const isLocalDev =
    devHost === 'localhost' ||
    devHost === '127.0.0.1' ||
    window.location.port === '8769' ||
    devHost.endsWith('.lhr.life') ||
    devHost.endsWith('.trycloudflare.com') ||
    devHost.endsWith('.serveousercontent.com');
  if (isLocalDev || isSmartTvOrMsx) {
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
    let lastSwUpdateCheckAt = Date.now();
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((reg) => {
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              const now = Date.now();
              if (now - lastSwUpdateCheckAt >= 30 * 60 * 1000) {
                lastSwUpdateCheckAt = now;
                void reg.update();
              }
            }
          });
        })
        .catch(() => {
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

