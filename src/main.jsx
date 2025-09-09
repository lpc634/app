import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// Import the main Tailwind styles FIRST
import './index.css'; 
import './styles/utilities.css';

// Import your custom theme styles SECOND
import './v3-services-theme.css';

// --- NEW: Register the Service Worker ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('Service Worker registered successfully:', registration);
      })
      .catch(registrationError => {
        console.error('Service Worker registration failed:', registrationError);
      });
  });
}
// --- END NEW SECTION ---

createRoot(document.getElementById('root')).render(
  <App />
);

// Global unhandled error guard to avoid Safari white screens
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error || event.message);
});