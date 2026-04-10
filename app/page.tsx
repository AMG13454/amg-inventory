'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Package, AlertTriangle, XCircle, Clock, FileDown, ArrowRight, LayoutDashboard, Mail, ClipboardCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function Dashboard() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'out' | 'reorder' | 'expiring'>('all');
  const [role, setRole] = useState<'admin' | 'staff' | null>(null);
  const isAdmin = role === 'admin';

  useEffect(() => {
    fetchInventory();
    fetch('/api/auth/me', { cache: 'no-store' }).then(r => r.json()).then(d => setRole(d.role ?? null));
  }, []);

  async function fetchInventory() {
    const { data } = await supabase.from('supplies').select('*');
    if (data) setItems(data);
    setLoading(false);
  }

  // 1. Safe Filter: Hides archived items. 
  const activeItems = items.filter(item => {
    if (item.is_archived === true || item.is_archived === 'true') return false;
    return true; 
  });

  // 2. Safe Date Checker (Flags anything within 60 days)
  const isExpiringSoon = (dateString: string) => {
    if (!dateString) return false;
    try {
      const expDate = new Date(dateString);
      const today = new Date();
      const diffTime = expDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 60 && diffDays > 0; 
    } catch {
      return false;
    }
  };

  const getStatusText = (item: any) => {
    if (item.expired === 'true' || item.expired === true || item.expired === 'yes') return 'EXPIRED';
    const qty = parseInt(item.quantity) || 0;
    const threshold = parseInt(item.reorder_level) || 0;
    
    if (qty === 0) return 'OUT OF STOCK';
    if (qty <= threshold) return 'REORDER';
    return 'ACTIVE';
  };

  // 3. Stats for the Top Buttons
  const stats = useMemo(() => {
    let out = 0;
    let reorder = 0;
    let expiring = 0;

    activeItems.forEach(item => {
      const qty = parseInt(item.quantity) || 0;
      const threshold = parseInt(item.reorder_level) || 0;
      
      if (qty === 0) out++;
      else if (qty <= threshold) reorder++;
      
      if (isExpiringSoon(item.expiration_date) || item.expired === 'true' || item.expired === true || item.expired === 'yes') expiring++;
    });

    return { total: activeItems.length, out, reorder, expiring };
  }, [activeItems]);

  // 4. Filters the Table Below based on which box you click
  const filteredItems = useMemo(() => {
    return activeItems.filter(item => {
      const qty = parseInt(item.quantity) || 0;
      const threshold = parseInt(item.reorder_level) || 0;
      
      if (activeFilter === 'out') return qty === 0;
      if (activeFilter === 'reorder') return qty > 0 && qty <= threshold;
      if (activeFilter === 'expiring') return isExpiringSoon(item.expiration_date) || item.expired === 'true' || item.expired === true || item.expired === 'yes';
      return true;
    });
  }, [activeItems, activeFilter]);

  const filterNames = {
    all: 'FULL INVENTORY',
    out: 'OUT OF STOCK',
    reorder: 'NEEDS REORDER',
    expiring: 'EXPIRING SOON'
  };

  // 5. Generate Professional PDF (Updated with Manufacturer, Removed Status)
  const generatePDF = () => {
    const doc = new jsPDF();
    const reportName = filterNames[activeFilter];
    
    doc.setFontSize(26);
    doc.setTextColor(79, 70, 229); 
    doc.setFont("helvetica", "bold");
    doc.text("AMG PLASTIC SURGERY CLINIC", 14, 22);
    
    doc.setFontSize(16);
    if (activeFilter === 'out') doc.setTextColor(225, 29, 72);
    else if (activeFilter === 'reorder') doc.setTextColor(245, 158, 11);
    else if (activeFilter === 'expiring') doc.setTextColor(8, 145, 178);
    else doc.setTextColor(30, 41, 59);
    
    doc.text(`REPORT: ${reportName}`, 14, 32);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 40);

    // CHANGED: Added Manufacturer, removed Status
    const tableColumn = ["Manufacturer", "Item Name", "Category", "Location", "REF/SKU", "QTY"];
    const tableRows: any[] = [];

    filteredItems.forEach(item => {
      tableRows.push([
        item.manufacturer || '---',
        item.name || 'N/A',
        item.category || '---',
        item.location || '---',
        item.ref_sku || '---',
        item.quantity || '0'
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 46,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`AMG_Report_${activeFilter}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // 6. Generate Lean Purchasing Email (Updated with clear Manufacturer tag)
  const generateEmail = () => {
    const reportName = filterNames[activeFilter];
    const subject = encodeURIComponent(`AMG Inventory Report: ${reportName}`);
    let body = `Hello,\n\nPlease review the current ${reportName} items below:\n\n`;

    if (filteredItems.length === 0) {
      body += "No items currently match this filter.\n";
    } else {
      filteredItems.forEach(item => {
        const mfg = item.manufacturer ? item.manufacturer.toUpperCase() : 'UNKNOWN BRAND';
        body += `• Mfg: ${mfg} | Item: ${item.name} | REF: ${item.ref_sku || '---'} | QTY: ${item.quantity || 0}\n`;
      });
    }

    body += `\nThank you,\nAMG Clinic Management`;
    window.location.href = `mailto:?subject=${subject}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 p-4 md:p-8 font-sans">
      
      {/* Top Navigation / Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/20 p-3 rounded-2xl border border-indigo-500/30">
            <LayoutDashboard className="text-indigo-400" size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white leading-tight">Clinic Dashboard</h1>
            <p className="text-slate-400 text-sm font-medium">AMG Inventory Management</p>
          </div>
        </div>
        
        {/* Action Buttons */}
<Link href="/audit" className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-emerald-600/10 border border-emerald-500/50 hover:bg-emerald-600 px-5 py-3 rounded-xl font-bold text-emerald-400 hover:text-white transition cursor-pointer no-underline">
  <ClipboardCheck size={18} /> Run Audit
</Link>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {isAdmin && (
            <button onClick={generateEmail} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#1e293b] hover:bg-slate-800 border border-slate-700 px-5 py-3 rounded-xl font-bold text-slate-300 hover:text-white transition cursor-pointer">
              <Mail size={18} className="text-emerald-400"/> Email List
            </button>
          )}
          {isAdmin && (
            <button onClick={generatePDF} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-[#1e293b] hover:bg-slate-800 border border-slate-700 px-5 py-3 rounded-xl font-bold text-slate-300 hover:text-white transition cursor-pointer">
              <FileDown size={18} className="text-indigo-400"/> Export PDF
            </button>
          )}
          <Link href="/inventory" className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-6 py-3 rounded-xl font-bold text-white transition shadow-lg shadow-indigo-900/20 no-underline">
            Full Inventory <ArrowRight size={18} />
          </Link>
        </div>
      </div>

      {/* STAT TOGGLES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <div onClick={() => setActiveFilter('all')} className={`p-6 rounded-3xl border cursor-pointer transition group relative overflow-hidden ${activeFilter === 'all' ? 'bg-indigo-600 border-indigo-500 shadow-xl shadow-indigo-900/30' : 'bg-[#1e293b] border-slate-800 hover:border-slate-600'}`}>
          <Package className={`mb-4 ${activeFilter === 'all' ? 'text-white' : 'text-indigo-400 group-hover:scale-110 transition'}`} size={32} />
          <h3 className={`text-3xl font-black mb-1 ${activeFilter === 'all' ? 'text-white' : 'text-slate-200'}`}>{stats.total}</h3>
          <p className={`text-sm font-bold uppercase tracking-wider ${activeFilter === 'all' ? 'text-indigo-200' : 'text-slate-500'}`}>Total Items</p>
        </div>
        <div onClick={() => setActiveFilter('reorder')} className={`p-6 rounded-3xl border cursor-pointer transition group relative overflow-hidden ${activeFilter === 'reorder' ? 'bg-amber-500 border-amber-400 shadow-xl shadow-amber-900/30' : 'bg-[#1e293b] border-slate-800 hover:border-slate-600'}`}>
          <AlertTriangle className={`mb-4 ${activeFilter === 'reorder' ? 'text-white' : 'text-amber-400 group-hover:scale-110 transition'}`} size={32} />
          <h3 className={`text-3xl font-black mb-1 ${activeFilter === 'reorder' ? 'text-white' : 'text-slate-200'}`}>{stats.reorder}</h3>
          <p className={`text-sm font-bold uppercase tracking-wider ${activeFilter === 'reorder' ? 'text-amber-100' : 'text-slate-500'}`}>Needs Reorder</p>
        </div>
        <div onClick={() => setActiveFilter('out')} className={`p-6 rounded-3xl border cursor-pointer transition group relative overflow-hidden ${activeFilter === 'out' ? 'bg-rose-500 border-rose-400 shadow-xl shadow-rose-900/30' : 'bg-[#1e293b] border-slate-800 hover:border-slate-600'}`}>
          <XCircle className={`mb-4 ${activeFilter === 'out' ? 'text-white' : 'text-rose-400 group-hover:scale-110 transition'}`} size={32} />
          <h3 className={`text-3xl font-black mb-1 ${activeFilter === 'out' ? 'text-white' : 'text-slate-200'}`}>{stats.out}</h3>
          <p className={`text-sm font-bold uppercase tracking-wider ${activeFilter === 'out' ? 'text-rose-100' : 'text-slate-500'}`}>Out of Stock</p>
        </div>
        <div onClick={() => setActiveFilter('expiring')} className={`p-6 rounded-3xl border cursor-pointer transition group relative overflow-hidden ${activeFilter === 'expiring' ? 'bg-cyan-600 border-cyan-500 shadow-xl shadow-cyan-900/30' : 'bg-[#1e293b] border-slate-800 hover:border-slate-600'}`}>
          <Clock className={`mb-4 ${activeFilter === 'expiring' ? 'text-white' : 'text-cyan-400 group-hover:scale-110 transition'}`} size={32} />
          <h3 className={`text-3xl font-black mb-1 ${activeFilter === 'expiring' ? 'text-white' : 'text-slate-200'}`}>{stats.expiring}</h3>
          <p className={`text-sm font-bold uppercase tracking-wider ${activeFilter === 'expiring' ? 'text-cyan-100' : 'text-slate-500'}`}>Expiring / Expired</p>
        </div>
      </div>

      {/* QUICK VIEW TABLE */}
      <div className="bg-[#1e293b] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            {activeFilter === 'all' && <span className="w-2 h-2 rounded-full bg-indigo-500"></span>}
            {activeFilter === 'reorder' && <span className="w-2 h-2 rounded-full bg-amber-500"></span>}
            {activeFilter === 'out' && <span className="w-2 h-2 rounded-full bg-rose-500"></span>}
            {activeFilter === 'expiring' && <span className="w-2 h-2 rounded-full bg-cyan-500"></span>}
            Showing {filterNames[activeFilter]}
          </h2>
          <span className="text-sm font-bold text-slate-500 bg-slate-800 px-3 py-1 rounded-lg">{filteredItems.length} Results</span>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-800/50 text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black">
                <th className="p-5">Item Name</th>
                <th className="p-5">Category</th>
                <th className="p-5">Location</th>
                <th className="p-5 text-center">QTY</th>
                <th className="p-5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr><td colSpan={5} className="p-10 text-center text-slate-500 italic animate-pulse">Syncing Database...</td></tr>
              ) : filteredItems.length === 0 ? (
                <tr><td colSpan={5} className="p-10 text-center text-slate-500 font-bold">No items match this filter.</td></tr>
              ) : filteredItems.slice(0, 50).map((item: any) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition group">
                  <td className="p-5">
                    <div className="font-bold text-white text-base">{item.name}</div>
                    <div className="text-[10px] mt-1 text-slate-500 font-mono">REF: {item.ref_sku || '---'}</div>
                  </td>
                  <td className="p-5 text-sm text-slate-300">{item.category || '---'}</td>
                  <td className="p-5 text-sm text-slate-400">{item.location || '---'}</td>
                  <td className="p-5 text-center">
                    <span className="font-mono font-bold text-lg text-white bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">{item.quantity || '0'}</span>
                  </td>
                  <td className="p-5">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                      item.expired === 'true' || item.expired === true || item.expired === 'yes' || parseInt(item.quantity || '0') === 0 ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : parseInt(item.quantity || '0') <= parseInt(item.reorder_level || '0') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    }`}>{getStatusText(item)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredItems.length > 50 && (
            <div className="p-4 text-center border-t border-slate-800 bg-slate-900/30">
              <Link href="/inventory" className="text-sm font-bold text-indigo-400 hover:text-indigo-300 no-underline">
                View remaining {filteredItems.length - 50} items in Full Inventory...
              </Link>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}