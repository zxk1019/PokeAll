// Convierte los CSV de PokeAPI (data-raw/) en JSON pequeños para la web (public/data/).
// Uso: npm run data:build   (antes: npm run data:download)
//
// Idiomas: zh = chino simplificado (si falta, tradicional), en = inglés, es = español (si falta, el de Latinoamérica).
// Si algo no está traducido simplemente no se guarda y la web enseña el inglés.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pinyin } from 'pinyin-pro';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'data-raw');
const OUT = join(ROOT, 'public', 'data');

// id de idioma en PokeAPI -> nuestro código. El orden importa: el primero que exista gana.
const LANGS = { zh: [12, 4], en: [9], es: [7, 14] };

// ---------- utilidades ----------
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter(r => r.length > 1).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

const cache = new Map();
async function csv(name) {
  if (!cache.has(name)) cache.set(name, parseCsv(await readFile(join(RAW, name + '.csv'), 'utf8')));
  return cache.get(name);
}

const int = v => (v === '' || v == null ? null : Number(v));
const groupBy = (arr, key) => {
  const m = new Map();
  for (const x of arr) {
    const k = typeof key === 'function' ? key(x) : x[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
};

// Construye { [id]: {zh, en, es} } a partir de una tabla de nombres.
async function names(file, idCol, langCol = 'local_language_id', textCol = 'name') {
  const byId = new Map();
  for (const r of await csv(file)) {
    const text = r[textCol]?.trim();
    if (!text) continue;
    if (!byId.has(r[idCol])) byId.set(r[idCol], new Map());
    byId.get(r[idCol]).set(Number(r[langCol]), text);
  }
  const out = new Map();
  for (const [id, m] of byId) out.set(Number(id), pickLangs(m));
  return out;
}

function pickLangs(langMap) {
  const o = {};
  for (const [code, ids] of Object.entries(LANGS)) {
    for (const id of ids) if (langMap.has(id)) { o[code] = langMap.get(id); break; }
  }
  return o;
}

function cleanText(t, code) {
  t = t.replace(/­\s*/g, '').replace(/\f/g, '\n');
  if (code === 'zh') t = t.replace(/[\n　]+/g, '');
  else t = t.replace(/\s*\n\s*/g, ' ');
  return t.replace(/ {2,}/g, ' ').trim();
}

// Textos de relleno de los juegos nuevos ("Este movimiento no se puede usar, por lo que sería mejor olvidarlo...").
// Ojo: solo el principio exacto, porque "no puede usar dos veces seguidas" sí es una descripción de verdad.
const USELESS = [/^this move can.t be used\./i, /^este movimiento no se puede usar/i, /^(无法使用这个招式|無法使用這個招式)/, /^\?+$/, /^dummy/i];

// Descripción más reciente por idioma. orderOf(row) = cuanto mayor, más nuevo.
async function latestText(file, idCol, orderOf) {
  const best = new Map(); // id -> Map(langId -> {order, text})
  for (const r of await csv(file)) {
    const lang = Number(r.language_id);
    if (![4, 7, 9, 12, 14].includes(lang)) continue;
    const text = r.flavor_text;
    if (!text || USELESS.some(re => re.test(text.replace(/\s+/g, ' ').trim()))) continue;
    const order = orderOf(r);
    if (!best.has(r[idCol])) best.set(r[idCol], new Map());
    const m = best.get(r[idCol]);
    if (!m.has(lang) || m.get(lang).order < order) m.set(lang, { order, text });
  }
  const out = new Map();
  for (const [id, m] of best) {
    const o = {};
    for (const [code, ids] of Object.entries(LANGS)) {
      for (const lid of ids) if (m.has(lid)) { o[code] = cleanText(m.get(lid).text, code); break; }
    }
    out.set(Number(id), o);
  }
  return out;
}

function toPinyin(zh) {
  if (!zh || !/[一-鿿]/.test(zh)) return ['', ''];
  const parts = pinyin(zh, { toneType: 'none', type: 'array', nonZh: 'consecutive', v: true })
    .map(s => s.toLowerCase().replace(/[^a-z0-9]/g, ''))
    .filter(Boolean);
  return [parts.join(''), parts.map(s => s[0]).join('')];
}

async function save(name, data) {
  const json = JSON.stringify(data);
  await writeFile(join(OUT, name + '.json'), json);
  console.log(`  ${name}.json  ${(json.length / 1024).toFixed(0)} KB`);
}

// ---------- tablas base ----------
console.log('Leyendo CSV...');
await mkdir(OUT, { recursive: true });

const versionGroups = new Map((await csv('version_groups')).map(r => [Number(r.id), { gen: Number(r.generation_id), order: Number(r.order) }]));
const versions = new Map((await csv('versions')).map(r => [Number(r.id), Number(r.version_group_id)]));
const vgOrder = vg => versionGroups.get(Number(vg))?.order ?? 0;
const versionNames = await names('version_names', 'version_id');

// Tipos (1-18, sin "astral", "???" ni "oscuro" de Colosseum)
const typeNames = await names('type_names', 'type_id');
const types = (await csv('types')).filter(r => Number(r.id) <= 18).map(r => ({ id: Number(r.id), slug: r.identifier, n: typeNames.get(Number(r.id)) }));
const eff = Array.from({ length: 18 }, () => Array(18).fill(1));
for (const r of await csv('type_efficacy')) {
  const a = Number(r.damage_type_id), d = Number(r.target_type_id);
  if (a <= 18 && d <= 18) eff[a - 1][d - 1] = Number(r.damage_factor) / 100;
}

// Generaciones y regiones
const genNames = await names('generation_names', 'generation_id');
const regionNames = await names('region_names', 'region_id');
const REGION_ES = { 5: 'Teselia' }; // PokeAPI no trae los nombres de región en español; casi todos son iguales que en inglés
for (const [id, n] of regionNames) if (!n.es && n.en) n.es = REGION_ES[id] ?? n.en;
const generations = (await csv('generations')).map(r => ({
  id: Number(r.id), slug: r.identifier, n: genNames.get(Number(r.id)), region: regionNames.get(Number(r.main_region_id)),
}));

// ---------- especies y Pokémon ----------
console.log('Pokémon...');
const speciesRows = await csv('pokemon_species');
const speciesNames = await names('pokemon_species_names', 'pokemon_species_id');
const speciesGenus = await names('pokemon_species_names', 'pokemon_species_id', 'local_language_id', 'genus');
const speciesFlavor = await latestText('pokemon_species_flavor_text', 'species_id', r => vgOrder(versions.get(Number(r.version_id))) * 100 + Number(r.version_id) % 100);

const pokemonRows = await csv('pokemon');
const formRows = await csv('pokemon_forms');
const formNames = await names('pokemon_form_names', 'pokemon_form_id', 'local_language_id', 'form_name');
const formFullNames = await names('pokemon_form_names', 'pokemon_form_id', 'local_language_id', 'pokemon_name');
const formById = new Map(formRows.map(r => [Number(r.id), r]));
const defaultFormOf = new Map(); // pokemon id -> fila de su forma por defecto
for (const f of formRows) if (f.is_default === '1') defaultFormOf.set(Number(f.pokemon_id), f);

const typesBy = groupBy(await csv('pokemon_types'), r => Number(r.pokemon_id));
const statsBy = groupBy(await csv('pokemon_stats'), r => Number(r.pokemon_id));
const abilitiesBy = groupBy(await csv('pokemon_abilities'), r => Number(r.pokemon_id));
const eggBy = groupBy(await csv('pokemon_egg_groups'), r => Number(r.species_id));
const speciesById = new Map(speciesRows.map(r => [Number(r.id), r]));

const REGIONAL_ES = { Alolan: 'Forma de Alola', Galarian: 'Forma de Galar', Hisuian: 'Forma de Hisui', Paldean: 'Forma de Paldea' };
const fullNameOf = new Map(); // pokemon id -> nombres completos de PokeAPI ("Paldean Tauros (Combat Breed)")
const pokemon = [];
const formsOfSpecies = new Map();
// Pikachu disfrazados de Rubí Omega/Zafiro Alfa: no salen en ningún juego en chino, así que no tienen nombre oficial chino
const HIDDEN_FORMS = new Set(['pikachu-rock-star', 'pikachu-belle', 'pikachu-pop-star', 'pikachu-phd', 'pikachu-libre', 'pikachu-cosplay']);
for (const r of pokemonRows) {
  if (HIDDEN_FORMS.has(r.identifier)) continue;
  const id = Number(r.id), sp = Number(r.species_id);
  const def = r.is_default === '1';
  const form = defaultFormOf.get(id);
  const spNames = speciesNames.get(sp) ?? {};
  let n = { ...spNames }, f;
  if (!def && form) {
    const fid = Number(form.id);
    const full = formFullNames.get(fid) ?? {};
    f = { ...(formNames.get(fid) ?? {}) };
    // PokeAPI no trae en español (ni a veces en chino) las formas nuevas: completamos las más comunes
    const regional = f.en?.match(/^(Alolan|Galarian|Hisuian|Paldean) Form$/);
    if (regional && !f.es) f.es = REGIONAL_ES[regional[1]];
    if (r.identifier.endsWith('-gmax')) { f.es ??= 'Gigamax'; f.zh ??= '超极巨化'; }
    fullNameOf.set(id, full);
    n = {};
    for (const code of ['zh', 'en', 'es']) {
      const sp = spNames[code];
      if (full[code]) n[code] = full[code];
      else if (sp && f[code]) n[code] = f[code].includes(sp) ? f[code] : `${sp} (${f[code]})`; // "Mega-Venusaur" ya lleva el nombre
      else if (sp && f.en) n[code] = `${sp} (${f.en})`;
      else if (sp) n[code] = sp;
    }
    if (!Object.keys(f).length) f = undefined;
  }
  const stats = (statsBy.get(id) ?? []).sort((a, b) => a.stat_id - b.stat_id);
  const vg = form ? Number(form.introduced_in_version_group_id) : null;
  const p = {
    id, sp, slug: r.identifier, n,
    ...(f ? { f } : {}),
    def: def ? 1 : 0,
    gen: def ? Number(speciesById.get(sp).generation_id) : (versionGroups.get(vg)?.gen ?? Number(speciesById.get(sp).generation_id)),
    t: (typesBy.get(id) ?? []).sort((a, b) => a.slot - b.slot).map(x => Number(x.type_id)),
    s: stats.map(x => Number(x.base_stat)),
    ev: stats.map(x => Number(x.effort)),
    ab: (abilitiesBy.get(id) ?? []).sort((a, b) => a.slot - b.slot).map(x => [Number(x.ability_id), Number(x.is_hidden)]),
    h: Number(r.height), w: Number(r.weight),
  };
  if (form?.is_mega === '1') p.mega = 1;
  if (r.identifier.endsWith('-gmax')) p.gmax = 1;
  if (form?.is_battle_only === '1') p.battle = 1;
  pokemon.push(p);
  if (!formsOfSpecies.has(sp)) formsOfSpecies.set(sp, []);
  formsOfSpecies.get(sp).push(id);
}
const pokemonById = new Map(pokemon.map(p => [p.id, p]));

// Objetos que llevan los Pokémon salvajes (versión más reciente con datos)
const heldRows = await csv('pokemon_items');
const heldByPokemon = new Map();
for (const [pid, rows] of groupBy(heldRows, r => Number(r.pokemon_id))) {
  const latest = Math.max(...rows.map(r => vgOrder(versions.get(Number(r.version_id))) * 100 + Number(r.version_id) % 100));
  const items = rows.filter(r => vgOrder(versions.get(Number(r.version_id))) * 100 + Number(r.version_id) % 100 === latest);
  heldByPokemon.set(pid, [...new Set(items.map(r => Number(r.item_id)))]);
}
for (const [pid, items] of heldByPokemon) if (pokemonById.has(pid)) pokemonById.get(pid).held = items;

const species = speciesRows.map(r => {
  const id = Number(r.id);
  const forms = formsOfSpecies.get(id) ?? [];
  forms.sort((a, b) => (pokemonById.get(b).def - pokemonById.get(a).def) || a - b);
  const s = {
    id, slug: r.identifier,
    n: speciesNames.get(id) ?? {},
    g: speciesGenus.get(id) ?? {},
    gen: Number(r.generation_id),
    chain: Number(r.evolution_chain_id),
    forms,
    gr: Number(r.gender_rate),
    cr: Number(r.capture_rate),
    hatch: int(r.hatch_counter),
    egg: (eggBy.get(id) ?? []).map(x => Number(x.egg_group_id)),
    d: speciesFlavor.get(id) ?? {},
  };
  if (r.evolves_from_species_id) s.from = Number(r.evolves_from_species_id);
  if (r.is_legendary === '1') s.leg = 1;
  if (r.is_mythical === '1') s.myth = 1;
  if (r.is_baby === '1') s.baby = 1;
  return s;
});

// ---------- evoluciones ----------
console.log('Evoluciones...');
const evoRows = await csv('pokemon_evolution');
const formToPokemon = id => (id ? Number(formById.get(Number(id))?.pokemon_id) || null : null);
const usedLocations = new Set();
const evolutionItems = new Map(); // item id -> Set(species id)

function condition(r) {
  const c = { t: Number(r.evolution_trigger_id) };
  const num = (key, col) => { if (r[col] !== '' && r[col] != null) c[key] = Number(r[col]); };
  num('lvl', 'minimum_level');
  num('item', 'trigger_item_id');
  num('held', 'held_item_id');
  num('gender', 'gender_id');
  num('loc', 'location_id');
  // En Alcremie (girar, t=5) la hora solo cambia el color final: no la guardamos para no repetir 21 veces lo mismo
  if (r.time_of_day && c.t !== 5) c.time = r.time_of_day;
  num('move', 'known_move_id');
  num('moveType', 'known_move_type_id');
  num('happy', 'minimum_happiness');
  num('beauty', 'minimum_beauty');
  num('aff', 'minimum_affection');
  num('phys', 'relative_physical_stats');
  num('party', 'party_species_id');
  num('partyType', 'party_type_id');
  num('tradeWith', 'trade_species_id');
  if (r.needs_overworld_rain === '1') c.rain = 1;
  if (r.turn_upside_down === '1') c.upside = 1;
  if (r.needs_multiplayer === '1') c.multi = 1;
  if (r.near_special_rock === '1') c.rock = 1;
  num('region', 'region_id');
  num('usedMove', 'used_move_id');
  num('count', 'minimum_move_count');
  num('steps', 'minimum_steps');
  num('dmg', 'minimum_damage_taken');
  if (r.nature_bitmask) c.nature = 1;
  num('chance', 'percentage_chance');
  const fromForm = formToPokemon(r.required_pokemon_form_id);
  const toForm = formToPokemon(r.evolved_pokemon_form_id);
  if (fromForm && !pokemonById.get(fromForm)?.def) c.fromForm = fromForm;
  if (toForm && !pokemonById.get(toForm)?.def) c.toForm = toForm;
  return c;
}

const evolutions = {};
for (const [toSpecies, rows] of groupBy(evoRows, r => Number(r.evolved_species_id))) {
  const sp = speciesById.get(toSpecies);
  if (!sp?.evolves_from_species_id) continue;
  // Una evolución puede tener filas para cada juego. Por cada forma resultante nos quedamos con
  // las filas "por defecto" del juego más nuevo (o, si no hay por defecto, las del juego más nuevo).
  const conds = [];
  for (const [, group] of groupBy(rows, r => r.evolved_pokemon_form_id || '-')) {
    const pool = group.some(r => r.is_default === '1') ? group.filter(r => r.is_default === '1') : group;
    const latest = Math.max(...pool.map(r => vgOrder(r.version_group_id)));
    for (const r of pool.filter(r => vgOrder(r.version_group_id) === latest)) conds.push(condition(r));
  }
  // Quita condiciones repetidas (p. ej. las 63 combinaciones de Alcremie que solo cambian el resultado)
  const seen = new Set();
  const unique = conds.filter(c => { const k = JSON.stringify({ ...c, toForm: undefined, chance: undefined }); if (seen.has(k) && !c.toForm) return false; seen.add(k); return true; });
  for (const c of unique) {
    if (c.loc) usedLocations.add(c.loc);
    for (const it of [c.item, c.held]) if (it) {
      if (!evolutionItems.has(it)) evolutionItems.set(it, new Set());
      evolutionItems.get(it).add(toSpecies);
    }
  }
  const chain = Number(sp.evolution_chain_id);
  (evolutions[chain] ??= []).push({ from: Number(sp.evolves_from_species_id), to: toSpecies, c: unique });
}
const locationNames = await names('location_names', 'location_id');
const locs = {};
for (const id of usedLocations) locs[id] = locationNames.get(id) ?? {};

// ---------- habilidades ----------
console.log('Habilidades...');
const abilityNames = await names('ability_names', 'ability_id');
const abilityFlavor = await latestText('ability_flavor_text', 'ability_id', r => vgOrder(r.version_group_id));
const abilityHolders = new Map();
for (const p of pokemon) for (const [aid] of p.ab) {
  if (!abilityHolders.has(aid)) abilityHolders.set(aid, new Set());
  abilityHolders.get(aid).add(p.sp);
}
const abilities = (await csv('abilities')).filter(r => r.is_main_series === '1').map(r => {
  const id = Number(r.id);
  const a = { id, slug: r.identifier, n: abilityNames.get(id) ?? {}, d: abilityFlavor.get(id) ?? {}, gen: Number(r.generation_id) };
  const holders = [...(abilityHolders.get(id) ?? [])];
  const chains = new Set(holders.map(sp => speciesById.get(sp).evolution_chain_id));
  if (holders.length === 1) a.ex = 'sp';          // solo la tiene una especie
  else if (holders.length > 1 && chains.size === 1) a.ex = 'line'; // solo una línea evolutiva
  return a;
});

// ---------- movimientos ----------
console.log('Movimientos...');
const moveNames = await names('move_names', 'move_id');
const moveFlavor = await latestText('move_flavor_text', 'move_id', r => vgOrder(r.version_group_id));
const machineRows = await csv('machines');
const SV = 25;
const moveTm = new Map();      // move -> item (MT de Escarlata/Púrpura)
const itemTmMove = new Map();  // item -> {move, order}
for (const r of machineRows) {
  const item = Number(r.item_id), move = Number(r.move_id), order = vgOrder(r.version_group_id);
  if (Number(r.version_group_id) === SV) moveTm.set(move, item);
  if (!itemTmMove.has(item) || itemTmMove.get(item).order < order) itemTmMove.set(item, { move, order });
}
const moves = (await csv('moves')).filter(r => Number(r.id) < 10000).map(r => {
  const id = Number(r.id);
  const m = {
    id, slug: r.identifier, n: moveNames.get(id) ?? {}, d: moveFlavor.get(id) ?? {},
    t: Number(r.type_id), c: Number(r.damage_class_id),
    p: int(r.power), a: int(r.accuracy), pp: int(r.pp), pr: Number(r.priority), gen: Number(r.generation_id),
  };
  if (r.effect_chance) m.ec = Number(r.effect_chance);
  if (moveTm.has(id)) m.tm = moveTm.get(id);
  return m;
});

// ---------- objetos ----------
console.log('Objetos...');
const SKIP_CATEGORIES = new Set(['unused', 'data-cards', 'dynamax-crystals']);
const categories = (await csv('item_categories'));
const categoryById = new Map(categories.map(r => [Number(r.id), r]));
const itemNames = await names('item_names', 'item_id');
const itemFlavor = await latestText('item_flavor_text', 'item_id', r => vgOrder(r.version_group_id));
const heldByItem = new Map();
for (const [pid, items] of heldByPokemon) for (const it of items) {
  if (!heldByItem.has(it)) heldByItem.set(it, []);
  heldByItem.get(it).push(pid);
}
const items = (await csv('items')).filter(r => !SKIP_CATEGORIES.has(categoryById.get(Number(r.category_id))?.identifier)).map(r => {
  const id = Number(r.id);
  const it = { id, slug: r.identifier, n: itemNames.get(id) ?? {}, d: itemFlavor.get(id) ?? {}, cat: Number(r.category_id), cost: Number(r.cost) };
  if (r.fling_power) it.fling = Number(r.fling_power);
  if (evolutionItems.has(id)) it.evo = [...evolutionItems.get(id)].sort((a, b) => a - b);
  if (heldByItem.has(id)) it.held = heldByItem.get(id).sort((a, b) => a - b);
  if (itemTmMove.has(id)) it.tm = itemTmMove.get(id).move;
  return it;
}).filter(it => it.n.en);

// Nombres de categorías: PokeAPI solo las trae en inglés, así que las traduzco aquí.
const CAT = {
  'stat-boosts': ['能力提升', 'Stat boosts', 'Potenciadores'],
  'effort-drop': ['降低努力值的树果', 'EV-lowering berries', 'Bayas que bajan EV'],
  'medicine': ['回复树果', 'Healing berries', 'Bayas curativas'],
  'other': ['其他树果', 'Other berries', 'Otras bayas'],
  'in-a-pinch': ['危机时生效的树果', 'In-a-pinch berries', 'Bayas de apuro'],
  'picky-healing': ['挑口味的回复树果', 'Picky healing berries', 'Bayas curativas por sabor'],
  'type-protection': ['减轻伤害的树果', 'Type-protection berries', 'Bayas antitipo'],
  'baking-only': ['烘焙用树果', 'Baking-only berries', 'Bayas para repostería'],
  'collectibles': ['收藏品', 'Collectibles', 'Coleccionables'],
  'evolution': ['进化道具', 'Evolution', 'Evolución'],
  'spelunking': ['地下探险', 'Spelunking', 'Excavación'],
  'held-items': ['携带道具', 'Held items', 'Objetos equipables'],
  'choice': ['讲究系列', 'Choice items', 'Objetos Elección'],
  'effort-training': ['努力值训练', 'EV training', 'Entrenamiento de EV'],
  'bad-held-items': ['负面携带道具', 'Harmful held items', 'Objetos perjudiciales'],
  'training': ['培育', 'Training', 'Entrenamiento'],
  'plates': ['石板', 'Plates', 'Tablas'],
  'species-specific': ['专属道具', 'Species-specific', 'Exclusivos de especie'],
  'type-enhancement': ['属性强化', 'Type enhancement', 'Potenciadores de tipo'],
  'event-items': ['活动道具', 'Event items', 'Objetos de evento'],
  'gameplay': ['游戏用道具', 'Gameplay', 'Objetos de juego'],
  'plot-advancement': ['剧情道具', 'Story items', 'Objetos de historia'],
  'loot': ['贵重物品', 'Valuables', 'Objetos de valor'],
  'all-mail': ['邮件', 'Mail', 'Cartas'],
  'vitamins': ['营养饮料', 'Vitamins', 'Vitaminas'],
  'healing': ['回复', 'Healing', 'Curación'],
  'pp-recovery': ['回复PP', 'PP recovery', 'Recuperar PP'],
  'revival': ['复活', 'Revival', 'Revivir'],
  'status-cures': ['治疗异常状态', 'Status cures', 'Curar estados'],
  'mulch': ['肥料', 'Mulch', 'Abono'],
  'special-balls': ['特殊球', 'Special balls', 'Balls especiales'],
  'standard-balls': ['普通球', 'Standard balls', 'Balls normales'],
  'dex-completion': ['图鉴相关', 'Dex completion', 'Completar la Pokédex'],
  'scarves': ['围巾', 'Scarves', 'Pañuelos'],
  'all-machines': ['招式学习器', 'TMs & HMs', 'MT y MO'],
  'flutes': ['笛子', 'Flutes', 'Flautas'],
  'apricorn-balls': ['球果球', 'Apricorn balls', 'Balls de Bonguri'],
  'apricorn-box': ['球果盒', 'Apricorn box', 'Caja de Bonguris'],
  'jewels': ['宝石', 'Gems', 'Gemas'],
  'miracle-shooter': ['发射器道具', 'Wonder Launcher', 'Objetos del lanzador'],
  'mega-stones': ['超级石', 'Mega Stones', 'Megapiedras'],
  'memories': ['存储碟', 'Memories', 'Discos'],
  'z-crystals': ['Z纯晶', 'Z-Crystals', 'Cristales Z'],
  'species-candies': ['糖果', 'Candies', 'Caramelos'],
  'catching-bonus': ['捕获辅助树果', 'Catching bonus', 'Ayuda para capturar'],
  'nature-mints': ['薄荷', 'Mints', 'Mentas'],
  'curry-ingredients': ['咖喱食材', 'Curry ingredients', 'Ingredientes de curri'],
  'tera-shard': ['太晶碎块', 'Tera Shards', 'Teralitos'],
  'sandwich-ingredients': ['三明治食材', 'Sandwich ingredients', 'Ingredientes de bocadillo'],
  'tm-materials': ['招式学习器材料', 'TM materials', 'Materiales de MT'],
  'picnic': ['野餐', 'Picnic', 'Pícnic'],
};
const pocketNames = await names('item_pocket_names', 'item_pocket_id');
const itemCats = {};
for (const r of categories) {
  if (SKIP_CATEGORIES.has(r.identifier)) continue;
  const tr = CAT[r.identifier];
  itemCats[r.id] = { slug: r.identifier, pocket: Number(r.pocket_id), n: tr ? { zh: tr[0], en: tr[1], es: tr[2] } : { en: r.identifier } };
}
const pockets = {};
for (const [id, n] of pocketNames) pockets[id] = n;

// ---------- movimientos que aprende cada Pokémon ----------
console.log('Movimientos aprendidos...');
// Preferimos Escarlata/Púrpura; si el Pokémon no está, el juego principal más reciente donde sí esté.
const VG_PREF = [25, 20, 23, 18, 17, 16, 15, 14, 11, 10, 9, 8, 32, 24, 19, 7, 6, 5, 4, 3, 2, 1, 12, 13, 28, 29];
const learnRows = groupBy((await csv('pokemon_moves')).filter(r => Number(r.pokemon_move_method_id) <= 4), r => Number(r.pokemon_id));
const learnsets = {};
const usedVgs = new Set();
for (const [pid, rows] of learnRows) {
  if (!pokemonById.has(pid)) continue;
  const vgs = new Set(rows.map(r => Number(r.version_group_id)));
  const vg = VG_PREF.find(v => vgs.has(v));
  if (!vg) continue;
  usedVgs.add(vg);
  const seen = new Set();
  const m = [];
  for (const r of rows) {
    if (Number(r.version_group_id) !== vg) continue;
    const entry = [Number(r.move_id), Number(r.pokemon_move_method_id), Number(r.level) || 0];
    const k = entry.join(',');
    if (seen.has(k)) continue;
    seen.add(k);
    m.push(entry);
  }
  m.sort((a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0]);
  learnsets[pid] = { v: vg, m };
}
// Nombre de cada juego usado, p. ej. "Escarlata / Púrpura"
const vgNames = {};
const versionsByVg = groupBy([...versions].map(([id, vg]) => ({ id, vg })), 'vg');
for (const vg of usedVgs) {
  const n = {};
  for (const code of ['zh', 'en', 'es']) {
    const parts = (versionsByVg.get(vg) ?? []).map(v => versionNames.get(v.id)?.[code] ?? versionNames.get(v.id)?.en).filter(Boolean);
    if (parts.length) n[code] = parts.join(' / ');
  }
  vgNames[vg] = n;
}

// ---------- naturalezas y grupos huevo ----------
const natureNames = await names('nature_names', 'nature_id');
const natures = (await csv('natures')).map(r => ({
  id: Number(r.id), slug: r.identifier, n: natureNames.get(Number(r.id)) ?? {},
  up: Number(r.increased_stat_id), down: Number(r.decreased_stat_id),
  likes: Number(r.likes_flavor_id), hates: Number(r.hates_flavor_id),
}));
const eggGroups = {};
for (const [id, n] of await names('egg_group_prose', 'egg_group_id')) eggGroups[id] = n;
const regions = {};
for (const [id, n] of regionNames) regions[id] = n;

// ---------- textos de otras webs ----------
// data-extra/texts.json lo crea scripts/fill-missing.mjs con los textos que PokeAPI no trae
// (52poké Wiki, WikiDex, Pokémon Database, Serebii). Solo rellena huecos: lo de PokeAPI siempre gana.
// "src" guarda de qué web sale cada descripción para que la web lo diga.
let extra = {};
try { extra = JSON.parse(await readFile(join(ROOT, 'data-extra', 'texts.json'), 'utf8')); } catch { /* no hay */ }
{
  // p = Pokémon (nombre de la forma), r = regiones, l = lugares
  const byKind = Object.fromEntries(Object.entries({ s: species, a: abilities, m: moves, i: items, p: pokemon }).map(([k, arr]) => [k, new Map(arr.map(x => [x.id, x]))]));
  const places = { r: regions, l: locs };
  let filled = 0;
  for (const [k, v] of Object.entries(extra)) {
    if (!v) continue;
    const [kind, id, field, lang] = k.split(':');
    if (places[kind]) {
      const names = places[kind][id];
      if (names && !names[lang]) { names[lang] = v[0]; filled++; }
      continue;
    }
    const x = byKind[kind]?.get(Number(id));
    if (!x?.[field] || x[field][lang]) continue;
    x[field][lang] = v[0];
    if (field === 'd') (x.src ??= {})[lang] = v[1];
    // Con el nombre de la forma se rehace el nombre completo, que estaba con el inglés: "Tauros (Paldean Form…)"
    if (kind === 'p' && field === 'f' && !fullNameOf.get(x.id)?.[lang]) {
      const sp = speciesNames.get(x.sp)?.[lang];
      if (sp) x.n[lang] = v[0].includes(sp) ? v[0] : `${sp} (${v[0]})`;
    }
    filled++;
  }
  console.log(`Textos de otras webs: ${filled}`);
}

// ---------- lo que no tiene texto oficial ----------
// Movimientos y objetos sin descripción del juego en ningún idioma no se enseñan (las MT no cuentan: usan la del movimiento).
// Hoy son los 5 movimientos de los Starmóviles del Team Star (Pirochoque...), que ningún Pokémon aprende, y la Extraña Ball,
// que solo sale al pasar Pokémon con Balls de otros juegos y tiene "ーーー". Comprobado en 52poké, WikiDex, Pokémon Database,
// Serebii, Pokéos y Bulbapedia (noviembre de 2026): ninguno tiene texto del juego.
{
  const noText = x => !x.tm && !['zh', 'en', 'es'].some(l => x.d?.[l]);
  for (const [label, arr] of [['movimientos', moves], ['objetos', items]]) {
    const gone = arr.filter(noText);
    for (const x of gone) arr.splice(arr.indexOf(x), 1);
    if (gone.length) console.log(`Sin texto oficial, fuera (${label}): ${gone.map(x => x.slug).join(', ')}`);
  }
}
// Lo que nunca salió en un juego en chino (desde Sol/Luna) tampoco se enseña: objetos sin nombre chino oficial que
// fill-missing ya buscó en 52poké y no encontró (null en data-extra; si aún no se ha buscado, se queda para buscarlo).
// Hoy son las cartas, llaves y objetos de la 3.ª y 4.ª generación (Bono Bici, Pase Tri...) y la región de Orre.
{
  const searched = k => k in extra && extra[k] === null;
  const gone = items.filter(x => !x.n.zh && searched(`i:${x.id}:n:zh`));
  for (const x of gone) items.splice(items.indexOf(x), 1);
  if (gone.length) console.log(`Nunca salió en chino, fuera (objetos): ${gone.map(x => x.slug).join(', ')}`);
  // las regiones no se buscan fuera: la que no tiene nombre chino en PokeAPI es de juegos de GameCube (Orre)
  const regionsGone = Object.keys(regions).filter(id => !regions[id].zh);
  if (regionsGone.length) console.log(`Nunca salió en chino, fuera (regiones): ${regionsGone.map(id => regions[id].en ?? id).join(', ')}`);
  for (const id of regionsGone) delete regions[id];
}

// ---------- índice de búsqueda ----------
console.log('Índice de búsqueda...');
// Cada entrada: [tipo, id, zh, en, es, pinyin, iniciales, extra]
const search = [];
const add = (kind, id, n, extra = '') => {
  const [py, pyi] = toPinyin(n.zh);
  search.push([kind, id, n.zh ?? '', n.en ?? '', n.es ?? '', py, pyi, extra]);
};
for (const p of pokemon) add('p', p.id, p.n, p.def ? p.sp : '');
for (const it of items) add('i', it.id, it.n, it.slug);
for (const a of abilities) add('a', a.id, a.n);
for (const m of moves) add('m', m.id, m.n, m.t);
for (const t of types) add('t', t.id, t.n);
for (const n of natures) add('n', n.id, n.n);

// ---------- guardar ----------
console.log('Guardando en public/data/ ...');
await save('meta', {
  generated: new Date().toISOString().slice(0, 10),
  types, eff, generations, natures, eggGroups, regions, locs, itemCats, pockets, vgNames,
});
await save('species', species);
await save('pokemon', pokemon);
await save('evolutions', evolutions);
await save('abilities', abilities);
await save('moves', moves);
await save('items', items);
await save('learnsets', learnsets);
await save('search', search);

// Resumen de lo que falta (las MT no cuentan: la web enseña el texto de su movimiento)
const missing = (arr, field) => Object.fromEntries(['zh', 'en', 'es'].map(l => [l, arr.filter(x => !x[field][l]).length]));
console.log('\nSin texto (nombre / descripción):');
for (const [label, arr] of [['Especies', species], ['Habilidades', abilities], ['Movimientos', moves], ['Objetos', items.filter(it => !it.tm)]]) {
  console.log(`  ${label.padEnd(12)} total ${arr.length}  nombre ${JSON.stringify(missing(arr, 'n'))}  descripción ${JSON.stringify(missing(arr, 'd'))}`);
}
const forms = pokemon.filter(p => p.f);
console.log(`  ${'Formas'.padEnd(12)} total ${forms.length}  nombre ${JSON.stringify(missing(forms, 'f'))}  sin habilidades ${pokemon.filter(p => !p.ab.length).length}`);
const placeNames = [...Object.values(regions), ...Object.values(locs)].map(n => ({ n }));
console.log(`  ${'Lugares'.padEnd(12)} total ${placeNames.length}  nombre ${JSON.stringify(missing(placeNames, 'n'))}`);
