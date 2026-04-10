'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const inputRef     = useRef<HTMLInputElement>(null);

  const [mode,     setMode]     = useState<'staff' | 'manager'>('staff');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  // Reset input when switching modes
  useEffect(() => {
    setPassword('');
    setError('');
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [mode]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await fetch('/api/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ password, role: mode === 'staff' ? 'staff' : 'admin' }),
    });

    if (res.ok) {
      const data = await res.json();
      // Staff always lands on /inventory; manager goes to where they came from
      if (data.role === 'staff') {
        router.replace('/inventory');
      } else {
        const from = searchParams.get('from') ?? '/';
        router.replace(from);
      }
    } else {
      const data = await res.json();
      setError(data.error ?? 'Incorrect credentials. Please try again.');
      setPassword('');
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const isStaff = mode === 'staff';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">

          {/* Logo + Title */}
          <div className="flex flex-col items-center mb-6">
            <Image src="/logo.png" alt="AMG Plastic Surgery" width={90} height={90} className="mb-3 object-contain" />
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">AMG Inventory</h1>
            <p className="text-sm text-slate-400 mt-0.5">AMG Plastic Surgery</p>
          </div>

          {/* Role Toggle */}
          <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => setMode('staff')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                isStaff
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              🏥 Staff
            </button>
            <button
              type="button"
              onClick={() => setMode('manager')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                !isStaff
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              🔑 Manager
            </button>
          </div>

          {/* Role description */}
          <p className="text-xs text-slate-400 text-center mb-5 -mt-2">
            {isStaff
              ? 'Adjust quantities only — no editing or admin access'
              : 'Full access: dashboard, edit, archive, and reports'}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                {isStaff ? 'Staff PIN' : 'Manager Password'}
              </label>
              <input
                ref={inputRef}
                type="password"
                inputMode={isStaff ? 'numeric' : 'text'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isStaff ? 'Enter 4-digit PIN' : 'Enter manager password'}
                required
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-base text-slate-800 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent focus:bg-white transition-all"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className={`w-full flex items-center justify-center gap-2 text-white font-semibold text-sm px-4 py-3 rounded-xl shadow-sm transition-colors disabled:opacity-40 ${
                isStaff
                  ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-300'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:bg-indigo-300'
              }`}
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Signing in…
                </>
              ) : isStaff ? 'Enter Staff View' : 'Sign In as Manager'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-400 mt-5">
          AMG Plastic Surgery · Inventory System
        </p>
      </div>
    </div>
  );
}
