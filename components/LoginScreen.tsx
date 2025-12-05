import React, { useState } from 'react';
import { Brain, ArrowRight, Sparkles } from 'lucide-react';
import { useSession } from '../contexts/SessionContext';

export function LoginScreen() {
  const { login } = useSession();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmed = email.trim().toLowerCase();
    
    // Basic validation
    if (!trimmed) {
      setError('Podaj email');
      return;
    }
    
    if (!trimmed.includes('@')) {
      setError('Nieprawidłowy format email');
      return;
    }

    setError('');
    login(trimmed);
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 mb-4">
            <Brain className="w-8 h-8 text-cyan-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wider">AK-FLOW</h1>
          <p className="text-gray-500 text-sm mt-1">Proto-AGI Cognitive System</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-[#12141a] rounded-xl border border-gray-800 p-6">
          <div className="mb-6">
            <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-2">
              Podaj email
            </label>
            <input
              type="text"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="news@paulcrow.pl"
              className="w-full px-4 py-3 bg-[#0a0c10] border border-gray-700 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-400">{error}</p>
            )}
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white font-medium rounded-lg transition-all duration-200 shadow-lg shadow-cyan-500/20"
          >
            Wejdź <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Access Hints */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 text-xs mb-2">Szybki dostęp:</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => { setEmail('news@paulcrow.pl'); }}
              className="px-3 py-1 text-xs bg-[#12141a] border border-gray-800 rounded-full text-gray-400 hover:text-cyan-400 hover:border-cyan-500/50 transition-colors"
            >
              <Sparkles className="w-3 h-3 inline mr-1" />
              Alberto
            </button>
            <button
              onClick={() => { setEmail('test1@local.dev'); }}
              className="px-3 py-1 text-xs bg-[#12141a] border border-gray-800 rounded-full text-gray-400 hover:text-gray-300 hover:border-gray-700 transition-colors"
            >
              TestBot-A
            </button>
            <button
              onClick={() => { setEmail('test2@local.dev'); }}
              className="px-3 py-1 text-xs bg-[#12141a] border border-gray-800 rounded-full text-gray-400 hover:text-gray-300 hover:border-gray-700 transition-colors"
            >
              TestBot-B
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-700 text-xs mt-8">
          Zero haseł • Zero weryfikacji • Lokalne środowisko
        </p>
      </div>
    </div>
  );
}
