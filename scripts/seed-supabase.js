// scripts/seed-supabase.js
// Run with: node scripts/seed-supabase.js

const fs = require('fs');
const path = require('path');

// ── Load env ──────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('❌  .env.local not found');
  process.exit(1);
}
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const [k, ...v] = line.split('=');
  if (k && v.length) process.env[k.trim()] = v.join('=').trim();
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

// ── Locate CSV ────────────────────────────────────────────────────────────────
const csvPath = path.join(__dirname, '..', 'AMG Inventory list MASTER LIST.csv');
if (!fs.existsSync(csvPath)) {
  console.error('❌  Could not find CSV at', csvPath);
  process.exit(1);
}
console.log('📄  Reading:', csvPath);

// ── Helpers ───────────────────────────────────────────────────────────────────
function parseLine(line) {
  const cols = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      cols.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  cols.push(cur.trim());
  return cols;
}

function normaliseDate(raw) {
  if (!raw) return null;
  const s = raw.trim();
  if (!s || s.toUpperCase() === 'NA') return null;
  const parts = s.split('/');
  if (parts.length === 3) {
    let [m, d, y] = parts;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s;
}

// ── Parse CSV ─────────────────────────────────────────────────────────────────
const lines = fs.readFileSync(csvPath, 'utf-8').split(/\r?\n/).slice(5);
const items = [];

for (const line of lines) {
  if (!line.trim()) continue;
  const c = parseLine(line);
  const name = (c[2] || '').trim();
  if (!name) continue;

  const desc = (c[3] || '').trim();
  const category = desc.toLowerCase().startsWith('garment') ? 'Garment' : 'Medical';

  items.push({
    id:              items.length + 1,
    inventory_id:    c[1]  ? c[1].trim()  : null,
    name,
    description:     desc  || null,
    quantity:        c[4]  ? c[4].trim()  : null,
    reorder_level:   c[5]  ? c[5].trim()  : null,
    expiration_date: normaliseDate(c[6]),
    qty_on_reorder:  c[7]  ? c[7].trim()  : null,
    expired:         c[8]  ? c[8].trim()  : null,
    location:        c[9]  ? c[9].trim()  : null,
    manufacturer:    c[10] ? c[10].trim() : null,
    notes:           c[11] ? c[11].trim() : null,
    needs_reorder:   (c[0] || '').trim().toLowerCase() === 'reorder',
    category,
    updated_at:      new Date().toISOString(),
  });
}

console.log(`📦  Parsed ${items.length} items`);

// ── Insert into Supabase ──────────────────────────────────────────────────────
async function seed() {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Insert in batches of 100
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const { error } = await supabase.from('supplies').insert(batch);
    if (error) {
      console.error(`❌  Error inserting batch at offset ${i}:`, error.message);
      process.exit(1);
    }
    inserted += batch.length;
    console.log(`   ✓ ${inserted}/${items.length}`);
  }

  console.log(`✅  Seeded ${inserted} items into Supabase`);
}

seed();
