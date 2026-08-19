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
import Settings from './pages/Settings';
import TransformerSelection from './pages/TransformerSelection';

import { ThemeProvider } from './contexts/ThemeContext';
import { TrendDataProvider } from './contexts/TrendDataContext';
import { TemperatureDataProvider } from './contexts/TemperatureDataContext';
import { ApiProvider } from './contexts/ApiContext';
import { DialogProvider } from './contexts/DialogContext';


import AdminDashboard from './pages/AdminDashboard';

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

const DataProvidersWrapper = ({ children }) => (
  <TrendDataProvider>
    <TemperatureDataProvider>
      {children}
    </TemperatureDataProvider>
  </TrendDataProvider>
);

function App() {
  return (
    <ApiProvider>
      <DialogProvider>
        <ThemeProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <DataProvidersWrapper>
                    <MainLayout />
                  </DataProvidersWrapper>
                </ProtectedRoute>
              }>
                <Route index element={<Navigate to="/home" replace />} />
                <Route path="home" element={<TransformerSelection />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="transformer-data" element={<TransformerData />} />
                <Route path="users" element={<AddUser />} />
                <Route path="manage-users" element={<ManageUsersSuperuser />} />
                <Route path="profile" element={<Profile />} />
                <Route path="performance-report" element={<PerformanceReport />} />
                <Route path="settings" element={<Settings />} />

              </Route>
            </Routes>
          </BrowserRouter>
        </ThemeProvider>
      </DialogProvider>
    </ApiProvider>
  );
}

export default App;

