// scripts/migrate.js
// Migrates data/inventory.json → Supabase `supplies` table
// Run with: node scripts/migrate.js
//
// Requires .env.local to be populated with:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY  (bypasses RLS for bulk insert)

const fs = require('fs');
const path = require('path');

// ── Load env ──────────────────────────────────────────────────────────────────
require('fs').readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  .split('\n')
  .forEach((line) => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// ── Load data ─────────────────────────────────────────────────────────────────
const dataPath = path.join(__dirname, '..', 'data', 'inventory.json');
if (!fs.existsSync(dataPath)) {
  console.error('❌  data/inventory.json not found. Run `npm run seed` first.');
  process.exit(1);
}

const items = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
console.log(`📦  Loaded ${items.length} items from inventory.json`);

// ── Transform: map needs_reorder 0/1 → boolean ───────────────────────────────
const rows = items.map((item) => ({
  ...item,
  needs_reorder: item.needs_reorder === 1 || item.needs_reorder === true,
}));

// ── Upsert in batches of 100 ──────────────────────────────────────────────────
const BATCH = 100;

async function migrate() {
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);

    const res = await fetch(`${SUPABASE_URL}/rest/v1/supplies`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`❌  Batch ${i / BATCH + 1} failed:`, err);
      process.exit(1);
    }

    inserted += batch.length;
    console.log(`✓  ${inserted}/${rows.length} rows upserted`);
  }

  console.log(`\n✅  Migration complete — ${inserted} rows in Supabase 'supplies' table`);
}

migrate().catch((err) => {
  console.error('❌  Unexpected error:', err);
  process.exit(1);
});
