// Busca en otras webs los textos que PokeAPI no trae y los guarda en data-extra/texts.json.
// Uso: npm run data:extra   (lee public/data/, así que antes tiene que existir: npm run data:build)
//      npm run data:extra -- --force   vuelve a buscarlo todo, aunque ya esté guardado
//
// Fuentes (todas con textos de los juegos oficiales):
//   zh -> 52poké Wiki (wiki.52poke.com)         CC BY-NC-SA 3.0
//   es -> WikiDex (www.wikidex.net)              CC BY-NC-SA 3.0
//   en -> Pokémon Database (pokemondb.net) y, si no está, Serebii (serebii.net)
//
// El resultado es un JSON plano: "tipo:id:campo:idioma" -> [texto, fuente] (o null si no se encontró).
// build-data.mjs solo lo usa para rellenar huecos: nunca pisa lo que ya trae PokeAPI.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'public', 'data');
const EXTRA = join(ROOT, 'data-extra');
const FILE = join(EXTRA, 'texts.json');
const FORCE = process.argv.includes('--force');
// --only=zh,es  para buscar solo algunos idiomas
const ONLY = process.argv.find(a => a.startsWith('--only='))?.slice(7).split(',');
const run = lang => !ONLY || ONLY.includes(lang);
// User-Agent genérico (sin datos personales), como piden las wikis a los scripts
const HEADERS = { 'User-Agent': 'TriDex-data-script/0.1 (non-commercial fan project)' };
const API = { w52: 'https://wiki.52poke.com/api.php', wdx: 'https://www.wikidex.net/api.php' };

const sleep = ms => new Promise(r => setTimeout(r, ms));
const load = async name => JSON.parse(await readFile(join(DATA, name + '.json'), 'utf8'));

// ---------- caché ----------
let cache = {};
try { cache = JSON.parse(await readFile(FILE, 'utf8')); } catch { /* primera vez */ }
// Textos que no sirven: "ーーー", "- - -" o el de relleno de los juegos nuevos ("This move can't be used...")
// (y trozos de la web que no son descripciones, por si alguna vez se cuelan)
const DUMMY = [/^this move can.t be used\./i, /^este movimiento no se puede usar/i, /^(无法使用这个招式|無法使用這個招式)/, /^dummy/i,
  /^support us on patreon/i, /^pok.mon and all respective names/i];
const useless = text => /^[\s\-ー―—.…?？]*$/.test(text) || DUMMY.some(re => re.test(text.trim()));
// Si quedó guardado alguno, se borra para volver a buscarlo
for (const k of Object.keys(cache)) if (cache[k] && useless(cache[k][0])) delete cache[k];
// Con --force se empieza de cero en los idiomas que se buscan (así no quedan textos que PokeAPI ya trae)
if (FORCE) for (const k of Object.keys(cache)) { const [, , field, lang] = k.split(':'); if (field === 'd' && run(lang)) delete cache[k]; }
const found = new Map();  // clave -> [texto, fuente] encontrado en esta ejecución
async function saveCache() {
  for (const [k, v] of found) cache[k] = v;
  const keys = Object.keys(cache).sort((a, b) => {
    const [ka, ia, ...ra] = a.split(':'), [kb, ib, ...rb] = b.split(':');
    return ka.localeCompare(kb) || Number(ia) - Number(ib) || ra.join(':').localeCompare(rb.join(':'));
  });
  await mkdir(EXTRA, { recursive: true });
  await writeFile(FILE, '{\n' + keys.map(k => `${JSON.stringify(k)}: ${JSON.stringify(cache[k])}`).join(',\n') + '\n}\n');
}
const put = (k, text, src) => { if (text && !useless(text)) found.set(k, [text, src]); };

// ---------- red ----------
async function get(url, { json = false, method = 'GET', body } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { method, body, headers: { ...HEADERS, ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // Serebii va en ISO-8859-1: se decodifica con el juego de caracteres que diga la web
      const charset = /charset=([\w-]+)/i.exec(res.headers.get('content-type') ?? '')?.[1] ?? 'utf-8';
      const text = new TextDecoder(charset).decode(await res.arrayBuffer());
      return json ? JSON.parse(text) : text;
    } catch (e) {
      if (attempt >= 4) { console.warn(`  ! ${url.slice(0, 120)}: ${e.message}`); return null; }
      await sleep(1500 * attempt);
    }
  }
}

/** Código wiki de muchas páginas a la vez (50 por petición). Devuelve Map(título pedido -> texto | null). */
async function wikiPages(api, titles) {
  const out = new Map();
  const unique = [...new Set(titles)];
  for (let i = 0; i < unique.length; i += 50) {
    const batch = unique.slice(i, i + 50);
    const body = new URLSearchParams({
      action: 'query', prop: 'revisions', rvprop: 'content', rvslots: 'main',
      format: 'json', formatversion: '2', redirects: '1', titles: batch.join('|'),
    });
    const j = await get(api, { json: true, method: 'POST', body: body.toString() });
    const q = j?.query ?? {};
    const norm = new Map((q.normalized ?? []).map(x => [x.from, x.to]));
    const redir = new Map((q.redirects ?? []).map(x => [x.from, x.to]));
    const pages = new Map((q.pages ?? []).map(p => [p.title, p.revisions?.[0]?.slots?.main?.content ?? null]));
    for (const t of batch) {
      const t1 = norm.get(t) ?? t;
      out.set(t, pages.get(redir.get(t1) ?? t1) ?? null);
    }
    await sleep(400);
  }
  return out;
}

