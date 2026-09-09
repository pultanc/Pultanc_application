/// <reference types="vite/client"/>
/// <reference types="vite-plugin-pwa/client"/>
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { db } from './firebase';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker safely only in production outside of iframes
if ((import.meta as any).env?.PROD && typeof window !== 'undefined' && 'serviceWorker' in navigator && window.self === window.top) {
  try {
    registerSW({
      onNeedRefresh() {},
      onOfflineReady() {},
    });
  } catch (err) {
    console.warn('Service worker registration skipped:', err);
  }
}

// Removed testConnection() to avoid benign console errors in strict network environments

createRoot(document.getElementById('root')!).render(

 <StrictMode>
 <ThemeProvider>
 <App />
 </ThemeProvider>
 </StrictMode>,
);
