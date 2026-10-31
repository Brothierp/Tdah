#!/usr/bin/env node
// Choisit la clé PUBLIQUE dans la sortie de `supabase projects api-keys -o json`.
// Préfère la nouvelle clé « publishable », sinon la clé « anon ». Refuse toute clé secrète.
const raw = process.argv[2] ?? '';

function pick(json) {
  const list = Array.isArray(json) ? json : (json?.keys ?? []);
  const isSecret = (k) =>
    /secret|service_role/i.test(`${k.type ?? ''} ${k.name ?? ''}`) || String(k.api_key ?? '').startsWith('sb_secret_');
  const candidates = list.filter((k) => k && k.api_key && !isSecret(k));
  return (
    candidates.find((k) => k.type === 'publishable' || String(k.api_key).startsWith('sb_publishable_')) ??
    candidates.find((k) => k.name === 'anon')
  )?.api_key;
}

let key;
try {
  key = pick(JSON.parse(raw));
} catch {
  key = undefined;
}
if (!key) {
  console.error('Clé publique introuvable. Copie-la à la main depuis Supabase › Project Settings › API Keys.');
  process.exit(1);
}
process.stdout.write(key);

module.exports = { pick };
