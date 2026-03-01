import React, { useEffect } from 'react';

export interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 3000 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-500 border-green-600';
      case 'error':
        return 'bg-red-500 border-red-600';
      case 'warning':
        return 'bg-yellow-500 border-yellow-600';
      case 'info':
        return 'bg-blue-500 border-blue-600';
      default:
        return 'bg-gray-500 border-gray-600';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return '';
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 ${getTypeStyles()} text-white px-4 py-3 rounded-lg shadow-lg border animate-fade-in flex items-center gap-2 max-w-sm`}>
      <span className="text-lg">{getIcon()}</span>
      <div className="flex-1 text-sm font-medium text-right">{message}</div>
      <button 
        onClick={onClose}
        className="text-white hover:text-gray-200 ml-2 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
};

export default Toast;