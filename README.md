# PokeAll · Pokédex en 中 / EN / ES

Web de información Pokémon en chino (simplificado), inglés y español. Se puede instalar en el móvil como una app (PWA) y funciona sin internet una vez abierta.

**Web: https://zxk1019.github.io/PokeAll/**

## Qué tiene

- **Pokédex**: las 1025 especies y sus formas (Mega, Gigamax, regionales…), con filtros por generación, tipo y categoría y orden por estadísticas.
- **Ficha de cada Pokémon**: nombres en los 3 idiomas (con pinyin), descripción, datos, habilidades, estadísticas, debilidades, árbol de evolución con sus condiciones, movimientos que aprende, objetos que lleva en estado salvaje, versión variocolor y su grito.
- **Objetos**: lo que hace cada uno, a quién hace evolucionar, qué movimiento enseña cada MT y quién lo lleva en estado salvaje.
- **Habilidades**: incluidas las **exclusivas** (de un solo Pokémon o de una sola línea evolutiva), separando las normales de las ocultas, con el **efecto detallado** (números, excepciones, cambios por generación).
- **Movimientos**: tipo, clase, potencia, precisión, PP y qué Pokémon los aprenden.
- **Tipos**: tabla de tipos y calculadora de debilidades para uno o dos tipos.
- **Naturalezas**: qué estadística sube y cuál baja, y qué sabores le gustan.
- **Traductor**: escribe cualquier nombre y te lo da en los 3 idiomas (con botón de copiar).
- **Comparar**: hasta 4 Pokémon lado a lado.
- **Equipo**: 6 Pokémon con su cobertura defensiva y ofensiva; se puede compartir con un enlace.
- **Minijuegos**: «¿Quién es ese Pokémon?» (por la silueta, contestando en cualquier idioma o en pinyin), «¿De quién es este grito?», «¿Cuál tiene más?» (estadísticas, peso y altura), «Eficacia de tipos» y «Pokémon secreto» (uno al día, el mismo para todos, con pistas).
- **Favoritos**, modo claro/oscuro y buscador global.

El buscador encuentra cosas en cualquier idioma, sin tildes, en pinyin (`pikaqiu` o `pkq`), por número (`#25`) y con erratas leves (`charmandr`).

## Cómo arrancarlo

