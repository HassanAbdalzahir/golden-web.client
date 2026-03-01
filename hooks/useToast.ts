import { useState, useCallback } from 'react';

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [idCounter, setIdCounter] = useState(0);

  const addToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info', duration = 3000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Prevent duplicate messages
    setToasts(prev => {
      const existingToast = prev.find(toast => toast.message === message && toast.type === type);
      if (existingToast) {
        return prev; // Don't add duplicate
      }
      
      const newToast: ToastMessage = { id, message, type, duration };
      return [...prev, newToast];
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const showSuccess = useCallback((message: string, duration?: number) => {
    addToast(message, 'success', duration);
  }, [addToast]);

  const showError = useCallback((message: string, duration?: number) => {
    addToast(message, 'error', duration);
  }, [addToast]);

  const showWarning = useCallback((message: string, duration?: number) => {
    addToast(message, 'warning', duration);
  }, [addToast]);

  const showInfo = useCallback((message: string, duration?: number) => {
    addToast(message, 'info', duration);
  }, [addToast]);

  return {
    toasts,
    addToast,
    removeToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
};