import React, { useState, useEffect, useRef, useCallback } from "react";
import { Thermometer, Settings, Zap, Wifi, WifiOff, Camera, Upload, X, Check, Image as ImageIcon } from "lucide-react";
import Cropper from 'react-easy-crop';
import Webcam from 'react-webcam';

const getCroppedImg = async (imageSrc, pixelCrop) => {
  const image = new Image();
  image.src = imageSrc;
  await new Promise(resolve => { image.onload = resolve; });

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/jpeg');
  });
};
import { useTrendData } from "../contexts/TrendDataContext";
import { useApi } from "../contexts/ApiContext";
import { useDialog } from "../contexts/DialogContext";
import TransformerMapCard from '../components/TransformerMapCard';

const SpecField = ({ label, value, unit }) => (
  <div className="flex flex-col gap-1.5 w-full">
    <label className="text-xs font-bold text-[#5e6c84] dark:text-[#94a3b8] uppercase tracking-wider">{label}</label>
    <div className="flex rounded-lg overflow-hidden border border-[#dfe1e6] dark:border-white/10 shadow-sm transition-all focus-within:border-[#0052cc] focus-within:ring-1 focus-within:ring-[#0052cc]">
      <input 
        type="text" 
        value={value} 
        readOnly 
        className="flex-1 px-3 py-2 text-[#172b4d] dark:text-white bg-white dark:bg-[#151521] outline-none w-full"
      />
      <div className="px-3 py-2 bg-gray-50 dark:bg-white/5 text-[#5e6c84] dark:text-[#94a3b8] font-semibold border-l border-[#dfe1e6] dark:border-white/10 flex items-center justify-center min-w-[60px]">
        {unit}
      </div>
    </div>
  </div>
);

