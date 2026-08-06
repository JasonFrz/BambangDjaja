import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import AddUser from './pages/AddUser';
import ManageUsersSuperuser from './pages/ManageUsersSuperuser';
import Profile from './pages/Profile';
import TransformerData from './pages/TransformerData';
import PerformanceReport from './pages/PerformanceReport';

import { ThemeProvider } from './contexts/ThemeContext';
import { TrendDataProvider } from './contexts/TrendDataContext';
import { TemperatureDataProvider } from './contexts/TemperatureDataContext';
import { ApiProvider } from './contexts/ApiContext';
import { DialogProvider } from './contexts/DialogContext';
import EnergyLoader from './components/EnergyLoader';

import SuperAdminDashboard from './pages/SuperAdminDashboard';

const ProtectedRoute = ({ children }) => {
  const username = sessionStorage.getItem('username');
  const companyName = sessionStorage.getItem('company_name');
  
  if (!username || !companyName) {
    sessionStorage.removeItem('username');
    sessionStorage.removeItem('role');
    sessionStorage.removeItem('company_name');
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

function App() {
  return (
    <ApiProvider>
      <DialogProvider>
        <ThemeProvider>
        <TrendDataProvider>
          <TemperatureDataProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/superadmin" element={<SuperAdminDashboard />} />
                <Route path="/" element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="transformer-data" element={<TransformerData />} />
                  <Route path="users" element={<AddUser />} />
                  <Route path="manage-users" element={<ManageUsersSuperuser />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="performance-report" element={<PerformanceReport />} />

                </Route>
              </Routes>
            </BrowserRouter>
          </TemperatureDataProvider>
        </TrendDataProvider>
        </ThemeProvider>
      </DialogProvider>
    </ApiProvider>
  );
}

export default App;

