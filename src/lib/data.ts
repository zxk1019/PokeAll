// Tipos de los JSON que genera scripts/build-data.mjs y funciones para cargarlos.
import { useEffect, useState } from 'react';
import { buildSearchIndex, type SearchEntry } from './search';

export type Lang = 'zh' | 'en' | 'es';
/** Texto en varios idiomas. Si falta uno, es que no está traducido. */
export type L = Partial<Record<Lang, string>>;
/** Web de la que sale una descripción que PokeAPI no trae (ver scripts/fill-missing.mjs) */
export type Source = 'w52' | 'wdx' | 'pdb' | 'ser' | 'pcn' | 'pos';
export type Src = Partial<Record<Lang, Source>>;

export interface Pokemon {
  id: number; sp: number; slug: string; n: L; f?: L; def: 0 | 1; gen: number;
  t: number[]; s: number[]; ev: number[]; ab: [number, number][]; h: number; w: number;
  mega?: 1; gmax?: 1; battle?: 1; held?: number[];
}
export interface Species {
  id: number; slug: string; n: L; g: L; gen: number; chain: number; forms: number[];
  gr: number; cr: number; hatch: number | null; egg: number[]; d: L; src?: Src;
  from?: number; leg?: 1; myth?: 1; baby?: 1;
}
export interface EvoCond {
  t: number; lvl?: number; item?: number; held?: number; gender?: number; loc?: number; time?: string;
  move?: number; moveType?: number; happy?: number; beauty?: number; aff?: number; phys?: number;
  party?: number; partyType?: number; tradeWith?: number; rain?: 1; upside?: 1; multi?: 1; rock?: 1;
  region?: number; usedMove?: number; count?: number; steps?: number; dmg?: number; nature?: 1;
  chance?: number; fromForm?: number; toForm?: number;
}
export interface EvoEdge { from: number; to: number; c: EvoCond[] }
export interface Ability { id: number; slug: string; n: L; d: L; src?: Src; gen: number; ex?: 'sp' | 'line' }
export interface Move {
  id: number; slug: string; n: L; d: L; src?: Src; t: number; c: number; p: number | null; a: number | null;
  pp: number | null; pr: number; gen: number; ec?: number; tm?: number;
}
export interface Item {
  id: number; slug: string; n: L; d: L; src?: Src; cat: number; cost: number; fling?: number;
  evo?: number[]; held?: number[]; tm?: number;
}
export interface TypeInfo { id: number; slug: string; n: L }
export interface Nature { id: number; slug: string; n: L; up: number; down: number; likes: number; hates: number }
export interface Meta {
  generated: string;
  types: TypeInfo[];
  /** eff[atacante-1][defensor-1] = 0 | 0.5 | 1 | 2 */
  eff: number[][];
  generations: { id: number; slug: string; n: L; region?: L }[];
  natures: Nature[];
  eggGroups: Record<string, L>;
  regions: Record<string, L>;
  locs: Record<string, L>;
  itemCats: Record<string, { slug: string; pocket: number; n: L }>;
  pockets: Record<string, L>;
  vgNames: Record<string, L>;
}
/** [id del movimiento, método (1 nivel, 2 huevo, 3 tutor, 4 MT), nivel] */
export type LearnEntry = [number, number, number];
export type Learnsets = Record<string, { v: number; m: LearnEntry[] }>;
export type SearchRow = [string, number, string, string, string, string, string, string | number];

export interface Db {
  meta: Meta;
  species: Map<number, Species>;
  speciesList: Species[];
  pokemon: Map<number, Pokemon>;
  pokemonList: Pokemon[];
  abilities: Map<number, Ability>;
  abilityList: Ability[];
  moves: Map<number, Move>;
  moveList: Move[];
  items: Map<number, Item>;
  itemList: Item[];
  evolutions: Record<string, EvoEdge[]>;
  /** id de habilidad -> Pokémon que la tienen (con si es oculta) */
  abilityHolders: Map<number, { p: Pokemon; hidden: boolean }[]>;
  search: SearchEntry[];
}

const BASE = import.meta.env.BASE_URL;
const files = new Map<string, Promise<unknown>>();

export function loadJson<T>(name: string): Promise<T> {
  if (!files.has(name)) {
    const p = fetch(`${BASE}data/${name}.json`).then(r => {
      if (!r.ok) throw new Error(`No se pudo cargar ${name}.json (${r.status})`);
      return r.json();
    });
    p.catch(() => files.delete(name)); // si falla, que se pueda reintentar
    files.set(name, p);
  }
  return files.get(name) as Promise<T>;
}

const byId = <T extends { id: number }>(list: T[]) => new Map(list.map(x => [x.id, x]));

let dbPromise: Promise<Db> | null = null;
export function loadDb(): Promise<Db> {
  dbPromise ??= (async () => {
    const [meta, speciesList, pokemonList, abilityList, moveList, itemList, evolutions, searchRows] = await Promise.all([
      loadJson<Meta>('meta'), loadJson<Species[]>('species'), loadJson<Pokemon[]>('pokemon'),
      loadJson<Ability[]>('abilities'), loadJson<Move[]>('moves'), loadJson<Item[]>('items'),
      loadJson<Record<string, EvoEdge[]>>('evolutions'), loadJson<SearchRow[]>('search'),
    ]);
    const abilityHolders = new Map<number, { p: Pokemon; hidden: boolean }[]>();
    for (const p of pokemonList) for (const [aid, hidden] of p.ab) {
      if (!abilityHolders.has(aid)) abilityHolders.set(aid, []);
      abilityHolders.get(aid)!.push({ p, hidden: hidden === 1 });
    }
    return {
      meta, speciesList, pokemonList, abilityList, moveList, itemList, evolutions, abilityHolders,
      species: byId(speciesList), pokemon: byId(pokemonList), abilities: byId(abilityList),
      moves: byId(moveList), items: byId(itemList),
      search: buildSearchIndex(searchRows),
    };
  })();
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

/** Devuelve el resultado de una promesa (o null mientras carga). */
function usePromise<T>(factory: () => Promise<T>): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    let alive = true;
    factory().then(
      data => alive && setState({ data, error: null }),
      err => alive && setState({ data: null, error: String(err?.message ?? err) }),
    );
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}

export const useDb = () => usePromise(loadDb);
export const useLearnsets = () => usePromise(() => loadJson<Learnsets>('learnsets'));
