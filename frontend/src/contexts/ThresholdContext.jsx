import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useApi } from './ApiContext';

export const FRONTEND_TO_DB_METRIC = {
  phaseA: 'v_phase',
  phaseB: 'v_phase',
  phaseC: 'v_phase',
  lineAB: 'v_line',
  lineBC: 'v_line',
  lineCA: 'v_line',
  currentA: 'current',
  currentB: 'current',
  currentC: 'current',
  currentN: 'current_n',
  currentUnbalance: 'current_unbalance',
  powerActiveTotal: 'power_active_total_kw',
  powerReactiveTotal: 'power_reactive_total_kvar',
  powerApparentTotal: 'power_apparent_total_kva',
  pfTotal: 'pf_total',
  frequency: 'frequency',
  oil_temperature: 'oil_temperature',
  oil_pressure: 'oil_pressure',
};

const ThresholdContext = createContext({
  thresholds: [],
  thresholdsMap: {},
  isLoading: false,
  getThreshold: () => ({ min: null, max: null, is_active: false }),
  refreshThresholds: async () => {},
});

export const ThresholdProvider = ({ children }) => {
  const { apiUrl } = useApi();
  const [thresholds, setThresholds] = useState([]);
  const [thresholdsMap, setThresholdsMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchThresholds = useCallback(async () => {
    try {
      const dbName = sessionStorage.getItem('db_name') || sessionStorage.getItem('tenant_db');
      const trafoId = sessionStorage.getItem('selectedTrafoId') || sessionStorage.getItem('selected_trafo_id') || '1';

      if (!dbName) {
        setIsLoading(false);
        return;
      }

      const res = await axios.get(`${apiUrl}/api/settings/thresholds?trafo_id=${trafoId}`, {
        headers: { 'X-DB-Name': dbName }
      });

      if (res.data?.success && Array.isArray(res.data.data)) {
        const rawList = res.data.data;
        setThresholds(rawList);

        const map = {};
        rawList.forEach(t => {
          map[t.metric_key] = {
            id: t.id,
            metric_key: t.metric_key,
            min: t.min_value !== null && t.min_value !== undefined ? parseFloat(t.min_value) : null,
            max: t.max_value !== null && t.max_value !== undefined ? parseFloat(t.max_value) : null,
            is_active: t.is_active === 1 || t.is_active === true,
            raw: t
          };
        });
        setThresholdsMap(map);
      }
    } catch (err) {
      console.warn('Failed to load dynamic thresholds from database:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl]);

  useEffect(() => {
    fetchThresholds();

    const handleThresholdUpdate = () => {
      fetchThresholds();
    };

    window.addEventListener('thresholdsUpdated', handleThresholdUpdate);
    window.addEventListener('storage', handleThresholdUpdate);

    return () => {
      window.removeEventListener('thresholdsUpdated', handleThresholdUpdate);
      window.removeEventListener('storage', handleThresholdUpdate);
    };
  }, [fetchThresholds]);

  const getThreshold = useCallback((metricKey) => {
    if (!metricKey) return { min: null, max: null, is_active: false };
    const dbKey = FRONTEND_TO_DB_METRIC[metricKey] || metricKey;
    const entry = thresholdsMap[dbKey] || thresholdsMap[metricKey];

    if (!entry) {
      return { min: null, max: null, is_active: false };
    }

    return {
      min: entry.min,
      max: entry.max,
      is_active: entry.is_active,
      id: entry.id,
      metric_key: entry.metric_key,
      raw: entry.raw
    };
  }, [thresholdsMap]);

  return (
    <ThresholdContext.Provider
      value={{
        thresholds,
        thresholdsMap,
        isLoading,
        getThreshold,
        refreshThresholds: fetchThresholds
      }}
    >
      {children}
    </ThresholdContext.Provider>
  );
};

export const useThresholds = () => useContext(ThresholdContext);
export default ThresholdContext;
