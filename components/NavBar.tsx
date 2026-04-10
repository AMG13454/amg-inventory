'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function NavBar() {
  const [role, setRole] = useState<'admin' | 'staff' | null>(null);

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => setRole(d.role ?? null))
      .catch(() => setRole(null));
  }, []);

  const isAdmin = role === 'admin';

  return (
    <nav className="bg-slate-900 text-white px-4 sm:px-6 h-14 flex items-center gap-4 shadow-lg sticky top-0 z-50 border-b border-slate-800">
      {/* Brand */}
      <div className="flex items-center gap-2.5 mr-2">
        <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0 shadow-sm">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <span className="font-semibold tracking-tight text-sm text-white hidden sm:inline">
          AMG Inventory
        </span>
      </div>

      {/* Nav links */}
      <div className="flex items-center gap-1 flex-1">
        {role && (
          <>
            <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-slate-800">
              Dashboard
            </Link>
            <Link href="/inventory" className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-md hover:bg-slate-800">
              Inventory
            </Link>
          </>
        )}
      </div>

      {/* Role badge + Logout */}
      {role && (
        <div className="flex items-center gap-3">
          <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
            isAdmin
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
          }`}>
            {isAdmin ? 'Manager' : 'Staff'}
          </span>

          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-xs text-slate-500 hover:text-white transition-colors px-2.5 py-1.5 rounded-md hover:bg-slate-800 border border-slate-700 hover:border-slate-600 cursor-pointer bg-transparent"
            >
              Log out
            </button>
          </form>
        </div>
      )}
    </nav>
  );
}
