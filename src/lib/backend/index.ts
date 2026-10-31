import { createCloudBackend } from './cloud';
import { createLocalBackend } from './local';
import type { Backend } from './types';

export * from './types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

/**
 * Mode cloud si un projet Supabase est configuré (fichier .env), sinon mode local.
 * Voir docs/MISE_EN_PRODUCTION.md.
 */
export const backend: Backend = url && key ? createCloudBackend(url, key) : createLocalBackend();
