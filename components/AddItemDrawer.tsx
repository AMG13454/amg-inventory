'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { addItemAction, type FormState } from '@/app/actions/inventory';
import { getCategoryRequirements } from '@/lib/categoryRules';

type ClientErrors = Partial<{
  expiration_date: string;
  lot_number: string;
}>;

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
  const [category, setCategory] = useState('General Supplies');
  const [expirationDate, setExpirationDate] = useState('');
  const [noExpiration, setNoExpiration] = useState(false);
  const [lotNumber, setLotNumber] = useState('');
  const [lotUnknown, setLotUnknown] = useState(false);
  const [clientErrors, setClientErrors] = useState<ClientErrors>({});
  const dangerousCategories = ['Injectables', 'PPE'];

  // Auto-focus Item Name whenever the drawer opens
  useEffect(() => {
    if (open) setTimeout(() => nameRef.current?.focus(), 50);
  }, [open]);

  // Auto-close and refresh list after success
  useEffect(() => {
    if (state?.success) {
      const t = setTimeout(() => {
        formRef.current?.reset();
        setCategory('General Supplies');
        setExpirationDate('');
        setNoExpiration(false);
        setLotNumber('');
        setLotUnknown(false);
        setClientErrors({});
        onSuccess();
        onClose();
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [state, onClose, onSuccess]);

  useEffect(() => {
    if (open) {
      setCategory('General Supplies');
      setExpirationDate('');
      setNoExpiration(false);
      setLotNumber('');
      setLotUnknown(false);
      setClientErrors({});
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const errors = !state?.success ? state?.errors : undefined;
  const expirationError = clientErrors.expiration_date ?? errors?.expiration_date;
  const lotError = clientErrors.lot_number ?? errors?.lot_number;

  function validateBeforeSubmit(): ClientErrors {
    const req = getCategoryRequirements(category);
    const next: ClientErrors = {};

    if (req.requiresExpiration && !noExpiration && !expirationDate.trim())
      next.expiration_date = 'Required for this category';

    if (req.requiresLot && !lotUnknown && !lotNumber.trim())
      next.lot_number = 'Required for this category';

    return next;
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const nextErrors = validateBeforeSubmit();
    setClientErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      e.preventDefault();
      return;
    }
  }

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
        <form ref={formRef} action={formAction} onSubmit={onSubmit} className="flex flex-col flex-1 overflow-y-auto">
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
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              >
                <option value="Injectables">Injectables</option>
                <option value="PPE">PPE</option>
                <option value="Wound Care">Wound Care</option>
                <option value="Surgical Tools">Surgical Tools</option>
                <option value="Skin Care">Skin Care</option>
                <option value="General Supplies">General Supplies</option>
                <option value="Men's Garments">Men's Garments</option>
                <option value="Women's Garments">Women's Garments</option>
                <option value="Unisex Garments">Unisex Garments</option>
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

            <div className="grid gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-gray-500">Expiration Date</label>
                  <label className="flex items-center gap-2 text-sm text-gray-500">
                    <input
                      type="checkbox"
                      name="no_expiration"
                      checked={noExpiration}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked && ['Injectables', 'PPE'].includes(category)) {
                          const confirmed = window.confirm('Items in this category typically expire. Are you sure this item has no expiration date?');
                          if (!confirmed) return;
                        }
                        setNoExpiration(checked);
                        if (checked) {
                          setExpirationDate('');
                          setClientErrors((prev) => ({ ...prev, expiration_date: undefined }));
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    No Expiration
                  </label>
                </div>
                {noExpiration ? (
                  <p className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-500 bg-slate-100">
                    No Expiration
                  </p>
                ) : (
                  <>
                    <input
                      type="date"
                      name="expiration_date"
                      value={expirationDate}
                      onChange={(e) => {
                        setExpirationDate(e.target.value);
                        setClientErrors((prev) => ({ ...prev, expiration_date: undefined }));
                      }}
                      className={`w-full border rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none transition-colors ${expirationError ? 'border-red-300 bg-red-50 focus:ring-red-300' : 'border-gray-300 focus:ring-indigo-400'} bg-white text-gray-900`}
                    />
                    {expirationError && <p className="mt-1 text-xs text-red-600">{expirationError}</p>}
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">LOT / BATCH NUMBER</label>
                <input
                  type="text"
                  name="lot_number_display"
                  placeholder="e.g. L123456"
                  value={lotUnknown ? 'LOT_UNKNOWN' : lotNumber}
                  onChange={(e) => {
                    setLotNumber(e.target.value);
                    setClientErrors((prev) => ({ ...prev, lot_number: undefined }));
                  }}
                  disabled={lotUnknown}
                  className={`w-full border rounded-lg px-3 py-2 text-base sm:text-sm focus:outline-none transition-colors ${lotError ? 'border-red-300 bg-red-50 focus:ring-red-300' : (lotUnknown ? 'border-gray-300' : 'border-gray-300 focus:ring-indigo-400')} ${lotUnknown ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white text-gray-900'}`}
                />
                <input type="hidden" name="lot_number" value={lotUnknown ? 'LOT_UNKNOWN' : lotNumber} />
                {lotError && <p className="mt-1 text-xs text-red-600">{lotError}</p>}
                <label className="flex items-center gap-2 mt-3 text-sm text-gray-500">
                  <input
                    type="checkbox"
                    name="lot_unknown"
                    checked={lotUnknown}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setLotUnknown(checked);
                      if (checked) {
                        setLotNumber('LOT_UNKNOWN');
                        setClientErrors((prev) => ({ ...prev, lot_number: undefined }));
                      } else {
                        if (lotNumber === 'LOT_UNKNOWN') setLotNumber('');
                      }
                    }}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Lot Unknown
                </label>
              </div>
            </div>

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
