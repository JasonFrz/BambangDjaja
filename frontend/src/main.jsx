import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import axios from 'axios';

// Global bypass for Ngrok free tier warning on Axios
axios.defaults.headers.common['ngrok-skip-browser-warning'] = '69420';

// Global bypass for Ngrok free tier warning on native Fetch
const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  if (!config) config = {};
  if (!config.headers) config.headers = {};
  
  // Create a new Headers object or plain object to safely add the header
  if (config.headers instanceof Headers) {
    config.headers.append('ngrok-skip-browser-warning', '69420');
  } else {
    config.headers['ngrok-skip-browser-warning'] = '69420';
  }
  
  return originalFetch(resource, config);
};
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
