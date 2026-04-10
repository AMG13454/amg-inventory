import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'inventory.json');

export type Item = {
  id: number;
  inventory_id: string | null;
  name: string;
  description: string | null;
  quantity: string | null;
  reorder_level: string | null;
  expiration_date: string | null;
  qty_on_reorder: string | null;
  expired: string | null;
  location: string | null;
  manufacturer: string | null;
  notes: string | null;
  needs_reorder: number;   // 0 | 1
  category: string;
  updated_at: string;
};

export function readAll(): Item[] {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as Item[];
}

export function writeAll(items: Item[]): void {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(items, null, 2), 'utf-8');
}

export function updateItem(id: number, updates: Partial<Item>): Item | null {
  const items = readAll();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...updates, updated_at: new Date().toISOString() };
  writeAll(items);
  return items[idx];
}
