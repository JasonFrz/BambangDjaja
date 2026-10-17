import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import axios from 'axios';

axios.interceptors.request.use((config) => {
  const dbName = sessionStorage.getItem('db_name');
  const username = sessionStorage.getItem('username');
  const token = sessionStorage.getItem('token');
  
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  if (dbName) config.headers['X-DB-Name'] = dbName;
  if (username) config.headers['X-Username'] = username;
  const trafoId = sessionStorage.getItem('selectedTrafoId');
  if (trafoId) config.headers['X-Trafo-Id'] = trafoId;
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      if (window.location.pathname !== '/login') {
        sessionStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  if (!config) config = {};
  if (!config.headers) config.headers = {};
  
  const dbName = sessionStorage.getItem('db_name');
  const username = sessionStorage.getItem('username');
  const token = sessionStorage.getItem('token');
  const trafoId = sessionStorage.getItem('selectedTrafoId');

  const urlStr = typeof resource === 'string' ? resource : (resource instanceof URL ? resource.toString() : resource?.url || '');
  const isMapApi = urlStr && (urlStr.includes('openfreemap.org') || urlStr.includes('cartocdn.com') || urlStr.includes('openstreetmap.org') || urlStr.includes('basemaps'));

  if (!isMapApi) {
    if (config.headers instanceof Headers) {
      if (token) config.headers.set('Authorization', `Bearer ${token}`);
      if (dbName) config.headers.append('X-DB-Name', dbName);
      if (username) config.headers.append('X-Username', username);
      if (trafoId) config.headers.set('X-Trafo-Id', trafoId);
    } else {
      if (token) config.headers['Authorization'] = `Bearer ${token}`;
      if (dbName) config.headers['X-DB-Name'] = dbName;
      if (username) config.headers['X-Username'] = username;
      if (trafoId) config.headers['X-Trafo-Id'] = trafoId;
    }
  }
  
  const response = await originalFetch(resource, config);
  
  if (response.status === 401 || response.status === 403) {
    if (window.location.pathname !== '/login') {
      sessionStorage.clear();
      window.location.href = '/login';
    }
  }
  
  return response;
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
