/**
 * ==============================================================================
 * SHEVER CAFM - CLOUD SYNC VERIFIER
 * ==============================================================================
 * Proves whether the browser can actually read and write your Supabase database
 * using the same anon key the deployed site uses.
 *
 *   node scripts/verify-cloud-sync.mjs <SUPABASE_URL> <SUPABASE_ANON_KEY>
 *
 * or, with a .env file present at the repo root:
 *
 *   node scripts/verify-cloud-sync.mjs
 *
 * It writes a throwaway building row, reads it back, then deletes it. Nothing
 * in your real data is modified.
 * ==============================================================================
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

const readEnvFile = () => {
  const out = {};
  for (const file of ['.env', '.env.local']) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return out;
};

const env = readEnvFile();
const url = process.argv[2] || process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = process.argv[3] || process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;

const pass = (m) => console.log(`  PASS  ${m}`);
const fail = (m, e) => {
  console.log(`  FAIL  ${m}`);
  if (e) console.log(`        ${e.message || e}${e.hint ? ` | hint: ${e.hint}` : ''}`);
};

if (!url || !key || url.includes('mock-shever')) {
  console.log('\nNo Supabase credentials found.\n');
  console.log('Pass them directly:');
  console.log('  node scripts/verify-cloud-sync.mjs https://xxxx.supabase.co eyJhbGci...\n');
  console.log('These must also be set in Vercel > Project > Settings > Environment');
  console.log('Variables as VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then redeployed.\n');
  process.exit(1);
}

const supabase = createClient(url, key);
console.log(`\nChecking ${url}\n`);

let failures = 0;
const step = async (label, fn) => {
  try {
    const err = await fn();
    if (err) {
      fail(label, err);
      failures++;
    } else {
      pass(label);
    }
  } catch (e) {
    fail(label, e);
    failures++;
  }
};

// 1. Can we read at all? (RLS blocks anon -> 0 rows, no error)
await step('Read profiles', async () => {
  const { data, error } = await supabase.from('profiles').select('id,email,role_id');
  if (error) return error;
  console.log(`        ${data.length} profile(s) in the cloud`);
  if (data.length === 0) {
    return new Error(
      'profiles is empty or blocked by RLS. Run database/05_cloud_sync_fix.sql.'
    );
  }
  return null;
});

// 2. Do the auth RPCs exist?
await step('app_login function exists', async () => {
  const { error } = await supabase.rpc('app_login', {
    p_identifier: '__no_such_user__',
    p_password: '__x__',
  });
  if (error && (error.code === 'PGRST202' || /app_login/i.test(error.message))) {
    return new Error('Not found. Run database/05_cloud_sync_fix.sql in the SQL Editor.');
  }
  return error;
});

// 3. Can we WRITE? This is the check that was silently failing before.
const probeId = crypto.randomUUID();
await step('Insert a row (write permission)', async () => {
  const { error } = await supabase.from('buildings').insert({
    id: probeId,
    code: `ZZ-PROBE-${Date.now()}`,
    name: 'Cloud sync probe (safe to delete)',
    city: 'Dubai',
    total_floors: 1,
  });
  return error;
});

await step('Read that row back', async () => {
  const { data, error } = await supabase.from('buildings').select('id').eq('id', probeId);
  if (error) return error;
  if (!data.length) {
    return new Error('Row was not stored — the write was silently rejected by RLS.');
  }
  return null;
});

await step('Delete the probe row (cleanup)', async () => {
  const { error } = await supabase.from('buildings').delete().eq('id', probeId);
  return error;
});

console.log(
  failures === 0
    ? '\nAll checks passed. Changes made in the app will persist and appear on every device.\n'
    : `\n${failures} check(s) failed — see the messages above.\n`
);
process.exit(failures === 0 ? 0 : 1);
