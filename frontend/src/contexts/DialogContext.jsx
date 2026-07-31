import React, { createContext, useContext, useState, useCallback } from 'react';
import { AlertCircle, HelpCircle } from 'lucide-react';

const DialogContext = createContext(null);

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};

export const DialogProvider = ({ children }) => {
  const [dialogs, setDialogs] = useState([]);

  const showDialog = useCallback((options) => {
    return new Promise((resolve) => {
      const id = Date.now().toString() + Math.random().toString();
      setDialogs(prev => [...prev, { ...options, id, resolve }]);
    });
  }, []);

  const confirm = useCallback((message, options = {}) => {
    return showDialog({ type: 'confirm', message, ...options });
  }, [showDialog]);

  const alert = useCallback((message, options = {}) => {
    return showDialog({ type: 'alert', message, ...options });
  }, [showDialog]);

  const closeDialog = useCallback((id, result) => {
    setDialogs(prev => {
      const dialog = prev.find(d => d.id === id);
      if (dialog) dialog.resolve(result);
      return prev.filter(d => d.id !== id);
    });
  }, []);

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {dialogs.map(dialog => (
        <Dialog 
          key={dialog.id} 
          {...dialog} 
          onClose={(res) => closeDialog(dialog.id, res)} 
        />
      ))}
    </DialogContext.Provider>
  );
};

const Dialog = ({ type, message, title, onClose }) => {
  const isConfirm = type === 'confirm';
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-[slideUpFade_0.3s_ease-out] border border-gray-100 dark:border-white/10">
        <div className="p-6">
          <div className={`flex items-center justify-center w-14 h-14 rounded-full mb-5 mx-auto ${
            isConfirm 
              ? 'bg-amber-50 text-amber-500 dark:bg-amber-500/10 dark:text-amber-400' 
              : 'bg-blue-50 text-blue-500 dark:bg-blue-500/10 dark:text-blue-400'
          }`}>
             {isConfirm ? <HelpCircle size={28} /> : <AlertCircle size={28} />}
          </div>
          <h3 className="text-xl font-bold text-center text-[#172b4d] dark:text-white mb-2 tracking-tight">
            {title || (isConfirm ? 'Confirmation' : 'Information')}
          </h3>
          <p className="text-center text-[#5e6c84] dark:text-[#94a3b8] text-sm leading-relaxed">
            {message}
          </p>
        </div>
        <div className="bg-gray-50/50 dark:bg-white/[0.02] p-4 flex gap-3 justify-end border-t border-gray-100 dark:border-white/5">
          {isConfirm && (
            <button
              onClick={() => onClose(false)}
              className="flex-1 px-4 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-[#5e6c84] dark:text-[#94a3b8] rounded-xl hover:bg-gray-50 dark:hover:bg-white/10 font-medium transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            onClick={() => onClose(true)}
            className={`flex-1 px-4 py-2.5 text-white rounded-xl font-medium transition-colors shadow-lg ${
              isConfirm 
                ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20' 
                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
            }`}
          >
            {isConfirm ? 'Confirm' : 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};
