import type { TaskInput } from './taskOps';
import type { Moment, Task } from './types';

/**
 * Import de tâches depuis une autre app (ex. Reset 66) par lien profond :
 *   focustdah://import?d=<JSON encodé>
 * Format : { v: 1, src: 'Reset 66', lab: 'Jour 3', t: [{ t, e?, min?, m?, s? }] }
 * Tout est vérifié et borné : un lien reçu n'est jamais digne de confiance.
 */

export interface ImportPayload {
  source: string;
  label: string;
  tasks: TaskInput[];
}

const MOMENTS: Moment[] = ['matin', 'midi', 'aprem', 'soir'];
const MAX_TASKS = 25;
const MAX_STEPS = 12;

function text(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

export function parseImport(raw: string | string[] | undefined): ImportPayload | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  let data: unknown;
  try {
    data = JSON.parse(value);
  } catch {
    try {
      data = JSON.parse(decodeURIComponent(value));
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.t)) return null;

  const tasks: TaskInput[] = [];
  for (const item of d.t.slice(0, MAX_TASKS)) {
    if (!item || typeof item !== 'object') continue;
    const it = item as Record<string, unknown>;
    const title = text(it.t, 80);
    if (!title) continue;
    const min = typeof it.min === 'number' && Number.isFinite(it.min) ? Math.round(it.min) : null;
    const moment = MOMENTS.includes(it.m as Moment) ? (it.m as Moment) : null;
    const steps = Array.isArray(it.s) ? it.s.map((s) => text(s, 80)).filter(Boolean).slice(0, MAX_STEPS) : [];
    tasks.push({
      title,
      emoji: text(it.e, 8) || '✅',
      durationMin: min != null && min >= 1 && min <= 240 ? min : null,
      steps,
      moment,
      // Tâches du jour : pas de répétition, Reset 66 renvoie celles du lendemain.
      reminder: { enabled: false, at: null, repeat: 'none', nudge: false },
    });
  }
  if (!tasks.length) return null;
  return { source: text(d.src, 40) || 'une autre app', label: text(d.lab, 40), tasks };
}

/** Écarte les tâches déjà présentes et pas encore faites (même titre), pour ne pas dupliquer. */
export function splitDuplicates(inputs: TaskInput[], existing: Task[]) {
  const open = new Set(existing.filter((t) => !t.done).map((t) => t.title.trim().toLowerCase()));
  const fresh: TaskInput[] = [];
  const already: TaskInput[] = [];
  for (const i of inputs) (open.has(i.title.trim().toLowerCase()) ? already : fresh).push(i);
  return { fresh, already };
}
