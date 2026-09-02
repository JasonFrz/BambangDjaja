import React, { useState, useEffect, useRef, useCallback } from 'react';
import Map, { Marker, Popup } from 'react-map-gl/maplibre';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin, Navigation, CheckCircle2, Layers, ArrowUp, ArrowDown, RotateCcw, RotateCw, Compass } from 'lucide-react';
import { useDialog } from '../contexts/DialogContext';
import { NavigationControl } from 'react-map-gl/maplibre';

const styles = {
  style3d: 'https://tiles.openfreemap.org/styles/liberty',
  bright: 'https://tiles.openfreemap.org/styles/bright',
  dark: 'https://tiles.openfreemap.org/styles/dark',
};

// ─── Analog Joystick Component ─────────────────────────────────────────
const MapJoystick = ({ onMove }) => {
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const joystickRef = useRef(null);

  const handlePointerDown = (e) => {
    setActive(true);
    e.target.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (!active || !joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    let dx = e.clientX - rect.left - centerX;
    let dy = e.clientY - rect.top - centerY;
    
    // Calculate max drag radius (e.g., container half-width minus knob half-width)
    // For a 48px container and 24px knob, maxRadius is (24 - 12) = 12
    const maxRadius = (rect.width / 2) - 12; 
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > maxRadius) {
      dx = (dx / distance) * maxRadius;
      dy = (dy / distance) * maxRadius;
    }
    
    setPosition({ x: dx, y: dy });
    
    // Add small deadzone (10%)
    const normX = Math.abs(dx/maxRadius) < 0.1 ? 0 : dx/maxRadius;
    const normY = Math.abs(dy/maxRadius) < 0.1 ? 0 : dy/maxRadius;
    
    onMove({ x: normX, y: normY });
  };

  const handlePointerUp = (e) => {
    setActive(false);
    setPosition({ x: 0, y: 0 });
    onMove({ x: 0, y: 0 });
    e.target.releasePointerCapture(e.pointerId);
  };

  return (
    <div 
      ref={joystickRef}
      className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-white/40 dark:bg-black/30 backdrop-blur-md flex items-center justify-center relative touch-none shadow-[inset_0_2px_10px_rgba(0,0,0,0.1)] border border-gray-300/50 dark:border-white/10 shrink-0"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      title="3D Joystick"
    >
      <div 
        className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-white dark:bg-[#1a1a2e] shadow-[0_3px_8px_rgba(0,0,0,0.2)] flex items-center justify-center cursor-grab active:cursor-grabbing border border-gray-100 dark:border-white/10 ${active ? '' : 'transition-transform duration-200 ease-out'}`}
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-sm" />
      </div>
    </div>
  );
};

const TransformerMapCard = ({ latitude, longitude, onLocationUpdate }) => {
  const { alert } = useDialog();
  const defaultLat = latitude || -7.336432504428765;
  const defaultLng = longitude || 112.76284930220689;

  const [position, setPosition] = useState({ lat: defaultLat, lng: defaultLng });
  const [inputLat, setInputLat] = useState(defaultLat.toString());
  const [inputLng, setInputLng] = useState(defaultLng.toString());
  const [locating, setLocating] = useState(false);
  const [showPopup, setShowPopup] = useState(true);
  
  const [mapStyleKey, setMapStyleKey] = useState('style3d');
  const selectedStyle = styles[mapStyleKey];
  const is3D = mapStyleKey === 'style3d';
  
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.easeTo({ pitch: is3D ? 60 : 0, duration: 500 });
    }
  }, [is3D]);

  const handleApply = () => {
    const lat = parseFloat(inputLat);
    const lng = parseFloat(inputLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      setPosition({ lat, lng });
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 1500 });
    }
  };

  // ─── Analog Joystick Logic ─────────────────────────────────────────
  const requestRef = useRef();
  const joyData = useRef({ x: 0, y: 0 });

  const handleJoystickMove = (data) => {
    joyData.current = data;
  };

  const animate = () => {
    if (mapRef.current && (Math.abs(joyData.current.x) > 0 || Math.abs(joyData.current.y) > 0)) {
       const currentBearing = mapRef.current.getBearing();
       const currentPitch = mapRef.current.getPitch();
       
       // Slower speed for smoother rotation
       const bearingDelta = joyData.current.x * 0.5; 
       const pitchDelta = joyData.current.y * 0.3; 
       
       let newPitch = currentPitch + pitchDelta;
       newPitch = Math.max(0, Math.min(60, newPitch)); 

       mapRef.current.jumpTo({ bearing: currentBearing + bearingDelta, pitch: newPitch });
    }
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);

  const handleResetView = () => {
    mapRef.current?.easeTo({ pitch: is3D ? 60 : 0, bearing: 0, duration: 500 });
  };

  // ─── Resizable Height State ──────────────────────────────────────────
  const [mapHeight, setMapHeight] = useState(() => {
    const saved = localStorage.getItem('user_layouts_map_only_height');
    return saved ? parseInt(saved, 10) : 300; // default to 300px for just the map area
  });
  
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef(0);
  const resizeStartHeight = useRef(0);

  const handleResizeStart = (e) => {
    setIsResizing(true);
    resizeStartY.current = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    resizeStartHeight.current = mapHeight;
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleResizeMove = (e) => {
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      if (!clientY) return;
      
      const deltaY = clientY - resizeStartY.current;
      const newHeight = Math.max(150, resizeStartHeight.current + deltaY); // Min map height 150px
      setMapHeight(newHeight);
      mapRef.current?.resize();
    };

    const handleResizeEnd = () => {
      setIsResizing(false);
      document.body.style.userSelect = '';
      localStorage.setItem('user_layouts_map_only_height', mapHeight.toString());
      mapRef.current?.resize();
    };

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
    window.addEventListener('touchmove', handleResizeMove, { passive: false });
    window.addEventListener('touchend', handleResizeEnd);

    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
      window.removeEventListener('touchmove', handleResizeMove);
      window.removeEventListener('touchend', handleResizeEnd);
    };
  }, [isResizing, mapHeight]);

  const handleMyLocation = () => {
    setLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setPosition({ lat, lng });
          setInputLat(lat.toString());
          setInputLng(lng.toString());
          mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 1500 });
          setLocating(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Gagal mendapatkan lokasi. Pastikan izin lokasi di browser sudah diaktifkan.");
          setLocating(false);
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert("Geolocation tidak didukung di browser ini.");
      setLocating(false);
    }
  };

  return (
    <div 
      className="bg-white dark:bg-[#151521] rounded-2xl p-4 sm:p-5 shadow-sm border border-transparent dark:border-white/5 flex flex-col w-full relative overflow-hidden group pb-6 h-auto"
    >
      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 dark:bg-indigo-400/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5 relative z-10">
        <div className="flex items-center gap-3">
          <div className="shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
            <MapPin size={20} />
          </div>
          <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight flex-1">
            Transformer Location
          </h3>
        </div>
        
        {/* Style Selector */}
        <div className="relative flex items-center self-start sm:self-auto bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg overflow-hidden">
          <div className="pl-3 pr-2 text-gray-500">
            <Layers size={14} />
          </div>
          <select
            value={mapStyleKey}
            onChange={(e) => setMapStyleKey(e.target.value)}
            className="bg-transparent text-[#172b4d] dark:text-white py-1.5 pr-8 pl-1 text-xs font-semibold outline-none cursor-pointer appearance-none"
          >
            <option value="style3d" className="bg-white dark:bg-[#1f2937]">3D</option>
            <option value="bright" className="bg-white dark:bg-[#1f2937]">Bright</option>
            <option value="dark" className="bg-white dark:bg-[#1f2937]">Dark</option>
          </select>
          {/* Custom chevron for select */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
          </div>
        </div>
      </div>

      <div 
        style={{ height: `${mapHeight}px` }}
        className="w-full rounded-xl overflow-hidden border border-[#dfe1e6] dark:border-white/10 relative z-10 mb-4 bg-[#f3f4f6] dark:bg-[#1f2937] shrink-0"
      >
        <Map
          ref={mapRef}
          initialViewState={{
            longitude: position.lng,
            latitude: position.lat,
            zoom: 15,
            pitch: is3D ? 60 : 0
          }}
          mapStyle={selectedStyle}
          mapLib={maplibregl}
          attributionControl={false}
        >
          <Marker longitude={position.lng} latitude={position.lat} anchor="bottom" onClick={e => { e.originalEvent.stopPropagation(); setShowPopup(!showPopup); }}>
            <div className="text-red-500 hover:text-red-600 transition-colors cursor-pointer filter drop-shadow-md">
              <MapPin size={36} weight="fill" fill="currentColor" />
            </div>
          </Marker>

          {showPopup && (
            <Popup
              longitude={position.lng}
              latitude={position.lat}
              anchor="bottom"
              offset={[0, -32]}
              onClose={() => setShowPopup(false)}
              closeButton={true}
              closeOnClick={false}
              className="text-xs font-semibold rounded-lg overflow-hidden"
            >
              <div className="text-gray-800 text-center py-1">1800003781 (Trafo PTR B&D Factory)</div>
            </Popup>
          )}

          <NavigationControl position="bottom-right" visualizePitch={true} showCompass={false} />
        </Map>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-end relative z-10 mb-2">
        <div className="flex-1 w-full">
          <label className="flex items-center gap-2 text-xs font-semibold text-[#5e6c84] dark:text-[#94a3b8] mb-1.5 uppercase tracking-wider">
            <MapPin size={12} /> Latitude
          </label>
          <input
            type="text"
            value={inputLat}
            onChange={(e) => setInputLat(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#dfe1e6] dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-[#172b4d] dark:text-white outline-none focus:border-[#0052cc] transition-colors"
          />
        </div>
        <div className="flex-1 w-full">
          <label className="flex items-center gap-2 text-xs font-semibold text-[#5e6c84] dark:text-[#94a3b8] mb-1.5 uppercase tracking-wider">
            <MapPin size={12} /> Longitude
          </label>
          <input
            type="text"
            value={inputLng}
            onChange={(e) => setInputLng(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[#dfe1e6] dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-[#172b4d] dark:text-white outline-none focus:border-[#0052cc] transition-colors"
          />
        </div>
        <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0 items-stretch">
          <button
            onClick={handleApply}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 rounded-lg font-semibold text-sm transition-colors"
          >
            <CheckCircle2 size={16} /> Apply
          </button>
          <button
            onClick={handleMyLocation}
            disabled={locating}
            title="My Location"
            className="flex items-center justify-center w-10 sm:w-12 bg-white dark:bg-[#151521] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 border border-gray-300 dark:border-white/20 rounded-lg transition-colors disabled:opacity-50 shrink-0"
          >
            <Navigation size={18} className={locating ? "animate-spin" : ""} />
          </button>
          <MapJoystick onMove={handleJoystickMove} />
        </div>
      </div>

      {/* Touch-Friendly Drag Handle */}
      <div 
        className="absolute bottom-0 left-0 w-full h-6 cursor-ns-resize flex items-center justify-center bg-transparent hover:bg-gray-100 dark:hover:bg-white/5 transition-colors z-20"
        onMouseDown={handleResizeStart}
        onTouchStart={handleResizeStart}
      >
        <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
      </div>
    </div>
  );
};

export default TransformerMapCard;
