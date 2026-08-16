// This Area Of Code Is: The app entry point.
// Explanation: Mounts React with every provider (language, accessibility,
// auth/roles, AI trio) and boots the OmniScore engine. Also registers the
// offline service worker after first paint.
// In Other Words: The ignition key — everything starts here.

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { I18nProvider } from './lib/i18n'
import { A11yProvider } from './lib/a11y'
import { AuthProvider } from './lib/auth'
import { AIProvider } from './lib/ai'
import './omniscore' // boots the OmniScore engine (registers all plugins)
import { startHandshake } from './lib/handshake'

// The Viewport Handshake — first thing, before paint: ask the device who it
// is and render for exactly that screen, always.
startHandshake();

// Service worker registration (offline-first worship mode).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline mode unavailable — app still runs */
    })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <A11yProvider>
          <AuthProvider>
            <AIProvider>
              <App />
            </AIProvider>
          </AuthProvider>
        </A11yProvider>
      </I18nProvider>
    </BrowserRouter>
  </StrictMode>,
)
