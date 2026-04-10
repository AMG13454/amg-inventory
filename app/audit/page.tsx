'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, ClipboardCheck, Save, AlertCircle, CheckCircle2, FileDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// --- YOUR OFFICIAL CLINIC LOCATIONS ---
const APPROVED_LOCATIONS = [
  "Procedure room 1",
  "Procedure room 2",
  "Kitchen",
  "Front Office",
  "Instrument Processing Room",
  "Storage room",
  "Storage Closet"
];

export default function AuditPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  
  const [auditCounts, setAuditCounts] = useState<{ [key: number]: number }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    fetchInventory();
  }, []);

  async function fetchInventory() {
    const { data } = await supabase.from('supplies').select('*');
    if (data) setItems(data.filter(item => item.is_archived !== true && item.is_archived !== 'true'));
    setLoading(false);
  }

  const activeItems = useMemo(() => {
    if (!selectedLocation) return [];
    return items.filter(item => item.location === selectedLocation).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, selectedLocation]);

  const handleCountChange = (id: number, val: string) => {
    const num = parseInt(val);
    setAuditCounts(prev => ({
      ...prev,
      [id]: isNaN(num) ? 0 : num
    }));
  };

  const handleSyncAudit = async () => {
    setIsSaving(true);
    
    // 1. Find all items with a discrepancy
    const updatesToMake = activeItems.filter(item => {
      const actual = auditCounts[item.id];
      const expected = parseInt(item.quantity || '0');
      return actual !== undefined && actual !== expected;
    });

    if (updatesToMake.length === 0) {
      setIsSaving(false);
      triggerSuccess();
      return;
    }

    // 2. Format the logs for our new Discrepancy Table
    const logsToInsert = updatesToMake.map(item => {
      const expected = parseInt(item.quantity || '0');
      const actual = auditCounts[item.id];
      return {
        item_id: item.id,
        item_name: item.name,
        category: item.category || 'Uncategorized',
        location: selectedLocation,
        expected_qty: expected,
        actual_qty: actual,
        discrepancy: actual - expected // Negative means missing, positive means extra
      };
    });

    // 3. Update the main inventory quantities
    const quantityPromises = updatesToMake.map(item => 
      supabase.from('supplies').update({ quantity: auditCounts[item.id].toString() }).eq('id', item.id)
    );

    await Promise.all(quantityPromises);
    
    // 4. Push the logs to the discrepancy ledger
    await supabase.from('audit_logs').insert(logsToInsert);

    // Refresh everything
    await fetchInventory();
    setAuditCounts({});
    setIsSaving(false);
    triggerSuccess();
  };

  function triggerSuccess() {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  }

  // Generate the Discrepancy PDF
  const downloadDiscrepancyReport = async () => {
    setIsGeneratingReport(true);
    
    // Fetch all logs from the database, newest first
    const { data: logs, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
    
    if (error || !logs || logs.length === 0) {
      alert("No discrepancies have been recorded yet!");
      setIsGeneratingReport(false);
      return;
    }

    const doc = new jsPDF();
    
    doc.setFontSize(26);
    doc.setTextColor(225, 29, 72); // Rose color for urgency
    doc.setFont("helvetica", "bold");
    doc.text("AMG CLINIC", 14, 22);
    
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text(`REPORT: Missing / Discrepancy Log`, 14, 32);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 40);

    const tableColumn = ["Date", "Item Name", "Location", "Expected", "Actual", "Variance"];
    const tableRows: any[] = [];

    logs.forEach(log => {
      const dateStr = new Date(log.created_at).toLocaleDateString();
      // Add a plus sign if they found extra stock, otherwise it naturally shows the minus sign
      const varianceText = log.discrepancy > 0 ? `+${log.discrepancy}` : `${log.discrepancy}`;
      
      tableRows.push([
        dateStr,
        log.item_name,
        log.location,
        log.expected_qty,
        log.actual_qty,
        varianceText
      ]);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 46,
      theme: 'grid',
      headStyles: { fillColor: [225, 29, 72], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        5: { fontStyle: 'bold', textColor: [225, 29, 72] } // Highlight the variance column
      },
      didParseCell: function(data) {
        // If it's a positive variance (found extra), make it green instead of red
        if (data.section === 'body' && data.column.index === 5) {
           const val = data.cell.raw as string;
           if (val.includes('+')) {
             data.cell.styles.textColor = [16, 185, 129]; // Emerald green
           }
        }
      }
    });

    doc.save(`AMG_Discrepancy_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    setIsGeneratingReport(false);
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 p-4 md:p-8 font-sans">
      
      {showSuccess && (
        <div className="fixed top-8 right-8 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[100] animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 size={20} /> <span className="font-bold text-sm">Audit Synced Successfully!</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="bg-[#1e293b] hover:bg-slate-800 p-3 rounded-2xl border border-slate-800 transition cursor-pointer text-slate-400 hover:text-white">
            <ArrowLeft size={24} />
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              <ClipboardCheck className="text-emerald-400" size={32}/> Cycle Count Audit
            </h1>
            <p className="text-slate-400 text-sm font-medium">Verify physical stock against the database.</p>
          </div>
        </div>
        
        {/* NEW: Discrepancy Report Button */}
        <button 
          onClick={downloadDiscrepancyReport} 
          disabled={isGeneratingReport}
          className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/50 hover:bg-rose-500 hover:text-white text-rose-400 px-5 py-3 rounded-xl font-bold transition cursor-pointer disabled:opacity-50"
        >
          <FileDown size={18} /> {isGeneratingReport ? 'Generating...' : 'Discrepancy Report'}
        </button>
      </div>

      {/* Step 1: Choose Location */}
      <div className="bg-[#1e293b] p-6 rounded-3xl border border-slate-800 shadow-xl mb-8">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 block">Step 1: Select Area to Audit</label>
        <select 
          className="w-full md:w-1/3 bg-[#0f172a] border border-slate-700 rounded-xl p-4 text-white focus:border-emerald-500 outline-none text-lg font-bold cursor-pointer"
          value={selectedLocation}
          onChange={(e) => {
            setSelectedLocation(e.target.value);
            setAuditCounts({}); 
          }}
        >
          <option value="">-- Choose Location --</option>
          {APPROVED_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
        </select>
      </div>

      {/* Step 2: The Audit Table */}
      {selectedLocation && (
        <div className="bg-[#1e293b] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
          <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Auditing: <span className="text-emerald-400">{selectedLocation}</span>
            </h2>
            <span className="text-sm font-bold text-slate-500 bg-slate-800 px-3 py-1 rounded-lg">{activeItems.length} Items Found</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800/50 text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black">
                  <th className="p-5">Item Details</th>
                  <th className="p-5 text-center w-32">Expected QTY</th>
                  <th className="p-5 text-center w-40 text-emerald-400">Actual Count</th>
                  <th className="p-5 text-right pr-8">Discrepancy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {activeItems.map((item) => {
                  const expected = parseInt(item.quantity || '0');
                  const actual = auditCounts[item.id] !== undefined ? auditCounts[item.id] : expected;
                  const diff = actual - expected;

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition group">
                      <td className="p-5">
                        <div className="font-bold text-white text-lg">{item.name}</div>
                        <div className="text-[10px] mt-1 text-slate-500 font-mono">REF: {item.ref_sku || '---'} | {item.category}</div>
                      </td>
                      
                      <td className="p-5 text-center">
                        <span className="font-mono text-xl text-slate-400">{expected}</span>
                      </td>
                      
                      <td className="p-5 text-center">
                        <input 
                          type="number" 
                          min="0"
                          value={auditCounts[item.id] !== undefined ? auditCounts[item.id] : ''}
                          placeholder={expected.toString()}
                          onChange={(e) => handleCountChange(item.id, e.target.value)}
                          className="w-24 bg-[#0f172a] border-2 border-slate-700 focus:border-emerald-500 rounded-xl p-3 text-center text-white font-mono font-bold text-xl outline-none transition"
                        />
                      </td>

                      <td className="p-5 text-right pr-8">
                        {diff === 0 ? (
                          <span className="inline-flex items-center gap-1 text-slate-500 font-bold text-sm bg-slate-800 px-3 py-1 rounded-lg">
                            <CheckCircle2 size={16}/> Match
                          </span>
                        ) : diff > 0 ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-sm bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                            +{diff} Found
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 font-bold text-sm bg-rose-500/10 px-3 py-1 rounded-lg border border-rose-500/20">
                            <AlertCircle size={16}/> {diff} Missing
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Sync Bar */}
          <div className="p-6 bg-slate-900 border-t border-slate-800 flex justify-end">
            <button 
              onClick={handleSyncAudit}
              disabled={isSaving}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-8 py-4 rounded-2xl font-bold text-white transition shadow-lg shadow-emerald-900/20 border-none cursor-pointer flex items-center gap-3 text-lg"
            >
              {isSaving ? 'Syncing Database...' : <><Save /> Sync {selectedLocation} Audit</>}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}