import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, CheckCircle2 } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in react-leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Component to dynamically change map view when coordinates update
function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

const TransformerMapCard = () => {
  // Default coordinates (e.g. Sidoarjo area, similar to screenshot)
  const defaultLat = -7.336432504428765;
  const defaultLng = 112.76284930220689;

  const [position, setPosition] = useState([defaultLat, defaultLng]);
  const [inputLat, setInputLat] = useState(defaultLat.toString());
  const [inputLng, setInputLng] = useState(defaultLng.toString());
  const [locating, setLocating] = useState(false);

  const handleApply = () => {
    const lat = parseFloat(inputLat);
    const lng = parseFloat(inputLng);
    if (!isNaN(lat) && !isNaN(lng)) {
      setPosition([lat, lng]);
    }
  };

  const handleMyLocation = () => {
    setLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setPosition([lat, lng]);
          setInputLat(lat.toString());
          setInputLng(lng.toString());
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
    <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 flex flex-col h-full w-full relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 dark:bg-indigo-400/5 rounded-bl-full -mr-4 -mt-4 transition-transform group-hover:scale-110"></div>

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
          <MapPin size={20} />
        </div>
        <h3 className="font-semibold text-[#172b4d] dark:text-white font-heading tracking-tight flex-1">
          Transformer Location
        </h3>
      </div>

      {/* Map Container */}
      <div className="flex-1 min-h-[300px] w-full rounded-xl overflow-hidden border border-[#dfe1e6] dark:border-white/10 relative z-10 mb-4">
        <MapContainer center={position} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position}>
            <Popup>
              <div className="font-semibold text-sm">1800003781 (Trafo PTR B&D Factory)</div>
            </Popup>
          </Marker>
          <ChangeView center={position} />
        </MapContainer>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-end relative z-10">
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
        <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
          <button
            onClick={handleApply}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 rounded-lg font-semibold text-sm transition-colors"
          >
            <CheckCircle2 size={16} /> Apply
          </button>
          <button
            onClick={handleMyLocation}
            disabled={locating}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-[#151521] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 border border-gray-300 dark:border-white/20 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50"
          >
            <Navigation size={16} className={locating ? "animate-spin" : ""} />
            {locating ? "Locating..." : "My Location"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TransformerMapCard;
