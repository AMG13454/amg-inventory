// scripts/seed.js
// Run with: npm run seed
// Imports "AMG Inventory list MASTER LIST.csv" into data/inventory.json

const fs = require('fs');
const path = require('path');

// ── Locate CSV ──────────────────────────────────────────────────────────────
const candidates = [
  path.join(__dirname, '..', '..', 'AMG Inventory list MASTER LIST.csv'),
  path.join(__dirname, '..', 'AMG Inventory list MASTER LIST.csv'),
  path.join(process.cwd(), 'AMG Inventory list MASTER LIST.csv'),
];
const csvPath = candidates.find((p) => fs.existsSync(p));
if (!csvPath) {
  console.error('❌  Could not find CSV. Tried:\n' + candidates.join('\n'));
  process.exit(1);
}
console.log('📄  Reading:', csvPath);

// ── Output path ──────────────────────────────────────────────────────────────
const dataDir = path.join(__dirname, '..', 'data');
const outPath = path.join(dataDir, 'inventory.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ── Helpers ──────────────────────────────────────────────────────────────────
/** Parse a CSV line, respecting quoted fields and escaped ("") quotes. */
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

/**
 * Normalise date strings to YYYY-MM-DD for easy comparison.
 * Accepts M/D/YY, M/D/YYYY, or already ISO. Returns null for NA / blank.
 */
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
  // Already ISO or unrecognised — store as-is
  return s;
}

// ── Parse CSV ────────────────────────────────────────────────────────────────
// Row layout (0-indexed columns):
//  0  reorder flag ("Reorder" or blank)
//  1  inventory_id
//  2  name
//  3  description
//  4  quantity
//  5  reorder_level
//  6  expiration_date
//  7  qty_on_reorder
//  8  expired
//  9  location
// 10  manufacturer
// 11  notes
//
// The CSV file has 4 metadata rows before the header; data starts at row 6 (index 5).

const raw = fs.readFileSync(csvPath, 'utf-8');
const lines = raw.split(/\r?\n/).slice(5); // skip metadata + header

const items = [];
let id = 1;

for (const line of lines) {
  if (!line.trim()) continue;
  const c = parseLine(line);

  const name = c[2] ? c[2].trim() : '';
  if (!name) continue; // skip blank rows

  const desc = (c[3] || '').trim();
  const category = desc.toLowerCase().startsWith('garment') ? 'Garment' : 'Medical';
  const needsReorder = (c[0] || '').trim().toLowerCase() === 'reorder' ? 1 : 0;

  items.push({
    id:               id++,
    inventory_id:     c[1]  ? c[1].trim()  : null,
    name,
    description:      desc  || null,
    quantity:         c[4]  ? c[4].trim()  : null,
    reorder_level:    c[5]  ? c[5].trim()  : null,
    expiration_date:  normaliseDate(c[6]),
    qty_on_reorder:   c[7]  ? c[7].trim()  : null,
    expired:          c[8]  ? c[8].trim()  : null,
    location:         c[9]  ? c[9].trim()  : null,
    manufacturer:     c[10] ? c[10].trim() : null,
    notes:            c[11] ? c[11].trim() : null,
    needs_reorder:    needsReorder,
    category,
    updated_at:       new Date().toISOString(),
  });
}

fs.writeFileSync(outPath, JSON.stringify(items, null, 2), 'utf-8');
console.log(`✅  Imported ${items.length} items into ${outPath}`);
