'use client';

import { useState } from 'react';

interface LoginScreenProps {
  onLogin: (success: boolean) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // Simple authentication - in production, this would be a real API call
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call

    if (username === 'admin' && password === 'golden123') {
      localStorage.setItem('golden_auth_token', 'mock-token-' + Date.now());
      localStorage.setItem('golden_username', username);
      onLogin(true);
    } else {
      setError('Invalid credentials. Use admin/golden123');
      onLogin(false);
    }

    setIsLoading(false);
  };

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-yellow-900">
      <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-yellow-600/20 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold text-yellow-400 mb-2">⚡ GOLDEN</div>
          <div className="text-gray-300 text-sm">Gold Ledger Financial System</div>
          <div className="text-gray-500 text-xs mt-1">Secure Financial Management</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="Enter username"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
              placeholder="Enter password"
              required
            />
          </div>

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-semibold py-3 px-4 rounded-lg hover:from-yellow-500 hover:to-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Authenticating...' : 'Login to Golden'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <div className="text-gray-500 text-xs">
            Demo Credentials: admin / golden123
          </div>
        </div>
      </div>
    </div>
  );
}