/** Páginas de la wiki que enlazan a la inglesa con ese título ([[en:Dusty Bowl]] -> 沙塵窪地, Cuenca Polvorienta). */
async function linkedTitles(api, en) {
  const j = await get(`${api}?action=query&list=langbacklinks&lbllang=en&lbltitle=${encodeURIComponent(en)}&format=json&formatversion=2`, { json: true });
  await sleep(300);
  return (j?.query?.langbacklinks ?? []).filter(p => p.ns === 0).map(p => p.title);
}

/** Título de 52poké en chino simplificado (algunas páginas tienen el título en tradicional: 沙塵窪地 -> 沙尘洼地). */
async function hansTitle(title) {
  const j = await get(`${API.w52}?action=query&prop=info&inprop=varianttitles&format=json&formatversion=2&titles=${encodeURIComponent(title)}`, { json: true });
  await sleep(300);
  return j?.query?.pages?.[0]?.varianttitles?.['zh-hans'] ?? title;
}

// ---------- código wiki ----------
/** Llamadas a una plantilla: [{ pos: [..], named: {..} }], respetando {{ }}, [[ ]] y -{ }- anidados. */
function templates(text, name) {
  const out = [];
  const re = new RegExp('\\{\\{\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(?=[|}])', 'g');
  let m;
  while ((m = re.exec(text))) {
    const parts = [];
    let depth = 0, cur = m.index + m[0].length, j = cur;
    for (; j < text.length; j++) {
      const two = text.substr(j, 2);
      if (two === '{{' || two === '[[' || two === '-{') { depth++; j++; continue; }
      if (two === '}}' && depth === 0) { parts.push(text.slice(cur, j)); break; }
      if (two === '}}' || two === ']]' || two === '}-') { depth--; j++; continue; }
      if (text[j] === '|' && depth === 0) { parts.push(text.slice(cur, j)); cur = j + 1; }
    }
    parts.shift(); // lo que hay entre el nombre y el primer |
    const pos = [], named = {};
    for (const p of parts) {
      const kv = p.match(/^\s*([^=|{}[\]<>\n]+?)\s*=([\s\S]*)$/);
      if (kv) named[kv[1].trim()] = kv[2].trim();
      else pos.push(p.trim());
    }
    out.push({ pos, named });
    re.lastIndex = j;
  }
  return out;
}

/** -{zh-hans:…;zh-hant:…}- -> el texto en chino simplificado */
function hans(s) {
  return s.replace(/-\{([^{}]*?)\}-/g, (_, inner) => {
    const v = inner.match(/zh-(?:hans|cn):([^;]*)/);
    return v ? v[1] : inner.replace(/^zh-\w+:/, '').split(';')[0];
  });
}

/** Quita el formato wiki y deja solo el texto. */
function plain(s, lang) {
  if (!s) return '';
  // Varias formas separadas por <hr> ("texto.（超级进化）"): nos quedamos con la primera
  s = s.split(/<hr\s*\/?>/i)[0];
  s = s.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<ref[^>]*\/>/g, '').replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, '')
    .replace(/<br\s*\/?>/gi, lang === 'zh' ? '' : ' ')
    .replace(/<\/?(small|span|sup|sub|b|i|u)[^>]*>/gi, '');
  if (lang === 'zh') s = hans(s);
  // Plantillas con dos versiones del español: {{n|Hispanoamérica|España}} -> la de España (la de PokeAPI)
  for (let k = 0; k < 5 && /\{\{/.test(s); k++) {
    s = s.replace(/\{\{\s*(n|NombreHaEs)\s*\|([^{}|]*)\|([^{}|]*)\}\}/gi, '$3')
      .replace(/\{\{\s*EnlaceHaEs\s*\|[^{}|]*\|([^{}|]*)\|([^{}|]*)\}\}/gi, '$2') // {{EnlaceHaEs|enlace|Pelea|Lucha}}
      .replace(/\{\{\s*(tt|ruby|lang|langtt)\s*\|([^{}|]*)(\|[^{}]*)?\}\}/gi, '$2')
      .replace(/\{\{\s*[^{}|]+\|([^{}|]*)(\|[^{}]*)?\}\}/g, '$1') // {{a|Espesura}} -> Espesura
      .replace(/\{\{[^{}]*\}\}/g, '');
  }
  s = s.replace(/\[\[(?:File|Archivo|Imagen|Image|文件|图像):[^\]]*\]\]/gi, '');
  // WikiDex pone los dos nombres en los enlaces: [[Poké Ball|Pokébola/Poké Ball]] -> el de España (el segundo)
  // (o dos enlaces seguidos: [[Tipo pelea|Tipo Pelea]]/[[Tipo lucha|Tipo Lucha]])
  if (lang === 'es') s = s.replace(/\[\[([^\]|]*\|)?([^\]/]+)\/([^\]/]+)\]\]/g, '$3').replace(/\[\[[^\]]*\]\]\/(\[\[[^\]]*\]\])/g, '$1');
  s = s.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1').replace(/\[\[([^\]]*)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#8203;/g, '').replace(/&[mn]dash;/g, '—')
    .replace(/\s+/g, ' ').trim();
  if (lang === 'zh') {
    s = s.replace(/ ?([，。！？：；、（）「」]) ?/g, '$1')
      .split(/(?<=）)／/)[0]                        // "texto（其他属性）／texto（星晶）" -> la primera versión
      .replace(/。（[^（）]{1,12}）$/, '。');           // quita la etiqueta de forma del final: "...。（草木蓑衣）"
  }
  return s;
}

