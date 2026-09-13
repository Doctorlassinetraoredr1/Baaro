import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] || process.cwd();
const required = [
  'supabase/migrations/017_discovery_video.sql',
  'supabase/migrations/018_production_hardening.sql',
  'supabase/migrations/019_social_production_hardening.sql',
  'src/components/DiscoverHub.jsx',
  'src/components/NotificationCenter.jsx',
  'src/lib/feedEvents.js',
  'src/lib/reportContent.js',
];
let failed = false;
for (const rel of required) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) { console.error(`MISSING ${rel}`); failed = true; }
}
const api = path.join(root, 'api');
if (fs.existsSync(api)) {
  const files = fs.readdirSync(api, { withFileTypes: true }).filter(x => x.isFile());
  if (files.length > 12) { console.error(`API_LIMIT ${files.length} files (maximum 12)`); failed = true; }
  else console.log(`API_LIMIT OK: ${files.length}/12 files`);
}
const migrations = path.join(root, 'supabase/migrations');
if (fs.existsSync(migrations)) {
  const names = fs.readdirSync(migrations).filter(x => /^0\d+.*\.sql$/.test(x)).sort();
  const dup = names.filter((x, i) => i && x.slice(0,3) === names[i-1].slice(0,3));
  if (dup.length) console.warn('WARNING duplicate migration prefixes:', dup.join(', '));
}
if (failed) process.exit(1);
console.log('BAARO upgrade structure validation: PASS');
