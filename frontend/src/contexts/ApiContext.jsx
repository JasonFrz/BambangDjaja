import React, { createContext, useContext, useState, useEffect } from 'react';

const ApiContext = createContext();

export const useApi = () => {
  return useContext(ApiContext);
};

export const ApiProvider = ({ children }) => {
  const localUrl = import.meta.env.VITE_LOCAL_API_URL || 'http://localhost:5000';
  const publicUrl = import.meta.env.VITE_PUBLIC_API_URL || 'https://wonderful-sci-san-arthur.trycloudflare.com';
  
  // Default ke public URL agar aman dari mixed-content block saat initial load
  const [apiUrl, setApiUrl] = useState(publicUrl);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkLocalConnection = async () => {
      try {
        // Ping ke local IP dengan timeout cepat (misal 1500ms)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1500);

        // Request ke local health endpoint
        // Kita menggunakan mode cors standar. Jika diblokir oleh mixed-content (karena dipanggil dari Vercel HTTPS),
        // fetch akan langsung throw error (masuk catch), dan fallback ke publicUrl.
        const response = await fetch(`${localUrl}/api/health`, {
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          console.log("SMART ROUTING: Connected to Intranet (Local). Using:", localUrl);
          setApiUrl(localUrl);
        } else {
          console.log("SMART ROUTING: Local ping failed, falling back to Internet (Public).");
          setApiUrl(publicUrl);
        }
      } catch (error) {
        // Error bisa jadi karena timeout, jaringan beda, atau diblokir Mixed-Content oleh browser
        console.log("SMART ROUTING: Intranet unreachable (or blocked). Using Internet (Public) route:", publicUrl);
        setApiUrl(publicUrl);
      } finally {
        setIsChecking(false);
      }
    };

    checkLocalConnection();
  }, [localUrl, publicUrl]);

  // Loading screen selama 1.5 detik maksimal
  if (isChecking) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', color: 'white', fontFamily: 'sans-serif' }}>
        <h3>Detecting optimal network route...</h3>
      </div>
    );
  }

  return (
    <ApiContext.Provider value={{ apiUrl }}>
      {children}
    </ApiContext.Provider>
  );
};
