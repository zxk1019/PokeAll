// Buscador propio: sin tildes, sin mayúsculas, con pinyin (pikaqiu / pkq) y con erratas leves.
import type { L, SearchRow } from './data';

export type Kind = 'p' | 'i' | 'a' | 'm' | 't' | 'n';
export const KINDS: Kind[] = ['p', 'm', 'a', 'i', 't', 'n'];

export interface SearchEntry {
  kind: Kind;
  id: number;
  n: L;
  /** pokemon: id de especie si es la forma normal; objeto: slug del sprite; movimiento: id del tipo */
  extra: string | number;
  pinyin: string;
  keys: string[];   // nombres normalizados (zh, en, es, pinyin)
  initials: string; // iniciales del pinyin (pkq)
}

export function norm(s: string): string {
  return s
    .normalize('NFKC')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s\-_'’.:·,()（）!！?？♀♂]/g, '');
}

export function buildSearchIndex(rows: SearchRow[]): SearchEntry[] {
  return rows.map(([kind, id, zh, en, es, py, pyi, extra]) => {
    const n: L = {};
    if (zh) n.zh = zh;
    if (en) n.en = en;
    if (es) n.es = es;
    return {
      kind: kind as Kind, id, n, extra, pinyin: py,
      keys: [zh, en, es, py].filter(Boolean).map(norm),
      initials: pyi,
    };
  });
}

// Distancia de edición (con transposiciones) cortando pronto si ya es mayor que max
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev2 = new Array(b.length + 1).fill(0);
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1);
      cur[j] = v;
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    for (let j = 0; j <= b.length; j++) prev2[j] = prev[j];
    prev = cur;
  }
  return prev[b.length];
}

const isLatin = (s: string) => /^[a-z0-9]+$/.test(s);

function score(e: SearchEntry, q: string, fuzzy: boolean): number {
  let best = 0;
  for (const k of e.keys) {
    if (k === q) return 100;
    if (k.startsWith(q)) best = Math.max(best, 85 - Math.min(k.length - q.length, 15));
    else if (k.includes(q)) best = Math.max(best, 60 - Math.min(k.length - q.length, 15));
  }
  if (best) return best;
  if (q.length >= 2 && e.initials) {
    if (e.initials === q) return 70;
    if (e.initials.startsWith(q)) return 50;
  }
  if (fuzzy && q.length >= 4 && isLatin(q)) {
    const max = q.length >= 7 ? 2 : 1;
    for (const k of e.keys) {
      if (!isLatin(k)) continue;
      // compara con el nombre entero o con el principio del nombre (para ir escribiendo)
      const d = Math.min(editDistance(q, k, max), editDistance(q, k.slice(0, q.length), max));
      if (d <= max) best = Math.max(best, 35 - d * 8);
    }
  }
  return best;
}

export interface SearchOptions { kinds?: Kind[]; limit?: number; onlyDefaultForms?: boolean }

export function search(index: SearchEntry[], query: string, opts: SearchOptions = {}): SearchEntry[] {
  const { kinds, limit = 50 } = opts;
  const raw = query.trim();
  if (!raw) return [];
  const pool = kinds ? index.filter(e => kinds.includes(e.kind)) : index;

  // Búsqueda por número de Pokédex: "25" o "#25"
  const num = raw.match(/^#?(\d{1,4})$/);
  if (num) {
    const n = Number(num[1]);
    return pool
      .filter(e => e.kind === 'p' && e.extra !== '' && String(e.extra).startsWith(String(n)))
      .sort((a, b) => (a.extra === n ? -1 : b.extra === n ? 1 : Number(a.extra) - Number(b.extra)))
      .slice(0, limit);
  }

  const q = norm(raw);
  if (!q) return [];
  const run = (fuzzy: boolean) => {
    const out: { e: SearchEntry; s: number }[] = [];
    for (const e of pool) {
      if (opts.onlyDefaultForms && e.kind === 'p' && e.extra === '') continue;
      let s = score(e, q, fuzzy);
      if (!s) continue;
      // Los Pokémon suelen ser lo que más se busca; sus formas (Mega, gorras de Pikachu...) van detrás
      if (e.kind === 'p') s += e.extra !== '' ? 4 : -15;
      out.push({ e, s });
    }
    return out;
  };
  let results = run(false);
  if (results.length < 5) results = run(true);
  return results
    .sort((a, b) => b.s - a.s || a.e.id - b.e.id)
    .slice(0, limit)
    .map(r => r.e);
}

/** Para el quiz: ¿la respuesta coincide con algún nombre (en cualquier idioma o en pinyin)? */
export function matchesName(n: L, pinyinText: string, answer: string): boolean {
  const a = norm(answer);
  if (!a) return false;
  return [n.zh, n.en, n.es, pinyinText].some(x => x && norm(x) === a);
}
