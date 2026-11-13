// Funciones de ayuda: imágenes, tabla de tipos y formatos.
import type { Db, Meta, Pokemon } from './data';

const SPR = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';

export const spriteUrl = (id: number, shiny = false) => `${SPR}/pokemon/${shiny ? 'shiny/' : ''}${id}.png`;
export const artworkUrl = (id: number, shiny = false) => `${SPR}/pokemon/other/official-artwork/${shiny ? 'shiny/' : ''}${id}.png`;
export const itemSpriteUrl = (slug: string) => `${SPR}/items/${slug}.png`;
export const cryUrl = (id: number) => `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`;

export const TYPE_SLUGS = [
  'normal', 'fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel',
  'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy',
];
export const typeSlug = (id: number) => TYPE_SLUGS[id - 1] ?? 'normal';

/** Multiplicador de daño de un tipo atacante contra uno o dos tipos defensores. */
export function effectiveness(meta: Meta, attack: number, defend: number[]): number {
  return defend.reduce((acc, d) => acc * meta.eff[attack - 1][d - 1], 1);
}

/** Para cada tipo atacante (1-18), cuánto daño recibe un Pokémon con estos tipos. */
export function defensiveChart(meta: Meta, defend: number[]): { type: number; mult: number }[] {
  return meta.types.map(t => ({ type: t.id, mult: effectiveness(meta, t.id, defend) }));
}

export const dexNumber = (n: number) => '#' + String(n).padStart(4, '0');
export const formatHeight = (dm: number) => (dm / 10).toFixed(1) + ' m';
export const formatWeight = (hg: number) => (hg / 10).toFixed(1) + ' kg';
export const total = (p: Pokemon) => p.s.reduce((a, b) => a + b, 0);

/** El Pokémon "normal" de una especie (su primera forma). */
export const defaultPokemon = (db: Db, speciesId: number) => db.pokemon.get(db.species.get(speciesId)?.forms[0] ?? speciesId);

export function multLabel(m: number): string {
  if (m === 0.25) return '¼';
  if (m === 0.5) return '½';
  return String(m);
}

/** Color de la barra de una estadística según lo alta que sea. */
export function statColor(v: number): string {
  if (v < 50) return 'var(--stat-1)';
  if (v < 80) return 'var(--stat-2)';
  if (v < 100) return 'var(--stat-3)';
  if (v < 120) return 'var(--stat-4)';
  if (v < 150) return 'var(--stat-5)';
  return 'var(--stat-6)';
}

export function randomInt(max: number) {
  return Math.floor(Math.random() * max);
}
