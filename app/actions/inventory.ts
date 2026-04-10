'use server';

import { revalidatePath } from 'next/cache';
import { createServerClient, type Supply } from '@/lib/supabase';
import { toISODate } from '@/lib/dates';
import { toTitleCase } from '@/lib/strings';

// ── Input type ────────────────────────────────────────────────────────────────
export type NewSupplyInput = {
  name: string;
  quantity: string;
  inventory_id?: string;
  description?: string;
  reorder_level?: string;
  expiration_date?: string;
  location?: string;
  manufacturer?: string;
  notes?: string;
  needs_reorder?: boolean;
  category?: string;
  lot_number?: string;
};

// ── Result type ───────────────────────────────────────────────────────────────
export type ActionResult =
  | { success: true; data: Supply }
  | { success: false; errors: Partial<Record<keyof NewSupplyInput, string>> };

// ── Validation ────────────────────────────────────────────────────────────────
function validate(input: NewSupplyInput): Partial<Record<keyof NewSupplyInput, string>> {
  const errors: Partial<Record<keyof NewSupplyInput, string>> = {};

  if (!input.name?.trim())
    errors.name = 'Name is required.';

  if (input.quantity === undefined || input.quantity === null || input.quantity.trim() === '')
    errors.quantity = 'Quantity is required.';  // "0" is explicitly allowed

  if (!input.location?.trim())
    errors.location = 'Location is required to save an item.';

  if (
    input.expiration_date &&
    input.expiration_date.trim() !== '' &&
    isNaN(Date.parse(input.expiration_date))
  )
    errors.expiration_date = 'Expiration date must be a valid date (YYYY-MM-DD).';

  return errors;
}

// ── Server action ─────────────────────────────────────────────────────────────
export async function addInventoryItem(input: NewSupplyInput): Promise<ActionResult> {
  // 1. Validate
  const errors = validate(input);
  if (Object.keys(errors).length > 0) return { success: false, errors };

  // 2. Build the row — trim strings, apply defaults
  const row = {
    inventory_id:    input.inventory_id?.trim()    || null,
    name:            toTitleCase(input.name),
    description:     input.description?.trim()     || null,
    quantity:        input.quantity.trim(),
    reorder_level:   input.reorder_level?.trim()   || null,
    expiration_date: toISODate(input.expiration_date) ?? null,
    qty_on_reorder:  null,
    expired:         null,
    location:        input.location?.trim()        || null,
    manufacturer:    input.manufacturer?.trim()    || null,
    notes:           input.notes?.trim()           || null,
    needs_reorder:   input.needs_reorder ?? false,
    category:        input.category?.trim()        || 'General Supplies',
    lot_number:      input.lot_number?.trim()      || null,
    updated_at:      new Date().toISOString(),
  };

  // 3. Insert via server client (service role key — bypasses RLS)
  const serverClient = createServerClient();
  const { data, error } = await serverClient
    .from('supplies')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('[addInventoryItem]', error);
    return { success: false, errors: { name: error.message } };
  }

  // 4. Revalidate so inventory lists reflect the new row immediately
  revalidatePath('/');
  revalidatePath('/inventory');

  return { success: true, data: data as Supply };
}

// ── Soft-delete (archive) ─────────────────────────────────────────────────────
export type DeleteResult =
  | { success: true }
  | { success: false; error: string };

export async function deleteItem(id: number): Promise<DeleteResult> {
  const serverClient = createServerClient();

  const { error } = await serverClient
    .from('supplies')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[deleteItem]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/');
  revalidatePath('/inventory');

  return { success: true };
}

// ── Quantity steppers ─────────────────────────────────────────────────────────
export async function incrementQuantity(id: number): Promise<{ success: boolean; newQty?: string; error?: string }> {
  const serverClient = createServerClient();
  const { data: row, error: fetchErr } = await serverClient
    .from('supplies').select('quantity').eq('id', id).single();
  if (fetchErr) return { success: false, error: fetchErr.message };

  const newQty = String((parseInt(row.quantity) || 0) + 1);
  const { error } = await serverClient
    .from('supplies')
    .update({ quantity: newQty, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { success: false, error: error.message };

  revalidatePath('/');
  revalidatePath('/inventory');
  return { success: true, newQty };
}

export async function decrementQuantity(id: number): Promise<{ success: boolean; newQty?: string; error?: string }> {
  const serverClient = createServerClient();
  const { data: row, error: fetchErr } = await serverClient
    .from('supplies').select('quantity').eq('id', id).single();
  if (fetchErr) return { success: false, error: fetchErr.message };

  const current = parseInt(row.quantity) || 0;
  if (current <= 0) return { success: true, newQty: '0' }; // floor at zero

  const newQty = String(current - 1);
  const { error } = await serverClient
    .from('supplies')
    .update({ quantity: newQty, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return { success: false, error: error.message };

  revalidatePath('/');
  revalidatePath('/inventory');
  return { success: true, newQty };
}

// ── Bulk location update ──────────────────────────────────────────────────────
export async function bulkUpdateLocation(ids: number[], location: string): Promise<DeleteResult> {
  if (!ids.length)    return { success: false, error: 'No items selected.' };
  if (!location?.trim()) return { success: false, error: 'Location is required.' };

  const serverClient = createServerClient();
  const { error } = await serverClient
    .from('supplies')
    .update({ location, updated_at: new Date().toISOString() })
    .in('id', ids);

  if (error) {
    console.error('[bulkUpdateLocation]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/');
  revalidatePath('/inventory');
  return { success: true };
}

// ── Bulk category update ──────────────────────────────────────────────────────
export async function bulkUpdateCategory(ids: number[], category: string): Promise<DeleteResult> {
  if (!ids.length)     return { success: false, error: 'No items selected.' };
  if (!category?.trim()) return { success: false, error: 'Category is required.' };

  const serverClient = createServerClient();
  const { error } = await serverClient
    .from('supplies')
    .update({ category, updated_at: new Date().toISOString() })
    .in('id', ids);

  if (error) {
    console.error('[bulkUpdateCategory]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/');
  revalidatePath('/inventory');
  return { success: true };
}

// ── Restore (un-archive) ──────────────────────────────────────────────────────
export async function restoreItem(id: number): Promise<DeleteResult> {
  const serverClient = createServerClient();

  const { error } = await serverClient
    .from('supplies')
    .update({ is_archived: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('[restoreItem]', error);
    return { success: false, error: error.message };
  }

  revalidatePath('/');
  revalidatePath('/inventory');
  return { success: true };
}

// ── useActionState-compatible wrapper ─────────────────────────────────────────
// Accepts (prevState, FormData) so it works directly with <form action={…}>

export type FormState =
  | null
  | { success: true }
  | { success: false; errors: Partial<Record<string, string>> };

export async function addItemAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const result = await addInventoryItem({
    name:            formData.get('name')            as string ?? '',
    quantity:        formData.get('quantity')        as string ?? '',
    category:        formData.get('category')        as string ?? 'General Supplies',
    location:        formData.get('location')        as string ?? '',
    reorder_level:   formData.get('reorder_level')   as string ?? '',
    expiration_date: formData.get('expiration_date') as string ?? '',
    lot_number:      formData.get('lot_number')      as string ?? '',
  });

  if (!result.success) return { success: false, errors: result.errors };
  return { success: true };
}
