import React, { createContext, useContext, useState } from 'react';

const ApiContext = createContext();

export const useApi = () => {
  return useContext(ApiContext);
};

export const ApiProvider = ({ children }) => {
  const publicUrl = import.meta.env.VITE_PUBLIC_API_URL || 'https://wonderful-sci-san-arthur.trycloudflare.com';

  const [apiUrl, setApiUrl] = useState(publicUrl);

  return (
    <ApiContext.Provider value={{ apiUrl }}>
      {children}
    </ApiContext.Provider>
  );
};
