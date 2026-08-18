import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import axios from 'axios';

axios.interceptors.request.use((config) => {
  config.headers['ngrok-skip-browser-warning'] = '69420';
  const dbName = sessionStorage.getItem('company_name');
  const username = sessionStorage.getItem('username');
  const token = sessionStorage.getItem('token');
  
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  if (dbName) config.headers['X-DB-Name'] = dbName;
  if (username) config.headers['X-Username'] = username;
  return config;
});

const originalFetch = window.fetch;
window.fetch = async (...args) => {
  let [resource, config] = args;
  if (!config) config = {};
  if (!config.headers) config.headers = {};
  
  const dbName = sessionStorage.getItem('company_name');
  const username = sessionStorage.getItem('username');
  const token = sessionStorage.getItem('token');

  if (config.headers instanceof Headers) {
    if (token) config.headers.set('Authorization', `Bearer ${token}`);
    config.headers.append('ngrok-skip-browser-warning', '69420');
    if (dbName) config.headers.append('X-DB-Name', dbName);
    if (username) config.headers.append('X-Username', username);
  } else {
    config.headers['ngrok-skip-browser-warning'] = '69420';
    if (token) config.headers['Authorization'] = `Bearer ${token}`;
    if (dbName) config.headers['X-DB-Name'] = dbName;
    if (username) config.headers['X-Username'] = username;
  }
  
  return originalFetch(resource, config);
};
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
