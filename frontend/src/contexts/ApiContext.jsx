import React, { createContext, useContext, useState } from 'react';

const ApiContext = createContext();

export const useApi = () => {
  return useContext(ApiContext);
};

export const ApiProvider = ({ children }) => {
  const defaultUrl =
    import.meta.env.VITE_PUBLIC_API_URL ||
    import.meta.env.VITE_LOCAL_API_URL ||
    'http://localhost:5000';

  const [apiUrl, setApiUrl] = useState(defaultUrl);

  return (
    <ApiContext.Provider value={{ apiUrl }}>
      {children}
    </ApiContext.Provider>
  );
};