/** Filas de una tabla wiki: cada fila es una lista de celdas (texto crudo). */
function tableRows(text) {
  return text.split(/\n\|-[^\n]*/).map(block => {
    const cells = [];
    for (const line of block.split('\n')) {
      if (!/^[|!]/.test(line) || /^\|[}+]/.test(line)) continue;
      for (let cell of line.slice(1).split(/\|\||!!/)) {
        // quita atributos: rowspan="2" | texto
        const attrs = cell.match(/^\s*(?:[\w-]+\s*=\s*(?:"[^"]*"|[^\s|]+)\s*)+\|(?!\|)/)?.[0] ?? '';
        cells.push(cell.slice(attrs.length).trim());
        (cells.rowspan ??= [])[cells.length - 1] = Number(attrs.match(/rowspan\s*=\s*"?(\d+)/)?.[1] ?? 1);
      }
    }
    return cells;
  });
}

/** Tablas de WikiDex (habilidades, movimientos, objetos): nombre inglés en cursiva -> {es, d}. */
function wikidexList(text) {
  const out = new Map();
  // la celda del nombre inglés termina en ''Thunder Stone'' (sola o después de un <br>)
  const english = c => c.split(/<br\s*\/?>/i).pop().trim().match(/^''(?!')(.+?)''$/)?.[1];
  let carry = null; // descripción con rowspan="4" que sirve también para las filas de abajo (Llave cabina 1, 2, 4, 6)
  for (const cells of tableRows(text)) {
    const i = cells.findIndex(english);
    if (i < 0) continue;
    // descripción: la celda que va después de {{gen|N}} o, si no hay (tabla de pícnic), la primera con texto largo
    const g = cells.findIndex((c, k) => k > i && /^\{\{gen\|\d+\}\}$/.test(c));
    let desc = g >= 0 ? cells[g + 1] : cells.slice(i + 1).find(c => plain(c, 'es').length > 25 && !/[぀-ヿ]/.test(c));
    if (desc && g >= 0 && cells.rowspan?.[g + 1] > 1) carry = { desc, left: cells.rowspan[g + 1] - 1 };
    else if (!desc && carry?.left > 0) { desc = carry.desc; carry.left--; }
    if (!desc) continue;
    const en = english(cells[i]);
    // nombre en español: lo que va antes del <br> o, si no hay, la celda enlazada anterior
    const before = cells[i].split(/<br\s*\/?>/i)[0];
    const esCell = before !== cells[i] ? before : cells.slice(0, i).reverse().find(c => /\[\[/.test(c));
    // gana la primera lista, salvo que su texto sea "- - -" (el Estuche de MT de Let's Go no tiene; el de RFVH sí)
    const prev = out.get(key(en));
    if (!prev || useless(prev.d)) out.set(key(en), { es: plain(esCell ?? '', 'es').split('/').pop(), d: plain(desc, 'es') });
  }
  return out;
}

// Para comparar nombres en inglés (Kofu’s Wallet = Kofu's Wallet, Poké Ball = Poke Ball)
const key = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

// ---------- qué falta ----------
console.log('Leyendo public/data/ ...');
const [species, abilities, moves, items, meta, pokemon] = await Promise.all(['species', 'abilities', 'moves', 'items', 'meta', 'pokemon'].map(load));
// Regiones y lugares están en meta como {id: nombres}: se pasan a lista para tratarlos igual que lo demás
const asList = obj => Object.entries(obj).map(([id, n]) => ({ id: Number(id), n }));
// p = Pokémon (para el nombre de la forma, campo "f"), r = regiones, l = lugares
const KINDS = { s: species, a: abilities, m: moves, i: items, p: pokemon, r: asList(meta.regions), l: asList(meta.locs) };
const tmCat = Object.entries(meta.itemCats).find(([, c]) => c.slug === 'all-machines')?.[0];

// Generación en la que sale por primera vez cada objeto (la de su primer texto en los CSV de PokeAPI, data-raw/).
// Sirve para escoger la sección buena en las páginas de 52poké que hablan de dos objetos con el mismo nombre.
const itemGen = new Map();
try {
  const raw = name => readFile(join(ROOT, 'data-raw', name + '.csv'), 'utf8');
  const vgGen = new Map((await raw('version_groups')).split('\n').slice(1).map(l => l.split(',')).map(c => [c[0], Number(c[2])]));
  for (const m of (await raw('item_flavor_text')).matchAll(/^(\d+),(\d+),\d+,/gm)) {
    const id = Number(m[1]), gen = vgGen.get(m[2]);
    if (gen && !(itemGen.get(id) <= gen)) itemGen.set(id, gen);
  }
} catch { /* sin data-raw: se usa la página entera */ }

/** Lista de [tipo, objeto] a los que les falta la descripción en ese idioma (y no se ha buscado ya). */
function todo(kind, lang, field = 'd') {
  return KINDS[kind].filter(x => {
    if (!x[field]) return false; // la forma normal de un Pokémon no tiene nombre de forma
    if (kind === 'i' && field === 'd' && String(x.cat) === tmCat) return false; // las MT usan el texto del movimiento
    const k = `${kind}:${x.id}:${field}:${lang}`;
    // ¿lo que hay ahora salió de data-extra? (las descripciones lo dicen en src; nombres y categorías, si están en la caché)
    const fromExtra = field === 'd' ? x.src?.[lang] : k in cache;
    if (x[field][lang] && !fromExtra) return false;   // ya viene de PokeAPI
    return FORCE || !cache[k]; // lo que no se encontró (null) se vuelve a intentar
  });
}
const miss = (kind, lang, x, field = 'd') => { const k = `${kind}:${x.id}:${field}:${lang}`; if (!found.has(k)) found.set(k, null); };
const report = (label, list, kind, lang, field = 'd') => {
  const ok = list.filter(x => found.get(`${kind}:${x.id}:${field}:${lang}`)).length;
  console.log(`  ${label.padEnd(26)} ${ok}/${list.length}`);
};

// ---------- chino: 52poké Wiki ----------
if (run('zh')) {
  // Solo vale lo de juegos que salieron en chino (desde Sol/Luna, 7.ª generación). 52poké también tiene textos y nombres
  // de juegos anteriores, pero esos los tradujo la wiki: no son oficiales y no se usan.
  const ZH_OFFICIAL_GEN = 7;
  console.log('\nChino (52poké Wiki)...');
  // Habilidades: una sola página con todas
  const list = todo('a', 'zh');
  if (list.length) {
    const page = (await wikiPages(API.w52, ['特性列表'])).get('特性列表') ?? '';
    const byEn = new Map(templates(page, '特性列表').map(t => [key(t.pos[3] ?? ''), plain(t.pos[4], 'zh')]));
    for (const a of list) put(`a:${a.id}:d:zh`, byEn.get(key(a.n.en)), 'w52'), miss('a', 'zh', a);
    report('habilidades', list, 'a', 'zh');
  }

  // Pokémon: la página de cada especie tiene {{图鉴}} con un texto por juego
  const ZH_DEX = ['zadex', 'scdex', 'videx', 'svdex', 'ladex', 'bddex', 'spdex', 'bdspdex', 'swdex', 'shdex', 'swshdex',
    'letsgodex', 'lpdex', 'ledex', 'ultrasundex', 'ultramoondex', 'usumdex', 'sundex', 'moondex', 'smdex'];
  const sp = todo('s', 'zh').filter(s => s.n.zh);
  if (sp.length) {
    const pages = await wikiPages(API.w52, sp.map(s => s.n.zh));
    const retry = sp.filter(s => !templates(pages.get(s.n.zh) ?? '', '图鉴').length);
    const pages2 = await wikiPages(API.w52, retry.map(s => s.n.zh + '（宝可梦）'));
    for (const s of sp) {
      const t = templates(pages.get(s.n.zh) ?? '', '图鉴')[0] ?? templates(pages2.get(s.n.zh + '（宝可梦）') ?? '', '图鉴')[0];
      if (t) {
        const named = Object.fromEntries(Object.entries(t.named).map(([k, v]) => [k.toLowerCase(), v]));
        const resolve = v => (v && named[v.toLowerCase()] ? named[v.toLowerCase()] : v);
        // solo juegos con traducción oficial al chino (desde Sol/Luna), del más nuevo al más viejo
        for (const k of ZH_DEX) {
          const text = plain(resolve(named[k]), 'zh');
          if (text && !/^[a-z]+dex$/i.test(text)) { put(`s:${s.id}:d:zh`, text, 'w52'); break; }
        }
      }
      miss('s', 'zh', s);
    }
    // Si 52poké no tiene texto de ningún juego en chino (Victini), la Pokédex de la web oficial china
    // (dex.pokemon.cn): el primer texto de "图鉴版本"
    for (const s of sp.filter(s => !found.get(`s:${s.id}:d:zh`))) {
      const html = await get(`https://dex.pokemon.cn/play/pokedex/${String(s.id).padStart(4, '0')}`);
      await sleep(1000);
      put(`s:${s.id}:d:zh`, html?.match(/pokemon-story__body[^>]*><span>([^<]+)</)?.[1].trim(), 'pcn');
    }
    report('pokémon', sp, 's', 'zh');
  }

  // Movimientos: cada uno tiene su plantilla Template:<nombre> con un texto por juego
  const mv = todo('m', 'zh').filter(m => m.n.zh);
  if (mv.length) {
    const pages = await wikiPages(API.w52, mv.map(m => 'Template:' + m.n.zh));
    for (const m of mv) {
      let src = pages.get('Template:' + m.n.zh) ?? '';
      if (!/Category:招式说明/.test(src)) { miss('m', 'zh', m); continue; }
      src = src.replace(/<noinclude>[\s\S]*?<\/noinclude>/g, '').trim();
      // {{#if:{{{1|}}}|{{#switch:…}}|texto por defecto}} -> el texto por defecto es el del juego más nuevo
      const iff = templates(src.replace('{{#if:', '{{#if|'), '#if')[0];
      const text = plain(iff ? iff.pos.at(-1) : src, 'zh');
      put(`m:${m.id}:d:zh`, text, 'w52');
      miss('m', 'zh', m);
    }
    report('movimientos', mv, 'm', 'zh');
  }

  // Objetos sin nombre chino en PokeAPI: su página en 52poké se encuentra por el enlace a la wiki inglesa
  // ([[en:Grass Mail]]) o buscando el nombre inglés (se prefiere la página del objeto, "自行车（道具）", a la general, "自行車").
  // El nombre solo vale si el objeto sale en algún juego en chino (las cartas de la 3.ª generación, por ejemplo, no).
  const titleByEnglish = async en => {
    let other;
    for (const name of new Set([en, en.replace(/’/g, "'")])) {
      const j = await get(`${API.w52}?action=query&list=langbacklinks&lbllang=en&lbltitle=${encodeURIComponent(name)}&format=json&formatversion=2`, { json: true });
      await sleep(300);
      const titles = (j?.query?.langbacklinks ?? []).filter(p => p.ns === 0).map(p => p.title);
      if (titles.some(t => t.endsWith('（道具）'))) return titles.find(t => t.endsWith('（道具）'));
      other ??= titles[0];
    }
    const j = await get(`${API.w52}?action=query&list=search&srsearch=${encodeURIComponent(`"${en.replace(/’/g, "'")}"`)}&srlimit=5&format=json&formatversion=2`, { json: true });
    await sleep(300);
    return j?.query?.search?.find(p => p.title.endsWith('（道具）'))?.title ?? other;
  };
  // {{包包信息框|generación|juego|imagen|bolsillo|texto}}: una fila por juego, la última es la más nueva
  // Algunas páginas tienen una sección por objeto (包裹: ==包裹（關都）== es el Paquete de Oak, ==包裹（神奧）== el de
  // Sinnoh): se usa la del objeto, que es la más nueva que ya existía cuando salió el objeto.
  const allRows = page => templates(page ?? '', '包包信息框')
    .filter(t => t.pos.length >= 5 && !/^champ/i.test(t.pos[1]))
    .map(t => ({ gen: Number(t.pos[0]), game: t.pos[1], bag: t.pos[3], text: plain(t.pos[4], 'zh') }));
  const bagRows = (page, item) => {
    let sections = (page ?? '').split(/^==[^=].*==\s*$/m).map(allRows).filter(r => r.length);
    if (sections.length > 1 && itemGen.has(item?.id)) {
      const first = rows => Math.min(...rows.map(r => r.gen));
      const fit = sections.filter(rows => first(rows) <= itemGen.get(item.id));
      sections = [fit.sort((a, b) => first(b) - first(a))[0] ?? sections[0]];
    }
    return sections.flat().filter(r => r.gen >= ZH_OFFICIAL_GEN);
  };
  // Si no sale en ninguno, se queda sin nombre (null) y build-data lo quita de la web.
  const noName = todo('i', 'zh', 'n'); // todo() ya deja fuera los nombres de PokeAPI; con --force se repiten los buscados
  for (const i of noName) {
    const title = await titleByEnglish(i.n.en);
    const official = title && bagRows((await wikiPages(API.w52, [title])).get(title), i).length > 0;
    const name = official ? (await hansTitle(title)).replace(/（道具）$/, '') : undefined;
    put(`i:${i.id}:n:zh`, name, 'w52');
    miss('i', 'zh', i, 'n');
    if (name) i.n.zh = name; // para buscar también su descripción
  }
  if (noName.length) report('nombres de objetos', noName, 'i', 'zh', 'n');

  // Objetos: página "<nombre>（道具）" con {{包包信息框}} (uno por juego; el último es el más nuevo)
  const it = todo('i', 'zh').filter(i => i.n.zh);
  if (it.length) {
    const t1 = i => i.n.zh + '（道具）';
    const pages = await wikiPages(API.w52, it.map(t1));
    const hasRows = page => allRows(page).some(r => r.gen >= ZH_OFFICIAL_GEN);
    const retry = it.filter(i => !hasRows(pages.get(t1(i))));
    const pages2 = await wikiPages(API.w52, retry.map(i => i.n.zh));
    // Si no hay página "<nombre>（道具）" (nombre en chino tradicional, como 自行車), se busca por el nombre inglés;
    // la página con el nombre a secas va la última porque a veces es un artículo general (自行車 habla de todas las bicis)
    const byEn = new Map();
    for (const i of retry) {
      const title = await titleByEnglish(i.n.en);
      if (title) byEn.set(i.id, (await wikiPages(API.w52, [title])).get(title));
    }
    for (const i of it) {
      const src = [pages.get(t1(i)), byEn.get(i.id), pages2.get(i.n.zh)].find(hasRows) ?? '';
      let rows = bagRows(src, i).filter(r => r.text && !useless(r.text));
      // Las Balls de Hisui (lapoke-ball...) están en la misma página que las normales: su texto es la fila de Leyendas Arceus
      if (/^la.+-ball$/.test(i.slug)) {
        const la = rows.filter(r => r.game === 'LA' && r.bag !== '未知');
        if (la.length) rows = la;
      }
      put(`i:${i.id}:d:zh`, rows.at(-1)?.text, 'w52');
      miss('i', 'zh', i);
    }
    report('objetos', it, 'i', 'zh');
  }

  // Formas sin nombre chino: no se buscan. Las que faltan (los Pikachu disfrazados de Rubí Omega/Zafiro Alfa) solo
  // salieron en juegos sin chino, así que los nombres de 52poké no son oficiales.

  // Lugares sin nombre chino (Dusty Bowl, de Espada/Escudo): la página enlazada a la wiki inglesa.
  // Las regiones no: la que falta (Orre) solo sale en Colosseum y XD, que no salieron en chino.
  {
    const list = todo('l', 'zh', 'n');
    for (const x of list) {
      const [title] = await linkedTitles(API.w52, x.n.en);
      put(`l:${x.id}:n:zh`, title && await hansTitle(title), 'w52');
      miss('l', 'zh', x, 'n');
    }
    if (list.length) report('lugares', list, 'l', 'zh', 'n');
  }
  await saveCache();
}

// ---------- español: WikiDex ----------
if (run('es')) {
  console.log('\nEspañol (WikiDex)...');
  // Los objetos clave están en una lista por generación (de la más nueva a la más vieja: gana el texto más nuevo)
  const GENS = ['novena', 'octava', 'séptima', 'sexta', 'quinta', 'cuarta', 'tercera', 'segunda', 'primera'];
  const keyLists = GENS.map(g => `Lista de objetos clave de la ${g} generación`);
  const lists = await wikiPages(API.wdx, ['Lista de habilidades', 'Lista de movimientos', 'Lista de objetos', 'Pícnic', ...keyLists]);
  const byAbility = wikidexList(lists.get('Lista de habilidades') ?? '');
  const byMove = wikidexList(lists.get('Lista de movimientos') ?? '');
  const byItem = wikidexList(['Lista de objetos', 'Pícnic', ...keyLists].map(t => lists.get(t) ?? '').join('\n|-\n'));
  console.log(`  (listas: ${byAbility.size} habilidades, ${byMove.size} movimientos, ${byItem.size} objetos)`);

  for (const [kind, list, map, label] of [['a', todo('a', 'es'), byAbility, 'habilidades'], ['m', todo('m', 'es'), byMove, 'movimientos'], ['i', todo('i', 'es'), byItem, 'objetos']]) {
    for (const x of list) { put(`${kind}:${x.id}:d:es`, map.get(key(x.n.en))?.d, 'wdx'); miss(kind, 'es', x); }
    report(label, list, kind, 'es');
  }

  // Materiales de MT: en el juego casi todos tienen el mismo texto, y WikiDex lo pone una sola vez ("Material de MT").
  // Se usa solo en los que en inglés tienen ese texto común (así quedan fuera los especiales, como la moneda de Gimmighoul).
  {
    const generic = byItem.get(key('TM Material'))?.d;
    const matCat = Object.entries(meta.itemCats).find(([, c]) => c.slug === 'tm-materials')?.[0];
    const mats = items.filter(i => String(i.cat) === matCat);
    const counts = new Map();
    for (const i of mats) if (i.d.en) counts.set(i.d.en, (counts.get(i.d.en) ?? 0) + 1);
    const [commonEn] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
    let filled = 0;
    for (const i of mats) {
      const k = `i:${i.id}:d:es`;
      if (!generic || i.d.en !== commonEn || (i.d.es && !i.src?.es) || found.get(k)) continue;
      put(k, generic, 'wdx'); filled++;
    }
    if (filled) console.log(`  materiales de MT           ${filled} con el texto común`);
  }

  // Objetos que no están en las listas de WikiDex (Darkrainita): Pokéos, que tiene el texto del juego en español
  // (comprobado con Pokéxperto: "Una de las misteriosas Megapiedras. Permite megaevolucionar a Darkrai en combate.")
  {
    const left = todo('i', 'es').filter(i => !found.get(`i:${i.id}:d:es`));
    for (const i of left) {
      const html = await get(`https://www.pokeos.com/es/itemdex/${i.slug}`);
      await sleep(1000);
      const text = html?.match(/"contentText":"((?:[^"\\]|\\.)*)"/)?.[1];
      put(`i:${i.id}:d:es`, text && JSON.parse(`"${text}"`), 'pos');
    }
    if (left.length) report('objetos (Pokéos)', left, 'i', 'es');
  }
  // Nombres que PokeAPI no trae en español
  for (const [kind, map] of [['a', byAbility], ['i', byItem]]) {
    const list = todo(kind, 'es', 'n');
    for (const x of list) { put(`${kind}:${x.id}:n:es`, map.get(key(x.n.en))?.es, 'wdx'); miss(kind, 'es', x, 'n'); }
    if (list.length) report(`nombres (${kind === 'a' ? 'habilidades' : 'objetos'})`, list, kind, 'es', 'n');
  }

  // Formas sin nombre en español. Las megaevoluciones nuevas están en la página "Megaevolución"
  // ('''[[Mega-Clefable]]''', '''[[Mega-Tatsugiri]] (forma curvada)''') y el resto en "Lista de Pokémon con diferentes
  // formas" ({{…|Pokémon = Palafin heroica|…|extra = Forma heroica}}). WikiDex lo escribe en minúscula ("Forma heroica");
  // se pone como en los juegos y en PokeAPI ("Forma Raya Azul", "Forma de Alola").
  const forms = todo('p', 'es', 'f');
  if (forms.length) {
    const SMALL = new Set(['de', 'del', 'la', 'el', 'y']);
    const titleCase = s => s.split(' ').map((w, i) => (i && SMALL.has(w) ? w : w.replace(/^(\(?)(\p{L})/u, (_, a, c) => a + c.toUpperCase()))).join(' ');
    const pages = await wikiPages(API.wdx, ['Megaevolución', 'Lista de Pokémon con diferentes formas']);
    const megas = new Map([...(pages.get('Megaevolución') ?? '').matchAll(/'''\[\[(Mega-[^\]|]+)\]\](?: \(([^)]+)\))?'''/g)]
      .map(m => [key(m[1] + (m[2] ?? '')), m[1] + (m[2] ? ` (${m[2]})` : '')]));
    const rows = [...(pages.get('Lista de Pokémon con diferentes formas') ?? '').matchAll(/Pokémon = ([^|}]+)\|[^}]*?extra = ([^<|}\n]+)/g)]
      .map(m => ({ label: m[1].trim(), extra: m[2].trim() }));
    // Megas con variantes: la página las pone entre paréntesis con el nombre en español
    const MEGA_VARIANT = { 'tatsugiri-curly-mega': 'forma curvada', 'tatsugiri-droopy-mega': 'forma lánguida',
      'tatsugiri-stretchy-mega': 'forma recta', 'magearna-original-mega': 'color vetusto' };
    // Fila de la lista que corresponde a cada forma (la lista no dice el nombre inglés): por el nombre de la fila o,
    // si varias formas comparten fila (Tauros de Paldea, Pikachu coqueta), por el texto
    const ROW = {
      'dialga-origin': 'Dialga origen', 'palkia-origin': 'Palkia origen', 'enamorus-therian': 'Enamorus tótem',
      'basculin-white-striped': 'Basculin blanca', 'dudunsparce-three-segment': 'Dudunsparce trinodular',
      'palafin-hero': 'Palafin heroica', 'maushold-family-of-three': 'Maushold familia de tres',
      'tatsugiri-droopy': 'Tatsugiri lánguida', 'tatsugiri-stretchy': 'Tatsugiri recta',
      'squawkabilly-blue-plumage': 'Squawkabilly azul', 'squawkabilly-yellow-plumage': 'Squawkabilly amarillo',
      'squawkabilly-white-plumage': 'Squawkabilly blanco', 'gimmighoul-roaming': 'Gimmighoul andante',
      'tauros-paldea-combat-breed': 'Variedad combatiente', 'tauros-paldea-blaze-breed': 'Variedad ardiente',
      'tauros-paldea-aqua-breed': 'Variedad acuática',
      'pikachu-cosplay': 'Pikachu coqueta', 'pikachu-rock-star': 'Pikachu roquera', 'pikachu-belle': 'Pikachu aristócrata',
      'pikachu-pop-star': 'Pikachu superstar', 'pikachu-phd': 'Pikachu erudita', 'pikachu-libre': 'Pikachu enmascarada',
    };
    const spEn = new Map(species.map(s => [s.id, s.n.en]));
    for (const p of forms) {
      let name;
      if (p.mega) name = megas.get(key(MEGA_VARIANT[p.slug] ? `Mega ${spEn.get(p.sp)} ${MEGA_VARIANT[p.slug]}` : p.f.en));
      else if (ROW[p.slug]) {
        const want = key(ROW[p.slug]);
        const row = rows.find(r => key(r.label) === want) ?? rows.find(r => key(r.extra) === want);
        name = row?.extra;
      }
      put(`p:${p.id}:f:es`, name && titleCase(name), 'wdx');
      miss('p', 'es', p, 'f');
    }
    // Las que no están en WikiDex (Basculegion y Oinkologne hembra): la Pokédex oficial (pokemon.com/es) tiene un
    // desplegable con una opción por forma, en el mismo orden ("Basculegion Macho", "Basculegion Hembra")
    for (const p of forms.filter(p => !found.get(`p:${p.id}:f:es`))) {
      const s = species.find(x => x.id === p.sp);
      const html = await get(`https://www.pokemon.com/es/pokedex/${s.slug}`);
      await sleep(1000);
      const opts = [...(html ?? '').matchAll(/<option value="\d+">([^<]+)<\/option>/g)].map(m => m[1].trim());
      if (opts.length !== s.forms.length) continue;
      put(`p:${p.id}:f:es`, opts[s.forms.indexOf(p.id)]?.replace(s.n.es, '').trim(), 'pcom');
    }
    report('nombres de formas', forms, 'p', 'es', 'f');
  }

  // Regiones y lugares sin nombre en español (Dusty Bowl -> Cuenca Polvorienta)
  for (const kind of ['r', 'l']) {
    const list = todo(kind, 'es', 'n');
    for (const x of list) {
      const [title] = await linkedTitles(API.wdx, x.n.en);
      put(`${kind}:${x.id}:n:es`, title?.replace(/ \([^)]*\)$/, ''), 'wdx');
      miss(kind, 'es', x, 'n');
    }
    if (list.length) report(kind === 'r' ? 'regiones' : 'lugares', list, kind, 'es', 'n');
  }

  // Pokémon: {{Pokédex}} en la página de cada especie (una plantilla por generación; la más nueva gana)
  const SKIP = new Set(['generación', 'generacion', 'go', 'sleep', 'pokopia', 'champions', 'masters', 'café', 'cafe', 'mundo misterioso']);
  // (también la categoría, "Pokémon Gato Planta", que PokeAPI tampoco trae para los nuevos)
  const needD = new Set(todo('s', 'es')), needG = new Set(todo('s', 'es', 'g'));
  const sp = species.filter(s => s.n.es && (needD.has(s) || needG.has(s)));
  if (sp.length) {
    const pages = await wikiPages(API.wdx, sp.map(s => s.n.es));
    const retry = sp.filter(s => !templates(pages.get(s.n.es) ?? '', 'Pokédex').length);
    const pages2 = await wikiPages(API.wdx, retry.map(s => s.n.es + ' (Pokémon)'));
    for (const s of sp) {
      const page = (templates(pages.get(s.n.es) ?? '', 'Pokédex').length ? pages.get(s.n.es) : pages2.get(s.n.es + ' (Pokémon)')) ?? '';
      if (needG.has(s)) {
        const cat = plain(page.match(/\|\s*categoría\s*=\s*([^\n]+)/)?.[1] ?? '', 'es');
        put(`s:${s.id}:g:es`, cat && `Pokémon ${cat}`, 'wdx');
        miss('s', 'es', s, 'g');
      }
      if (!needD.has(s)) continue;
      const all = templates(page, 'Pokédex');
      all.sort((a, b) => Number(b.named['generación'] ?? 0) - Number(a.named['generación'] ?? 0));
      for (const t of all) {
        const named = t.named;
        const resolve = v => (named[v] !== undefined ? named[v] : v);
        let text = '';
        for (const [k, v] of Object.entries(named)) {
          if (SKIP.has(k.toLowerCase())) continue;
          let raw = resolve(v);
          if (!raw || /^no hay$/i.test(raw.trim())) continue;
          // Varias formas: "* '''Forma X:''' texto" -> nos quedamos con la primera (la normal)
          if (/^\*/.test(raw.trim())) raw = raw.trim().split(/\n\*/)[0].replace(/^\*\s*'''[^']*'''\s*/, '');
          text = plain(raw, 'es');
          if (text) break;
        }
        if (text) { put(`s:${s.id}:d:es`, text, 'wdx'); break; }
      }
      miss('s', 'es', s);
    }
    report('pokémon', [...needD], 's', 'es');
    if (needG.size) report('categoría de pokémon', [...needG], 's', 'es', 'g');
  }
  await saveCache();
}

// ---------- inglés: Pokémon Database y Serebii ----------
if (run('en')) {
  console.log('\nInglés (Pokémon Database / Serebii)...');
  const decode = s => s.replace(/<[^>]*>/g, '').replace(/&#8203;/g, '').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"').replace(/&eacute;/g, 'é').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  /** Texto más reciente de la tabla "Game descriptions" de pokemondb.net (o el de un juego concreto) */
  const pokemondb = async (path, game) => {
    const html = await get('https://pokemondb.net/' + path);
    await sleep(2000); // lo que pide su robots.txt
    const at = html?.indexOf('Game descriptions') ?? -1;
    if (at < 0) return '';
    const table = html.slice(at, html.indexOf('</table>', at));
    const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m => ({
      game: decode(m[1].match(/<th[^>]*>([\s\S]*?)<\/th>/)?.[1] ?? ''),
      text: decode(m[1].match(/<td[^>]*>([\s\S]*?)<\/td>/)?.[1] ?? ''),
    })).filter(r => r.text && !useless(r.text)); // el más nuevo que sea de verdad
    return rows.filter(r => !game || r.game.includes(game)).at(-1)?.text ?? '';
  };
  /** Texto de la tabla "Flavour Text" de serebii.net (la dirección sale del nombre: fresh-startmochi, roto-stick...) */
  const serebii = async (slug, en) => {
    let html = null;
    for (const s of new Set([en.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s'’.]/g, ''), slug.replace(/-/g, '')])) {
      html = await get(`https://www.serebii.net/itemdex/${s}.shtml`);
      await sleep(1000);
      if (html) break;
    }
    // Solo la tabla "Flavour Text": cada juego es una fila y el texto va en <td class="fooinfo">
    const at = html?.indexOf('>Flavour Text<') ?? -1;
    if (at < 0) return '';
    const table = html.slice(at, html.indexOf('</table>', at));
    const texts = [...table.matchAll(/<td class="fooinfo"[^>]*>([\s\S]*?)<\/td>/g)].map(m => decode(m[1])).filter(t => t && !useless(t));
    return texts.at(-1) ?? '';
  };

  const it = todo('i', 'en');
  const mv = todo('m', 'en');
  console.log(`  (${it.length + mv.length} páginas, unos ${Math.ceil((it.length + mv.length) * 2.3 / 60)} min por la espera entre peticiones)`);
  let n = 0;
  for (const i of it) {
    // Las Balls de Hisui no tienen página propia: su texto es la fila de Leyendas Arceus de la Ball normal
    const hisui = /^la(.+-ball)$/.exec(i.slug)?.[1];
    let text = await pokemondb('item/' + (hisui ?? i.slug), hisui && 'Legends: Arceus'), src = 'pdb';
    if (!text && !hisui) { text = await serebii(i.slug, i.n.en); src = 'ser'; }
    put(`i:${i.id}:d:en`, text, src);
    miss('i', 'en', i);
    if (++n % 25 === 0) { await saveCache(); console.log(`  ... ${n}/${it.length}`); }
  }
  report('objetos', it, 'i', 'en');
  // los movimientos Z salen dos veces en PokeAPI (breakneck-blitz--physical / --special)
  for (const m of mv) { put(`m:${m.id}:d:en`, await pokemondb('move/' + m.slug.replace(/--(physical|special)$/, '')), 'pdb'); miss('m', 'en', m); }
  report('movimientos', mv, 'm', 'en');
  await saveCache();
}

const total = Object.values(cache).filter(Boolean).length;
console.log(`\nGuardado en data-extra/texts.json (${total} textos). Ahora: npm run data:build`);