Hace falta [Node.js](https://nodejs.org) 20 o más nuevo.

```bash
npm install
npm run dev
```

Y abrir http://localhost:5173

## Datos

Los datos salen de [PokeAPI](https://github.com/PokeAPI/pokeapi) (sus CSV). Ya están generados en `public/data/`, así que no hace falta hacer nada. Para actualizarlos cuando salga un juego nuevo:

```bash
npm run data
```

Ese comando hace dos cosas:

1. `scripts/download-data.mjs` descarga los CSV a `data-raw/` (no se sube a git).
2. `scripts/build-data.mjs` los convierte en JSON pequeños: escoge los textos más recientes de cada idioma, monta los árboles de evolución, calcula las habilidades exclusivas y crea el índice del buscador con el pinyin.

Al final te dice cuántos textos faltan. Si algo no está en tu idioma, la web lo enseña en otro y lo avisa.

### Textos que no están en PokeAPI

PokeAPI no trae muchas descripciones de los juegos nuevos (sobre todo de Escarlata/Púrpura y Leyendas Z-A) en chino ni en español, y algunos objetos ni en inglés. Tampoco algunos nombres: formas (las megaevoluciones nuevas, los Pikachu disfrazados de ROZA…), lugares y regiones. Todo eso lo saca `scripts/fill-missing.mjs` de otras webs:

| Idioma | Web | Licencia |
| --- | --- | --- |
| Chino | [52poké Wiki](https://wiki.52poke.com) y, si no está, la [web oficial china](https://www.pokemon.cn) | CC BY-NC-SA 3.0 |
| Español | [WikiDex](https://www.wikidex.net) y, si no está, [Pokéos](https://www.pokeos.com) y la [Pokédex oficial](https://www.pokemon.com/es/pokedex) | CC BY-NC-SA 3.0 |
| Inglés | [Pokémon Database](https://pokemondb.net) y [Serebii](https://www.serebii.net) | — |

Solo se usan textos y nombres oficiales de los juegos. No se usan filtraciones, ni traducciones hechas por las wikis (en chino solo cuentan los juegos que salieron en chino, desde Sol/Luna), ni textos deducidos. Lo que nunca salió en un juego en chino no está en la web: 39 objetos de la 3.ª y 4.ª generación (cartas, Pase Tri, MO08...) y la región de Orre. El efecto detallado de las habilidades es la excepción: no es texto del juego sino la explicación que escriben 52poké (chino), WikiDex (español) y Pokémon Database o PokeAPI (inglés), y la web dice de dónde sale. Si algo aún no es oficial, como las habilidades de algunas megaevoluciones nuevas, la web lo dice en vez de inventárselo.

Lo que encuentra se guarda en `data-extra/texts.json` (este sí se sube a git) y `build-data.mjs` lo usa solo para rellenar huecos: lo que trae PokeAPI siempre gana. En la web, debajo de esos textos sale de qué página vienen.

```bash
npm run data:extra             # busca solo lo que falta y vuelve a generar los JSON
npm run data:extra -- --force  # lo vuelve a buscar todo
```

Tarda unos minutos porque espera entre peticiones para no cargar las webs (Pokémon Database pide 2 segundos).

No hace falta tocar nada para que los móviles que ya tienen la app descarguen los datos nuevos: `npm run build` pone en `dist/sw.js` una versión sacada de los datos y la web (`scripts/sw-version.mjs`), y cuando algo cambia, la caché vieja se borra sola.

## Tecnología

| Parte | Qué uso | Por qué |
| --- | --- | --- |
| Frontend | React 19 + TypeScript + Vite | Lo más usado ahora mismo, arranca rápido y TypeScript avisa de los errores al escribir. |
| Router | Uno propio con `#` (`src/lib/router.tsx`) | Funciona en cualquier hosting gratuito sin configurar nada. |
| Estilos | CSS normal con variables (`src/styles.css`) | Sin librerías; modo oscuro con las mismas variables. |
| Buscador | Propio (`src/lib/search.ts`) | Para que entienda pinyin, chino, tildes y erratas a la vez. |
| "Backend" | Script de Node que genera los JSON | Los datos de Pokémon casi no cambian, así que no hace falta un servidor: la web es estática, rápida y gratis de publicar. |
| Sin internet | Service worker propio (`public/sw.js`) | Guarda la web, los datos y las imágenes. |
| Guardado | `localStorage` | Favoritos, equipo, idioma, tema y récords y rachas de los minijuegos. |
| Publicación | GitHub Actions + GitHub Pages | Cada push a `main` compila y publica la web sola. |

### ¿Y si me piden un backend de verdad?

La web no lo necesita, pero si en clase piden servidor y base de datos, lo más lógico es añadirlo solo para lo que cambia por usuario: **cuentas, favoritos y equipos guardados en la nube**. Opciones:

- **Node + Express + PostgreSQL/MySQL**: mismo lenguaje que el frontend.
- **PHP + Laravel + MySQL**: si en clase dais PHP. Se pueden importar los mismos JSON de `public/data/` a tablas.
- **Supabase**: base de datos y login ya hechos, casi sin código de servidor.

## Publicarla

Se publica sola: cada push a `main` lanza `.github/workflows/deploy.yml`, que hace `npm ci` y `npm run build` y sube `dist/` a GitHub Pages. Se puede ver cómo va en la pestaña **Actions** del repositorio.

Los JSON de `public/data/` no se generan en GitHub (tardaría mucho y depende de otras webs), así que si cambian los datos hay que subirlos también.

Para publicarla en otro sitio (Netlify, Vercel, Cloudflare Pages…):

```bash
npm run build
```

y subir la carpeta `dist/`. Como usa rutas relativas y `#`, funciona en cualquier carpeta.

## Estructura

```
.github/workflows/  publicación automática en GitHub Pages
scripts/            descarga y conversión de datos, versión de la caché
data-extra/         textos sacados de otras webs (los que faltan en PokeAPI)
public/data/        JSON generados (los usa la web)
public/sw.js        service worker (modo sin internet)
src/lib/            datos, buscador, idiomas, router, guardado
src/components/     piezas reutilizables (cabecera, buscador, evolución…)
src/pages/          una página por sección
src/pages/games/    los minijuegos (uno por archivo, y la lista en Games.tsx)
```

## Ideas para más adelante

- Dónde capturar cada Pokémon en cada juego (PokeAPI tiene `encounters.csv`, pero son muchos datos y cambian por juego).
- Calculadora de daño.
- Más idiomas (los CSV ya traen japonés, coreano, francés, alemán e italiano).

## Aviso

Proyecto fan sin ánimo de lucro. Pokémon y sus nombres © Nintendo, Creatures Inc. y GAME FREAK. Las imágenes y los gritos se cargan del repositorio de PokeAPI. Los textos que faltaban en PokeAPI salen de 52poké Wiki y WikiDex (CC BY-NC-SA 3.0, por eso el proyecto tiene que seguir siendo sin ánimo de lucro), Pokémon Database y Serebii.
