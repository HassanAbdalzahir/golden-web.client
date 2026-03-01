'use client';

import { useState, useEffect } from 'react';
import LoginScreen from '../components/LoginScreen';
import ArabicMainScreen from '../components/ArabicMainScreen';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const token = localStorage.getItem('golden_auth_token');
    if (token) {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (success: boolean) => {
    if (success) {
      setIsAuthenticated(true);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('golden_auth_token');
    setIsAuthenticated(false);
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-yellow-400 text-xl">تحميل نظام الذهب...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return <ArabicMainScreen onLogout={handleLogout} />;
}