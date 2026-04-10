'use client';

import { useActionState, useEffect, useRef } from 'react';
import { addItemAction, type FormState } from '@/app/actions/inventory';

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const INITIAL_STATE: FormState = null;

export default function AddItemDrawer({ open, onClose, onSuccess }: Props) {
  const [state, formAction, isPending] = useActionState(addItemAction, INITIAL_STATE);
  const formRef   = useRef<HTMLFormElement>(null);
  const nameRef   = useRef<HTMLInputElement>(null);

  // Auto-focus Item Name whenever the drawer opens
  useEffect(() => {
    if (open) setTimeout(() => nameRef.current?.focus(), 50);
  }, [open]);

  // Auto-close and refresh list after success
  useEffect(() => {
    if (state?.success) {
      const t = setTimeout(() => {
        formRef.current?.reset();
        onSuccess();
        onClose();
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [state, onClose, onSuccess]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const errors = !state?.success ? state?.errors : undefined;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300
          ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Slide-out panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50
          flex flex-col transition-transform duration-300 ease-in-out
          ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">Add New Item</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition-colors rounded-lg p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form ref={formRef} action={formAction} className="flex flex-col flex-1 overflow-y-auto">
          <div className="flex-1 px-6 py-6 space-y-5">

            {/* Item Name — auto-focused */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Item Name <span className="text-red-500">*</span>
              </label>
              <input
                ref={nameRef}
                type="text"
                name="name"
                required
                placeholder="e.g. Gauze Pads"
                className={`w-full border rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 transition-colors capitalize
                  ${errors?.name
                    ? 'border-red-300 focus:ring-red-300 bg-red-50'
                    : 'border-gray-300 focus:ring-indigo-400'}`}
              />
              {errors?.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Category</label>
              <select
                name="category"
                defaultValue="General Supplies"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                <option value="Injectables">Injectables</option>
                <option value="PPE">PPE</option>
                <option value="Wound Care">Wound Care</option>
                <option value="Surgical Tools">Surgical Tools</option>
                <option value="Skin Care">Skin Care</option>
                <option value="General Supplies">General Supplies</option>
                <option value="Men's Garment">Men's Garment</option>
                <option value="Women's Garment">Women's Garment</option>
                <option value="Unisex Garment">Unisex Garment</option>
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="quantity"
                required
                defaultValue="1"
                placeholder="e.g. 50"
                className={`w-full border rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 transition-colors
                  ${errors?.quantity
                    ? 'border-red-300 focus:ring-red-300 bg-red-50'
                    : 'border-gray-300 focus:ring-indigo-400'}`}
              />
              {errors?.quantity && <p className="mt-1 text-xs text-red-600">{errors.quantity}</p>}
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                Location <span className="text-red-500">*</span>
              </label>
              <select
                name="location"
                defaultValue=""
                required
                className={`w-full border rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 transition-colors bg-white
                  ${errors?.location
                    ? 'border-red-300 focus:ring-red-300 bg-red-50'
                    : 'border-gray-300 focus:ring-indigo-400'}`}
              >
                <option value="" disabled>— Select a Location —</option>
                <option value="Exam Room 1-4">Exam Room 1-4</option>
                <option value="Storage Room">Storage Room</option>
                <option value="Exam Room 1-4 + Storage Room">Exam Room 1-4 + Storage Room</option>
                <option value="Procedure Room 1">Procedure Room 1</option>
                <option value="Procedure Room 2">Procedure Room 2</option>
                <option value="Storage Closet">Storage Closet</option>
                <option value="Kitchen">Kitchen</option>
                <option value="Front Office">Front Office</option>
                <option value="Reception Area">Reception Area</option>
                <option value="Instrument Processing Room">Instrument Processing Room</option>
              </select>
              {errors?.location && <p className="mt-1 text-xs text-red-600">{errors.location}</p>}
            </div>

            {/* Reorder Level */}
            <FormField label="Reorder Level" name="reorder_level" placeholder="e.g. 10" />

            {/* Expiration Date */}
            <FormField
              label="Expiration Date"
              name="expiration_date"
              placeholder="MM/DD/YY"
              error={errors?.expiration_date}
            />

            {/* Lot Number */}
            <FormField label="Lot Number" name="lot_number" placeholder="e.g. LOT-2024-A1" />

            {/* Success banner */}
            {state?.success && (
              <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium">
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Item added successfully!
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || state?.success === true}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400
                text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {isPending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Saving…
                </>
              ) : state?.success ? 'Saved ✓' : 'Add Item'}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}

// ── Shared field ──────────────────────────────────────────────────────────────
function FormField({
  label, name, type = 'text', placeholder, error,
}: {
  label: string; name: string; type?: string; placeholder?: string; error?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        className={`w-full border rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 transition-colors
          ${error ? 'border-red-300 focus:ring-red-300 bg-red-50' : 'border-gray-300 focus:ring-indigo-400'}`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
