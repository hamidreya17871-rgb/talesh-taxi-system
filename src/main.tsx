import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register the PWA only on explicitly approved production hosts. This keeps
// preview deployments from reusing a stale application shell while allowing
// both the current Bolt host and the Cloudflare Pages production host.
const pwaHosts = (
  import.meta.env.VITE_PWA_HOSTS ??
  'talesh-taxi-system.pages.dev,web-application-deve-0r9y.bolt.host'
)
  .split(',')
  .map(host => host.trim().toLowerCase())
  .filter(Boolean);

if (
  'serviceWorker' in navigator &&
  import.meta.env.PROD &&
  pwaHosts.includes(window.location.hostname.toLowerCase())
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