const TransformerData = () => {
  const { isLive } = useTrendData();
  const { apiUrl } = useApi();
  const { confirm } = useDialog();
  const fileInputRef = useRef(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  
  // Crop states
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  // Webcam states
  const [cameraMode, setCameraMode] = useState(false);
  const webcamRef = useRef(null);

  const captureWebcam = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setPreviewUrl(imageSrc);
        setSelectedImage(new File([], 'webcam.jpg')); // Dummy file to pass truthy check
        setCameraMode(false);
      }
    }
  }, [webcamRef]);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);
  const [trafoImage, setTrafoImage] = useState(null);

  const trafoId = sessionStorage.getItem('selectedTrafoId');
  const companyNameHeader = sessionStorage.getItem('company_name');
  const token = sessionStorage.getItem('token');

  useEffect(() => {
    // Fetch existing image if any
    if (trafoId && companyNameHeader) {
      fetch(`${apiUrl}/api/trafo/${trafoId}`, {
        headers: {
          'X-DB-Name': companyNameHeader,
          'Authorization': `Bearer ${token}`
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.images) {
          setTrafoImage(data.images);
        }
      })
      .catch(err => console.error('Error fetching trafo data:', err));
    }
  }, [trafoId, companyNameHeader, apiUrl, token]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedImage(file);
      setPreviewUrl(URL.createObjectURL(file));
      setUploadError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedImage) {
      setUploadError('Pilih gambar terlebih dahulu.');
      return;
    }
    
    if (!trafoId) {
      setUploadError('Tidak ada Trafo yang dipilih.');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setUploadSuccess('');

    try {
      const croppedBlob = await getCroppedImg(previewUrl, croppedAreaPixels);
      const formData = new FormData();
      formData.append('image', croppedBlob, 'trafo_image.jpg');

      const response = await fetch(`${apiUrl}/api/trafo/${trafoId}/image`, {
        method: 'POST',
        headers: {
          'X-DB-Name': companyNameHeader,
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        setUploadSuccess('Gambar berhasil disimpan ke Google Drive!');
        setTrafoImage(data.imageUrl);
        setTimeout(() => {
          setShowUploadModal(false);
          setSelectedImage(null);
          setPreviewUrl(null);
          setUploadSuccess('');
        }, 2000);
      } else {
        setUploadError(data.error || 'Gagal mengupload gambar');
      }
    } catch (err) {
      setUploadError('Koneksi ke server gagal.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleResetImage = async () => {
    const isConfirmed = await confirm('Apakah Anda yakin ingin mereset gambar trafo ke default?', { title: 'Reset Foto' });
    if (!isConfirmed) return;
    
    setIsUploading(true);
    setUploadError('');
    try {
      const response = await fetch(`${apiUrl}/api/trafo/${trafoId}/image`, {
        method: 'DELETE',
        headers: {
          'X-DB-Name': companyNameHeader,
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        setTrafoImage(null);
        setSelectedImage(null);
        setPreviewUrl(null);
        setShowUploadModal(false);
      } else {
        setUploadError('Gagal mereset gambar');
      }
    } catch (err) {
      setUploadError('Koneksi gagal');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-[fadeIn_0.5s_ease-out] w-full pb-10">

      {/* Header Section */}
      <div className="mb-2 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-[#172b4d] dark:text-white font-heading mb-1 transition-colors flex items-center gap-4">
            Transformer Data
          </h2>
          <p className="text-[#5e6c84] dark:text-[#94a3b8] text-[0.95rem] transition-colors mt-1">
            Transformer Location & Specifications
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${isLive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 animate-glow-pulse" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
            {isLive ? <Wifi size={16} /> : <WifiOff size={16} />}
            {isLive ? "Live" : "Offline"}
          </div>
          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-600 text-white font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/20"
          >
            <Camera size={16} />
            <span className="hidden sm:inline">Photo</span>
          </button>
        </div>
      </div>

      <div className="w-full">
        <TransformerMapCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Info Panel 1 */}
        <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 flex flex-col">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#dfe1e6] dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="text-teal-500">
                <Settings size={20} />
              </div>
              <h3 className="font-bold text-lg text-[#172b4d] dark:text-white">General Specifications</h3>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <SpecField label="RATED POWER" value="100" unit="kVA" />
            <SpecField label="FREQUENCY" value="50" unit="Hz" />
            <SpecField label="IMPEDANCE" value="4" unit="%" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 flex flex-col">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#dfe1e6] dark:border-white/10">
            <div className="text-indigo-500">
              <Thermometer size={20} />
            </div>
            <h3 className="font-bold text-lg text-[#172b4d] dark:text-white">Energy Loss & Temperature</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <SpecField label="NO LOAD LOSS" value="150" unit="Watt" />
            <SpecField label="FULL LOAD LOSS" value="1200" unit="Watt" />
            <SpecField label="TOP OIL TEMP RISE LV" value="-" unit="°C" />
            <SpecField label="TOP OIL TEMP RISE HV" value="-" unit="°C" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#151521] rounded-2xl p-5 shadow-sm border border-transparent dark:border-white/5 flex flex-col lg:col-span-2">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#dfe1e6] dark:border-white/10">
            <div className="text-amber-500">
              <Zap size={20} />
            </div>
            <h3 className="font-bold text-lg text-[#172b4d] dark:text-white">Voltage & Current</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <SpecField label="RATED VOLTAGE (LV)" value="400" unit="V" />
            <SpecField label="RATED VOLTAGE (HV)" value="20000" unit="V" />
            <SpecField label="RATED CURRENT (LV)" value="144" unit="A" />
            <SpecField label="RATED CURRENT (HV)" value="2.89" unit="A" />
          </div>
        </div>

      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white dark:bg-[#151521] w-full max-w-md rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)] flex flex-col border border-gray-200 dark:border-white/10">
            <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-black/20">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Camera size={20} className="text-blue-500" /> Upload Trafo Photo
              </h2>
              <button 
                onClick={() => {
                  setShowUploadModal(false);
                  setSelectedImage(null);
                  setPreviewUrl(null);
                  setCameraMode(false);
                  setUploadError('');
                  setUploadSuccess('');
                }} 
                className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-6">
              
              {!previewUrl && !cameraMode && (
                <div className="flex gap-4">
                  <div 
                    className="flex-1 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center bg-gray-50 dark:bg-white/5 cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors p-2 text-center"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={28} className="text-gray-400 mb-2" />
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Browse Gallery</p>
                  </div>
                  <div 
                    className="flex-1 h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center bg-gray-50 dark:bg-white/5 cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors p-2 text-center"
                    onClick={() => setCameraMode(true)}
                  >
                    <Camera size={28} className="text-gray-400 mb-2" />
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Open Camera</p>
                  </div>
                </div>
              )}

              {!previewUrl && cameraMode && (
                <div className="flex flex-col gap-3">
                  <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center">
                    <Webcam
                      audio={false}
                      ref={webcamRef}
                      screenshotFormat="image/jpeg"
                      videoConstraints={{ facingMode: "environment" }}
                      className="w-full h-full object-cover"
                    />
                    <button 
                      onClick={() => setCameraMode(false)}
                      className="absolute top-2 right-2 p-1.5 bg-gray-800/60 text-white rounded-full hover:bg-red-500"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <button 
                    onClick={captureWebcam}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
                  >
                    <Camera size={20} /> Capture Photo
                  </button>
                </div>
              )}

              {previewUrl && (
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-black/10">
                  <Cropper
                    image={previewUrl}
                    crop={crop}
                    zoom={zoom}
                    aspect={16 / 9}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                    classes={{ containerClassName: "w-full h-full rounded-xl" }}
                  />
                  <button 
                    onClick={() => {
                      setSelectedImage(null);
                      setPreviewUrl(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                      setZoom(1);
                      setCrop({ x: 0, y: 0 });
                    }}
                    className="absolute top-2 right-2 z-10 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-md"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              {/* Hidden File Input */}
              <input 
                type="file" 
                ref={fileInputRef}
                accept="image/*" 
                className="hidden"
                onChange={handleImageChange}
              />

              {uploadError && (
                <div className="p-3 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm border border-red-500/20 text-center">
                  {uploadError}
                </div>
              )}

              {uploadSuccess && (
                <div className="p-3 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-sm border border-green-500/20 text-center flex items-center justify-center gap-2">
                  <Check size={16} /> {uploadSuccess}
                </div>
              )}

            </div>
            
            <div className="p-5 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-black/20 flex justify-between items-center">
              <div>
                {trafoImage && (
                  <button 
                    onClick={handleResetImage}
                    disabled={isUploading}
                    className="px-4 py-2 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    Reset Photo
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowUploadModal(false)}
                  className="px-4 py-2 font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/5 rounded-lg transition-colors"
                  disabled={isUploading}
                >
                  Cancel
                </button>
              <button 
                onClick={handleUpload}
                disabled={!selectedImage || isUploading}
                className="px-6 py-2 font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-blue-500/20"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={16} /> Save
                  </>
                )}
              </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransformerData;
