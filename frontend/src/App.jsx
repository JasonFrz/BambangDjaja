import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import TransformerSelection from './pages/TransformerSelection';
import Dashboard from './pages/Dashboard';
import Temperature from './pages/Temperature';
import Login from './pages/Login';
import AddUser from './pages/AddUser';
import DeviceProvisioning from './pages/DeviceProvisioning';
import TransformerData from './pages/TransformerData';
import ManageTransformers from './pages/ManageTransformers';
import { ThemeProvider } from './contexts/ThemeContext';
import { TrendDataProvider } from './contexts/TrendDataContext';
import { TemperatureDataProvider } from './contexts/TemperatureDataContext';
import { ApiProvider } from './contexts/ApiContext';
import NetworkBadge from './components/NetworkBadge';

const ProtectedRoute = ({ children }) => {
  const token = sessionStorage.getItem('token');
  
  // Fungsi untuk cek apakah token kadaluarsa (sudah lewat 2 jam)
  const isTokenExpired = (token) => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      // payload.exp is in seconds, Date.now() is in milliseconds
      return payload.exp * 1000 < Date.now();
    } catch (e) {
      return true; // Jika gagal decode, anggap expired
    }
  };

  if (!token || isTokenExpired(token)) {
    // Bersihkan storage jika token expired
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('role');
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

function App() {
  return (
    <ApiProvider>
      <ThemeProvider>
        <TrendDataProvider>
          <TemperatureDataProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={
                    // Conditional rendering for the index route
                    sessionStorage.getItem('role') === 'admin' 
                      ? <Navigate to="/provisioning" replace /> 
                      : <TransformerSelection />
                  } />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="transformer-data" element={<TransformerData />} />
                  <Route path="temperature" element={<Temperature />} />
                  <Route path="users" element={<AddUser />} />
                  <Route path="manage-transformers" element={<ManageTransformers />} />
                  <Route path="provisioning" element={<DeviceProvisioning />} />
                </Route>
              </Routes>
              <NetworkBadge />
            </BrowserRouter>
          </TemperatureDataProvider>
        </TrendDataProvider>
      </ThemeProvider>
    </ApiProvider>
  );
}

export default App;
