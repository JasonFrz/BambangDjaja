import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useApi } from './ApiContext';

// Batas per metric dari /api/settings/limits: { key: { min, max, tripMin, tripMax } }.
const EMPTY = { min: null, max: null, tripMin: null, tripMax: null, is_active: false };

const ThresholdContext = createContext({
  limits: {},
  isLoading: false,
  getThreshold: () => EMPTY,
  refreshThresholds: async () => {},
});

export const ThresholdProvider = ({ children }) => {
  const { apiUrl } = useApi();
  const [limits, setLimits] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchLimits = useCallback(async () => {
    const dbName = sessionStorage.getItem('db_name');
    const trafoId = sessionStorage.getItem('selectedTrafoId') || '1';
    if (!dbName) { setIsLoading(false); return; }
    try {
      const res = await axios.get(`${apiUrl}/api/settings/limits`, { params: { trafo_id: trafoId } });
      setLimits(res.data && res.data.limits ? res.data.limits : {});
    } catch (err) {
      console.warn('Failed to load limits:', err.message);
      setLimits({});
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchLimits();
    window.addEventListener('thresholdsUpdated', fetchLimits);
    window.addEventListener('trafoChanged', fetchLimits);
    return () => {
      window.removeEventListener('thresholdsUpdated', fetchLimits);
      window.removeEventListener('trafoChanged', fetchLimits);
    };
  }, [fetchLimits]);

  const getThreshold = useCallback((metricKey) => {
    const L = metricKey ? limits[metricKey] : null;
    if (!L) return EMPTY;
    const has = (v) => v !== null && v !== undefined;
    return { min: has(L.min) ? L.min : null, max: has(L.max) ? L.max : null, tripMin: has(L.tripMin) ? L.tripMin : null, tripMax: has(L.tripMax) ? L.tripMax : null, is_active: has(L.min) || has(L.max) };
  }, [limits]);

  return (
    <ThresholdContext.Provider value={{ limits, isLoading, getThreshold, refreshThresholds: fetchLimits }}>
      {children}
    </ThresholdContext.Provider>
  );
};

export const useThresholds = () => useContext(ThresholdContext);
export default ThresholdContext;
