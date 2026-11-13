// Descarga los CSV de PokeAPI (https://github.com/PokeAPI/pokeapi) a data-raw/.
// Solo hace falta ejecutarlo una vez (o cuando salga un juego nuevo y PokeAPI se actualice).
// Uso: npm run data:download   (añade --force para volver a descargar todo)
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'data-raw');
const BASE = 'https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/';

export const FILES = [
  'languages',
  'generations', 'generation_names', 'regions', 'region_names',
  'versions', 'version_names', 'version_groups',
  'stats', 'genders',
  'types', 'type_names', 'type_efficacy',
  'pokemon_species', 'pokemon_species_names', 'pokemon_species_flavor_text',
  'pokemon', 'pokemon_types', 'pokemon_stats', 'pokemon_abilities',
  'pokemon_forms', 'pokemon_form_names',
  'pokemon_egg_groups', 'egg_group_prose',
  'pokemon_items',
  'evolution_chains', 'pokemon_evolution', 'evolution_triggers',
  'abilities', 'ability_names', 'ability_flavor_text', 'ability_prose',
  'items', 'item_names', 'item_flavor_text', 'item_prose',
  'item_categories', 'item_category_prose', 'item_pockets', 'item_pocket_names',
  'moves', 'move_names', 'move_flavor_text', 'move_effect_prose',
  'pokemon_moves', 'pokemon_move_methods', 'machines',
  'natures', 'nature_names',
  'locations', 'location_names',
];

const force = process.argv.includes('--force');
await mkdir(OUT, { recursive: true });

async function exists(p) {
  try { await access(p); return true; } catch { return false; }
}

let done = 0;
async function download(name) {
  const dest = join(OUT, name + '.csv');
  if (!force && await exists(dest)) { done++; return; }
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(BASE + name + '.csv');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await writeFile(dest, await res.text());
      done++;
      console.log(`[${done}/${FILES.length}] ${name}.csv`);
      return;
    } catch (err) {
      if (attempt === 3) throw new Error(`No se pudo descargar ${name}.csv: ${err.message}`);
    }
  }
}

// 6 descargas a la vez para no saturar GitHub
const queue = [...FILES];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) await download(queue.shift());
}));
console.log(`Listo: ${FILES.length} archivos en data-raw/`);
