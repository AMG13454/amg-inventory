// scripts/migrate-locations.js
// One-time migration: standardizes the `location` column across all rows.
// Run with: npm run migrate:locations
//
// Mapping rules:
//   "exam" or "room 1–4" (non-procedure)  → Exam Room 1-4
//   "storage" or "closet"                 → Storage Room
//   exam + storage in same string         → Exam Room 1-4 + Storage Room
//   "proc" or "surgery"                   → Procedure Room 1 (or 2 if "2" mentioned)
//   empty / unrecognized                  → left blank (null)

const path = require('path');

// ── Load .env.local ───────────────────────────────────────────────────────────
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

// ── Standard location values ──────────────────────────────────────────────────
const LOC = {
  EXAM:         'Exam Room 1-4',
  STORAGE:      'Storage Room',
  EXAM_STORAGE: 'Exam Room 1-4 + Storage Room',
  PROC1:        'Procedure Room 1',
  PROC2:        'Procedure Room 2',
};

function mapLocation(raw) {
  if (!raw || !raw.trim()) return null;
  const s = raw.toLowerCase().trim();

  const hasExam    = /exam/.test(s);
  const hasStorage = /storage|closet/.test(s);
  const hasProc    = /proc|surgery|surgical/.test(s);
  const hasRoomNum = /\broom\s*[1-4]\b/.test(s);

  if (hasExam && hasStorage) return LOC.EXAM_STORAGE;
  if (hasProc) {
    // If "2" appears near a procedure keyword, assign Room 2
    return /procedure\s*room\s*2|proc.*\b2\b|\b2\b.*proc|surgery\s*2/.test(s)
      ? LOC.PROC2
      : LOC.PROC1;
  }
  if (hasStorage)             return LOC.STORAGE;
  if (hasExam || hasRoomNum)  return LOC.EXAM;

  // Unknown / unrecognized → leave blank
  return null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  // 1. Fetch all rows (id + location only)
  console.log('🔍  Fetching current locations from Supabase…');
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/supplies?select=id,location&limit=1000`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  if (!res.ok) { console.error('❌  Fetch failed:', await res.text()); process.exit(1); }
  const rows = await res.json();
  console.log(`📦  ${rows.length} rows loaded`);

  // 2. Compute new locations, collect changed items
  const changed = [];
  const skipped = [];
  for (const row of rows) {
    const newLoc = mapLocation(row.location);
    const oldLoc = row.location || null;
    if (newLoc !== oldLoc) {
      changed.push({ id: row.id, old: oldLoc, newLoc });
    } else {
      skipped.push(row.id);
    }
  }

  console.log(`\n📊  ${changed.length} rows will be updated, ${skipped.length} already clean\n`);
  if (changed.length === 0) { console.log('✅  Nothing to do.'); return; }

  // Preview first 10 changes
  console.log('Sample changes:');
  changed.slice(0, 10).forEach(({ id, old, newLoc }) =>
    console.log(`  #${id}  "${old ?? ''}"  →  "${newLoc ?? ''}"`)
  );
  if (changed.length > 10) console.log(`  … and ${changed.length - 10} more`);

  // 3. Group by new location value and PATCH each group in one request
  const groups = {};
  for (const { id, newLoc } of changed) {
    const key = newLoc ?? '__null__';
    if (!groups[key]) groups[key] = [];
    groups[key].push(id);
  }

  let updated = 0;
  for (const [key, ids] of Object.entries(groups)) {
    const locationValue = key === '__null__' ? null : key;
    const idList = ids.join(',');

    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/supplies?id=in.(${idList})`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: SERVICE_KEY,
          Authorization: `Bearer ${SERVICE_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ location: locationValue }),
      }
    );

    if (!patchRes.ok) {
      console.error(`❌  Failed to update group "${locationValue}":`, await patchRes.text());
      process.exit(1);
    }

    updated += ids.length;
    console.log(`✓  ${ids.length} rows → "${locationValue ?? 'blank'}"`);
  }

  console.log(`\n✅  Done — ${updated} rows standardized`);
}

run().catch((err) => { console.error('❌  Unexpected error:', err); process.exit(1); });
