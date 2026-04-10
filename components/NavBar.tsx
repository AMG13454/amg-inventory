'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export default function NavBar() {
  const [role, setRole] = useState<'admin' | 'staff' | null>(null);
  const pathname = usePathname();

  // If middleware let the user onto a protected page, they are authenticated.
  const isProtectedPage = pathname === '/' || pathname.startsWith('/inventory');
  const isAdmin = role === 'admin';

  useEffect(() => {
    fetch(`/api/auth/me?t=${Date.now()}`, { cache: 'no-store', credentials: 'include' })
      .then(r => r.json())
      .then(d => setRole(d.role ?? null))
      .catch(() => setRole(null));
  }, [pathname]);

  return (
    <nav className="bg-slate-900 text-white px-4 sm:px-6 h-14 flex items-center gap-4 shadow-lg sticky top-0 z-50 border-b border-slate-800">
      {/* Brand */}
      <div className="flex items-center gap-2.5 mr-2">
        <Image src="/logo.png" alt="AMG" width={32} height={32} className="object-contain rounded-md shrink-0" />
        <span className="font-semibold tracking-tight text-sm text-white hidden sm:inline">
          AMG Inventory
        </span>
      </div>

      {/* Nav links — show once role is known */}
      <div className="flex items-center gap-1 flex-1">
        {isProtectedPage && (
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

      {/* Role badge + Logout — always visible on protected pages */}
      {isProtectedPage && (
        <div className="flex items-center gap-3">
          {/* Role badge only shows once we know the role */}
          {role && (
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${
              isAdmin
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {isAdmin ? 'Manager' : 'Staff'}
            </span>
          )}

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
