'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Search, Plus, Edit2, Save, X, Minus, CheckCircle2, ChevronUp, ChevronDown, Folder, List, CheckSquare, Archive, Trash2, Barcode } from 'lucide-react';
import { supabase } from '@/lib/supabase'; 

const APPROVED_LOCATIONS = [
  "Procedure room 1",
  "Procedure room 2",
  "Kitchen",
  "Front Office",
  "Instrument Processing Room",
  "Storage room",
  "Storage Closet"
];

export default function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });
  const [showArchived, setShowArchived] = useState(false); 
  
  const [viewMode, setViewMode] = useState<'table' | 'folders'>('table');
  const [activeFolder, setActiveFolder] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkLocation, setBulkLocation] = useState('');
  const [bulkCategory, setBulkCategory] = useState('');
  const [role, setRole] = useState<'admin' | 'staff' | null>(null);
  const isAdmin = role === 'admin';

  const categoryStyles = [
    { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
    { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
    { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
    { text: 'text-fuchsia-400', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/20' },
    { text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' }
  ];

  useEffect(() => {
    fetchInventory();
    fetch('/api/auth/me', { cache: 'no-store' }).then(r => r.json()).then(d => setRole(d.role ?? null));
  }, []);

  async function fetchInventory() {
    const { data } = await supabase.from('supplies').select('*');
    if (data) setItems(data);
    setLoading(false);
  }

  const categories = useMemo(() => {
    const dbCats = Array.from(new Set(items.map(i => i.category || 'Uncategorized')));
    return dbCats.filter((cat: any) => cat.toLowerCase() !== 'medical').sort();
  }, [items]);

  const getStatusText = (item: any) => {
    if (item.is_archived) return 'ARCHIVED';
    if (item.expired === 'true' || item.expired === true || item.expired === 'yes') return 'EXPIRED';
    if (parseInt(item.quantity || '0') === 0) return 'OUT OF STOCK';
    if (parseInt(item.quantity || '0') <= parseInt(item.reorder_level || '0')) return 'REORDER';
    return 'ACTIVE';
  };

  const capitalizeWords = (str: string) => {
    if (!str) return '';
    return str.replace(/\b\w/g, char => char.toUpperCase());
  };

  const capitalizeFirstLetter = (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const sortedItems = useMemo(() => {
    let sortableItems = [...items];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        let aValue = sortConfig.key === 'status' ? getStatusText(a) : (a[sortConfig.key] || '');
        let bValue = sortConfig.key === 'status' ? getStatusText(b) : (b[sortConfig.key] || '');
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [items, sortConfig]);

  const requestSort = (key: string) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const filteredItems = sortedItems.filter((item: any) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = item.name?.toLowerCase().includes(search) || 
                          item.manufacturer?.toLowerCase().includes(search) || 
                          item.ref_sku?.toLowerCase().includes(search) ||
                          item.barcode?.toLowerCase().includes(search) ||
                          item.category?.toLowerCase().includes(search);
    const matchesFolder = viewMode === 'folders' && activeFolder ? (item.category || 'Uncategorized') === activeFolder : true;
    const isArchived = item.is_archived === true || item.is_archived === 'true';
    const matchesArchive = showArchived ? isArchived : !isArchived;

    return matchesSearch && matchesFolder && matchesArchive;
  });

  const toggleAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) setSelectedIds(new Set(filteredItems.map((i: any) => i.id)));
    else setSelectedIds(new Set());
  };

  const toggleSelection = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  async function handleBulkSave() {
    const updates: any = {};
    if (bulkCategory) updates.category = bulkCategory;
    if (bulkLocation) updates.location = bulkLocation;
    const idsArray = Array.from(selectedIds);
    const { error } = await supabase.from('supplies').update(updates).in('id', idsArray);
    if (!error) {
      setItems(items.map(item => selectedIds.has(item.id) ? { ...item, ...updates } : item));
      setSelectedIds(new Set());
      setBulkCategory('');
      setBulkLocation('');
      triggerSuccess();
    }
  }

  async function updateQty(id: number, newQty: number) {
    const { error } = await supabase.from('supplies').update({ quantity: newQty.toString() }).eq('id', id);
    if (!error) setItems(items.map(item => item.id === id ? { ...item, quantity: newQty.toString() } : item));
  }

  async function handleFullSave(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const updates = {
      name: capitalizeFirstLetter(formData.get('name') as string),
      category: formData.get('category') || 'Uncategorized',
      manufacturer: capitalizeWords(formData.get('manufacturer') as string), 
      ref_sku: formData.get('ref_sku'),
      barcode: formData.get('barcode'),
      location: formData.get('location'),
      expiration_date: formData.get('expiration_date'),
      reorder_level: formData.get('reorder_level'),
    };

    const { error } = await supabase.from('supplies').update(updates).eq('id', editingItem.id);
    if (!error) {
      setItems(items.map(item => item.id === editingItem.id ? { ...item, ...updates } : item));
      setEditingItem(null);
      triggerSuccess();
    }
  }

  async function handleAddNew(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const newItem = {
      name: capitalizeFirstLetter(formData.get('name') as string), 
      category: formData.get('category') || 'Uncategorized',
      quantity: formData.get('quantity') || '0',
      reorder_level: formData.get('reorder_level') || '0',
      manufacturer: capitalizeWords(formData.get('manufacturer') as string),
      ref_sku: formData.get('ref_sku'),
      barcode: formData.get('barcode'),
      location: formData.get('location'),
      expiration_date: formData.get('expiration_date'),
      is_archived: false 
    };

    const { data, error } = await supabase.from('supplies').insert([newItem]).select();
    if (!error && data) {
      setItems([...items, data[0]]);
      setIsAddingNew(false);
      triggerSuccess();
    }
  }

  async function handleArchiveToggle() {
    if (!editingItem) return;
    const isArchiving = !editingItem.is_archived;
    if (isArchiving && !window.confirm(`Are you sure you want to archive ${editingItem.name}?`)) return;
    const { error } = await supabase.from('supplies').update({ is_archived: isArchiving }).eq('id', editingItem.id);
    if (!error) {
      setItems(items.map(item => item.id === editingItem.id ? { ...item, is_archived: isArchiving } : item));
      setEditingItem(null);
      triggerSuccess();
    }
  }

  async function handlePermanentDelete() {
    if (!editingItem) return;
    if (!window.confirm(`PERMANENTLY DELETE ${editingItem.name}?`)) return;
    const { error } = await supabase.from('supplies').delete().eq('id', editingItem.id);
    if (!error) {
      setItems(items.filter(item => item.id !== editingItem.id));
      setEditingItem(null);
      triggerSuccess();
    }
  }

  function triggerSuccess() {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-50 p-4 md:p-8 relative">
      {showSuccess && (
        <div className="fixed top-8 right-8 bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[100]">
          <CheckCircle2 size={20} /> <span className="font-bold text-sm">AMG Database Updated!</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <Link href="/" className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 no-underline font-medium">
          <ArrowLeft size={20} /> Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Clinical Inventory</h1>
        
        <div className="flex items-center gap-4">
          <div className="flex bg-[#1e293b] p-1 rounded-xl border border-slate-800">
            <button onClick={() => { setViewMode('table'); setActiveFolder(null); }} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition border-none cursor-pointer ${viewMode === 'table' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300 bg-transparent'}`}>
              <List size={16}/> Table
            </button>
            <button onClick={() => setViewMode('folders')} className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition border-none cursor-pointer ${viewMode === 'folders' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300 bg-transparent'}`}>
              <Folder size={16}/> Folders
            </button>
          </div>
          <button onClick={() => setIsAddingNew(true)} className="bg-indigo-600 hover:bg-indigo-500 px-6 py-2 rounded-xl flex items-center gap-2 font-bold text-white border-none cursor-pointer">
            <Plus size={18} /> Add New Item
          </button>
        </div>
      </div>

      {/* Bulk Action Bar — admin only */}
      {isAdmin && selectedIds.size > 0 && (
        <div className="bg-indigo-900/40 border border-indigo-500/50 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between mb-8 shadow-lg shadow-indigo-900/20">
          <div className="flex items-center gap-3 mb-4 md:mb-0">
            <CheckSquare className="text-indigo-400" />
            <span className="font-bold text-indigo-100">{selectedIds.size} Items Selected</span>
          </div>
          <div className="flex items-center gap-4 w-full md:w-auto">
            <select className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-white focus:border-indigo-500 outline-none text-sm w-full md:w-auto" value={bulkCategory} onChange={(e) => setBulkCategory(e.target.value)}>
              <option value="">Move to Category...</option>
              {categories.map(cat => <option key={cat as string} value={cat as string}>{cat as string}</option>)}
            </select>
            <select className="bg-[#0f172a] border border-slate-700 rounded-lg p-2 text-white focus:border-indigo-500 outline-none text-sm w-full md:w-auto" value={bulkLocation} onChange={(e) => setBulkLocation(e.target.value)}>
              <option value="">Move to Location...</option>
              {APPROVED_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>
            <button onClick={handleBulkSave} disabled={!bulkCategory && !bulkLocation} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-bold text-white transition border-none cursor-pointer text-sm whitespace-nowrap">
              Apply Update
            </button>
            <button onClick={() => setSelectedIds(new Set())} className="text-slate-400 hover:text-white bg-transparent border-none cursor-pointer text-sm font-bold ml-2">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex flex-col md:flex-row items-center gap-4 mb-8">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input type="text" placeholder="Search name, manufacturer, REF, or barcode..." className="w-full bg-[#1e293b] border border-slate-800 rounded-2xl py-4 pl-12 pr-4 text-white outline-none focus:ring-2 focus:ring-indigo-500" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <label className={`flex items-center gap-3 cursor-pointer text-sm font-bold py-4 px-6 rounded-2xl border transition ${showArchived ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300' : 'bg-[#1e293b] border-slate-800 text-slate-400 hover:text-white'}`}>
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="w-5 h-5 accent-indigo-500 cursor-pointer" />
          <Archive size={18} /> View Archived
        </label>
      </div>

      {/* FOLDER VIEW GRID */}
      {viewMode === 'folders' && !activeFolder ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
          {categories.map((cat, index) => {
            const count = filteredItems.filter(i => (i.category || 'Uncategorized') === cat).length;
            if (count === 0) return null; 
            const style = categoryStyles[index % categoryStyles.length]; 
            return (
              <div key={cat as string} onClick={() => setActiveFolder(cat as string)} className="bg-[#1e293b] p-6 rounded-3xl border border-slate-800 hover:border-slate-600 cursor-pointer transition group shadow-xl">
                <Folder className={`${style.text} mb-4 group-hover:scale-110 transition`} size={32} />
                <h3 className="text-white font-bold text-lg leading-tight mb-1">{cat as string}</h3>
                <p className="text-slate-500 text-sm font-medium">{count} Items</p>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {viewMode === 'folders' && activeFolder && (
            <div className="mb-6 flex items-center gap-3">
              <button onClick={() => setActiveFolder(null)} className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition bg-transparent border-none cursor-pointer font-bold">
                <ArrowLeft size={18} /> Back to Folders
              </button>
              <span className="text-slate-600">/</span>
              <h2 className="text-xl font-bold text-white">{activeFolder}</h2>
            </div>
          )}

          {/* Main Table */}
          <div className="bg-[#1e293b] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800/50 text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black">
                    {isAdmin && (
                      <th className="p-5 w-12 text-center">
                        <input type="checkbox" onChange={toggleAll} checked={selectedIds.size === filteredItems.length && filteredItems.length > 0} className="w-4 h-4 accent-indigo-500 cursor-pointer rounded" />
                      </th>
                    )}
                    <th className="p-5 cursor-pointer hover:text-white transition" onClick={() => requestSort('name')}>
                      <div className="flex items-center gap-1">Item Name {sortConfig.key === 'name' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div>
                    </th>
                    <th className="p-5 cursor-pointer hover:text-white transition" onClick={() => requestSort('category')}>
                      <div className="flex items-center gap-1">Category {sortConfig.key === 'category' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div>
                    </th>
                    <th className="p-5 cursor-pointer hover:text-white transition" onClick={() => requestSort('location')}>
                      <div className="flex items-center gap-1">Location {sortConfig.key === 'location' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div>
                    </th>
                    <th className="p-5 text-center">Quantity</th>
                    <th className="p-5 cursor-pointer hover:text-white transition" onClick={() => requestSort('expiration_date')}>
                      <div className="flex items-center gap-1">Expires {sortConfig.key === 'expiration_date' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div>
                    </th>
                    <th className="p-5 cursor-pointer hover:text-white transition" onClick={() => requestSort('status')}>
                      <div className="flex items-center gap-1">Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? <ChevronUp size={14}/> : <ChevronDown size={14}/>)}</div>
                    </th>
                    {isAdmin && <th className="p-5 text-center">Edit</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {loading ? (
                    <tr><td colSpan={8} className="p-10 text-center text-slate-500 italic animate-pulse">Syncing Database...</td></tr>
                  ) : filteredItems.length === 0 ? (
                    <tr><td colSpan={8} className="p-10 text-center text-slate-500 font-bold">{showArchived ? 'No archived items found.' : 'No items match your search.'}</td></tr>
                  ) : filteredItems.map((item: any) => {
                    
                    const catIndex = categories.indexOf(item.category || 'Uncategorized');
                    const style = categoryStyles[catIndex >= 0 ? catIndex % categoryStyles.length : 0];

                    return (
                      <tr key={item.id} className={`hover:bg-slate-800/30 transition group ${selectedIds.has(item.id) ? 'bg-indigo-500/5' : ''} ${item.is_archived ? 'opacity-50' : ''}`}>
                        {isAdmin && (
                          <td className="p-5 text-center">
                            <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelection(item.id)} className="w-4 h-4 accent-indigo-500 cursor-pointer rounded" />
                          </td>
                        )}
                        <td className="p-5" onClick={() => isAdmin && setEditingItem(item)} style={{ cursor: isAdmin ? 'pointer' : 'default' }}>
                          <div className={`font-bold text-white text-lg transition ${isAdmin ? 'group-hover:text-indigo-300' : ''}`}>{item.name}</div>
                          <div className="text-[10px] mt-1 flex gap-2 items-center opacity-60">
                            <span className="text-indigo-400 font-bold uppercase">{item.manufacturer || 'Brand TBD'}</span>
                            <span className="text-slate-600">|</span>
                            <span className="font-mono">REF: {item.ref_sku || '---'}</span>
                            {item.barcode && (
                              <>
                                <span className="text-slate-600">|</span>
                                <span className="flex items-center gap-1 text-emerald-400 font-mono"><Barcode size={10}/> {item.barcode}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="p-5 text-sm" onClick={() => isAdmin && setEditingItem(item)} style={{ cursor: isAdmin ? 'pointer' : 'default' }}>
                          <span className={`px-3 py-1 rounded-lg border font-bold text-[10px] uppercase tracking-wider ${style.bg} ${style.text} ${style.border}`}>
                            {item.category || 'Uncategorized'}
                          </span>
                        </td>
                        <td className="p-5 text-slate-400 text-sm transition" onClick={() => isAdmin && setEditingItem(item)} style={{ cursor: isAdmin ? 'pointer' : 'default' }}>{item.location || '---'}</td>
                        <td className="p-5 text-center">
                          <div className="flex items-center justify-center gap-4 bg-[#0f172a] w-fit mx-auto px-3 py-1 rounded-xl border border-slate-800 shadow-inner">
                            <button onClick={() => updateQty(item.id, parseInt(item.quantity || '0') - 1)} className="text-slate-500 hover:text-rose-400 cursor-pointer bg-transparent border-none p-1" disabled={item.is_archived}><Minus size={16}/></button>
                            <span className="font-mono font-bold text-lg min-w-[2ch]">{item.quantity || '0'}</span>
                            <button onClick={() => updateQty(item.id, parseInt(item.quantity || '0') + 1)} className="text-slate-500 hover:text-emerald-400 cursor-pointer bg-transparent border-none p-1" disabled={item.is_archived}><Plus size={16}/></button>
                          </div>
                        </td>
                        <td className="p-5 text-sm text-slate-300 transition" onClick={() => isAdmin && setEditingItem(item)} style={{ cursor: isAdmin ? 'pointer' : 'default' }}>{item.expiration_date || '---'}</td>
                        <td className="p-5">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                            item.is_archived ? 'bg-slate-700/50 text-slate-400 border border-slate-600' :
                            item.expired === 'true' || item.expired === true || item.expired === 'yes' || parseInt(item.quantity || '0') === 0 ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : parseInt(item.quantity || '0') <= parseInt(item.reorder_level || '0') ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          }`}>{getStatusText(item)}</span>
                        </td>
                        {isAdmin && (
                          <td className="p-5 text-center">
                            <button onClick={() => setEditingItem(item)} className="p-2 hover:bg-indigo-500/20 rounded-lg text-indigo-400 transition cursor-pointer bg-transparent border-none"><Edit2 size={18} /></button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Edit Modal (Everything is back!) */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleFullSave} className="bg-[#1e293b] w-full max-w-md rounded-3xl p-8 border border-slate-700 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 text-white">
              <h2 className="text-xl font-bold tracking-tight">Edit Item</h2>
              <button type="button" onClick={() => setEditingItem(null)} className="text-slate-500 hover:text-white bg-transparent border-none cursor-pointer"><X /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Item Name</label>
                <input name="name" type="text" className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-white outline-none" defaultValue={editingItem.name} required disabled={editingItem.is_archived}/>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Category</label>
                  <select name="category" className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-white outline-none appearance-none" defaultValue={editingItem.category} disabled={editingItem.is_archived}>
                    {categories.map(cat => <option key={cat as string} value={cat as string}>{cat as string}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Location</label>
                  <select name="location" className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-white outline-none appearance-none" defaultValue={editingItem.location} disabled={editingItem.is_archived}>
                    {APPROVED_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Manufacturer</label>
                  <input name="manufacturer" type="text" className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 outline-none" defaultValue={editingItem.manufacturer} disabled={editingItem.is_archived}/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">REF / SKU</label>
                  <input name="ref_sku" type="text" className="w-full bg-[#0f172a] border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none" defaultValue={editingItem.ref_sku} disabled={editingItem.is_archived}/>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block text-indigo-400 flex items-center gap-1"><Barcode size={12}/> Barcode / UPC (Scan on iPad Keyboard)</label>
                <input name="barcode" type="text" placeholder="Tap and scan barcode..." className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 outline-none" defaultValue={editingItem.barcode} disabled={editingItem.is_archived}/>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Reorder Level</label>
                  <input name="reorder_level" type="number" className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-white outline-none" defaultValue={editingItem.reorder_level} disabled={editingItem.is_archived}/>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Expiration Date</label>
                  <input name="expiration_date" type="date" className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-white outline-none" defaultValue={editingItem.expiration_date} disabled={editingItem.is_archived}/>
                </div>
              </div>

              <div className="flex flex-col gap-3 mt-6">
                {!editingItem.is_archived && (
                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition text-white shadow-lg border-none cursor-pointer group">
                    <Save size={18} className="group-hover:scale-110 transition" /> Save Changes
                  </button>
                )}
                
                <div className="flex gap-3">
                  <button type="button" onClick={handleArchiveToggle} className={`flex-1 bg-transparent border py-3 rounded-xl font-bold transition cursor-pointer flex justify-center items-center gap-2 ${editingItem.is_archived ? 'border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10' : 'border-rose-500/50 text-rose-400 hover:bg-rose-500/10'}`}>
                    <Archive size={16} /> {editingItem.is_archived ? 'Restore' : 'Archive Item'}
                  </button>
                  
                  {editingItem.is_archived && (
                    <button type="button" onClick={handlePermanentDelete} className="flex-1 bg-rose-600/10 border border-rose-500/50 text-rose-500 hover:bg-rose-600 hover:text-white py-3 rounded-xl font-bold transition cursor-pointer flex justify-center items-center gap-2">
                      <Trash2 size={16} /> Delete Permanently
                    </button>
                  )}
                </div>
              </div>

            </div>
          </form>
        </div>
      )}

      {/* Add Modal (Everything is back!) */}
      {isAddingNew && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleAddNew} className="bg-[#1e293b] w-full max-w-md rounded-3xl p-8 border border-indigo-500 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-center mb-6 text-white">
              <h2 className="text-xl font-bold tracking-tight">Add New Item</h2>
              <button type="button" onClick={() => setIsAddingNew(false)} className="text-slate-500 hover:text-white bg-transparent border-none cursor-pointer"><X /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Item Name</label>
                <input name="name" type="text" placeholder="e.g. botox 100u" className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-white outline-none" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Category</label>
                  <select name="category" className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-white outline-none appearance-none">
                    {categories.map(cat => <option key={cat as string} value={cat as string}>{cat as string}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Location</label>
                  <select name="location" className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-white outline-none appearance-none">
                    {APPROVED_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Manufacturer</label>
                  <input name="manufacturer" type="text" placeholder="e.g. allergan" className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">REF / SKU</label>
                  <input name="ref_sku" type="text" placeholder="REF-XXX" className="w-full bg-[#0f172a] border border-slate-800 rounded-xl p-3 text-white focus:border-indigo-500 outline-none" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block text-indigo-400 flex items-center gap-1"><Barcode size={12}/> Barcode / UPC (Scan on iPad Keyboard)</label>
                <input name="barcode" type="text" placeholder="Tap and scan barcode..." className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 outline-none" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Initial Quantity</label>
                  <input name="quantity" type="number" defaultValue="0" className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-white outline-none" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Reorder Level</label>
                  <input name="reorder_level" type="number" defaultValue="5" className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-white outline-none" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 block">Expiration Date</label>
                <input name="expiration_date" type="date" className="w-full bg-[#0f172a] border border-slate-700 rounded-xl p-3 text-white focus:border-indigo-500 outline-none" />
              </div>

              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 py-4 rounded-2xl font-bold mt-4 flex items-center justify-center gap-2 transition text-white shadow-lg border-none cursor-pointer group">
                <Plus size={18} className="group-hover:scale-110 transition" /> Add to Inventory
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}