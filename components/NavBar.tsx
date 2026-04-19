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
    <nav className="bg-slate-900 text-white px-4 sm:px-7 h-[70px] flex items-center gap-7 shadow-lg sticky top-0 z-50 border-b border-slate-800">
      {/* Brand */}
      <div className="flex items-center gap-4 mr-5">
        <div className="bg-slate-100 rounded-[8px] p-1.5 border border-slate-200/80">
          <Image src="/logo.png" alt="AMG" width={52} height={52} className="object-contain rounded-[5px] shrink-0" />
        </div>
        <span className="font-extrabold tracking-tight text-2xl text-white hidden sm:inline">
          AMG Inventory
        </span>
      </div>

      {/* Nav links — show once role is known */}
      <div className="flex items-center gap-4 flex-1">
        {isProtectedPage && (
          <>
            <Link href="/" className="text-base font-extrabold text-white transition px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-900/30 no-underline">
              Dashboard
            </Link>
            <Link href="/inventory" className="text-base font-extrabold text-white transition px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 shadow-md shadow-emerald-900/30 no-underline">
              Inventory
            </Link>
          </>
        )}
      </div>

      {/* Role badge + Logout — always visible on protected pages */}
      {isProtectedPage && (
        <div className="flex items-center gap-4.5">
          {/* Role badge only shows once we know the role */}
          {role && (
            <span className={`text-xs font-extrabold uppercase tracking-widest px-3 py-1.5 rounded-full ${
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
              className="text-sm font-semibold text-slate-300 hover:text-white transition-colors px-3.5 py-2 rounded-lg hover:bg-slate-800 border border-slate-700 hover:border-slate-600 cursor-pointer bg-transparent"
            >
              Log out
            </button>
          </form>
        </div>
      )}
    </nav>
  );
}
