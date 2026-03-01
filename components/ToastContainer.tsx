import React from 'react';
import Toast from './Toast';
import { ToastMessage } from '../hooks/useToast';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onRemoveToast: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemoveToast }) => {
  return (
    <div className="fixed top-0 right-0 z-50 pointer-events-none">
      <div className="flex flex-col gap-2 p-4 pointer-events-auto">
        {toasts.map((toast, index) => (
          <div 
            key={toast.id} 
            className="animate-slide-in"
            style={{ 
              animationDelay: `${index * 100}ms`,
              zIndex: 50 + index 
            }}
          >
            <Toast
              message={toast.message}
              type={toast.type}
              onClose={() => onRemoveToast(toast.id)}
              duration={toast.duration}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ToastContainer;