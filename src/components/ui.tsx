// Piezas pequeñas que se usan en muchas páginas.
import { useState, type ReactNode } from 'react';
import type { L, Lang, Pokemon, Source, Src } from '../lib/data';
import { useI18n, LANGS } from '../lib/i18n';
import { artworkUrl, defaultPokemon, dexNumber, itemSpriteUrl, spriteUrl, typeSlug } from '../lib/pokemon';
import { Link } from '../lib/router';
import { useFavorites } from '../lib/storage';
import { useDb } from '../lib/data';

export function Status({ error }: { error?: string | null }) {
  const { t } = useI18n();
  if (error) {
    return (
      <div className="status error" role="alert">
        <p>{t('error')}</p>
        <p className="muted small">{error}</p>
        <button className="btn" onClick={() => window.location.reload()}>{t('retry')}</button>
      </div>
    );
  }
  return <div className="status" aria-live="polite"><span className="spinner" aria-hidden /> {t('loading')}</div>;
}

interface ImgProps { srcs: string[]; alt: string; className?: string; size?: number }

/** Imagen que prueba varias URLs si la primera no existe. La key reinicia los intentos al cambiar de imagen. */
function FallbackImg(props: ImgProps) {
  return <FallbackImgInner key={props.srcs.join('|')} {...props} />;
}

function FallbackImgInner({ srcs, alt, className, size }: ImgProps) {
  const [i, setI] = useState(0);
  if (i >= srcs.length) return <span className={'img-missing ' + (className ?? '')} style={{ width: size, height: size }} aria-hidden>?</span>;
  return (
    <img
      key={srcs[i]}
      src={srcs[i]}
      alt={alt}
      className={className}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      crossOrigin="anonymous"
      onError={() => setI(i + 1)}
    />
  );
}

/** La forma y, de reserva, su forma normal: algunas formas no tienen imagen en PokeAPI (Koraidon en modo carrera). */
function useImageIds(id: number) {
  const { data: db } = useDb();
  const p = db?.pokemon.get(id);
  const base = db && p && !p.def ? defaultPokemon(db, p.sp)?.id : undefined;
  return base && base !== id ? [id, base] : [id];
}

/** Sprite pequeño (estilo pixel) con la ilustración oficial de reserva. */
export function Sprite({ id, alt = '', size = 64, shiny = false, silhouette = false }: { id: number; alt?: string; size?: number; shiny?: boolean; silhouette?: boolean }) {
  const srcs = useImageIds(id).flatMap(i => [spriteUrl(i, shiny), artworkUrl(i, shiny)]);
  return <FallbackImg srcs={srcs} alt={alt} size={size} className={'sprite' + (silhouette ? ' silhouette' : '')} />;
}

export function Artwork({ id, alt = '', shiny = false, silhouette = false, size = 280 }: { id: number; alt?: string; shiny?: boolean; silhouette?: boolean; size?: number }) {
  const srcs = useImageIds(id).flatMap(i => [artworkUrl(i, shiny), spriteUrl(i, shiny)]);
  return <FallbackImg srcs={srcs} alt={alt} size={size} className={'artwork' + (silhouette ? ' silhouette' : '')} />;
}

export function ItemIcon({ slug, size = 32 }: { slug: string; size?: number }) {
  return <FallbackImg srcs={[itemSpriteUrl(slug)]} alt="" size={size} className="item-icon" />;
}

export function TypeBadge({ id, small = false, link = true }: { id: number; small?: boolean; link?: boolean }) {
  const { n } = useI18n();
  const { data: db } = useDb();
  const name = db ? n(db.meta.types[id - 1]?.n) : typeSlug(id);
  const cls = `type-badge t-${typeSlug(id)}${small ? ' small' : ''}`;
  return link ? <Link to={`/types?sel=${id}`} className={cls}>{name}</Link> : <span className={cls}>{name}</span>;
}

export function Types({ ids, small, link = true }: { ids: number[]; small?: boolean; link?: boolean }) {
  return <span className="types">{ids.map(id => <TypeBadge key={id} id={id} small={small} link={link} />)}</span>;
}

/** El nombre en los 3 idiomas, con botón para copiar. */
export function NameTriple({ names, pinyin }: { names: L; pinyin?: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<Lang | null>(null);
  const copy = async (lang: Lang, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(lang);
      setTimeout(() => setCopied(null), 1200);
    } catch { /* el navegador no deja copiar */ }
  };
  return (
    <dl className="name-triple">
      {LANGS.map(lang => (
        <div key={lang}>
          <dt>{t(`lang.${lang}` as const)}</dt>
          <dd>
            <span lang={lang === 'zh' ? 'zh-Hans' : lang}>{names[lang] ?? '—'}</span>
            {lang === 'zh' && pinyin && <span className="pinyin">{pinyin}</span>}
            {names[lang] && (
              <button className="copy-btn" onClick={() => copy(lang, names[lang]!)} title={t('tr.copy')} aria-label={`${t('tr.copy')}: ${names[lang]}`}>
                {copied === lang ? '✓' : '⧉'}
              </button>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Descripción en el idioma actual, avisando si no está traducida. */
// Webs de las que salen los textos que PokeAPI no trae (licencia CC BY-NC-SA en las wikis: hay que citarlas)
export const SOURCES: Record<Source, { name: string; url: string; cc?: true }> = {
  w52: { name: '52poké Wiki', url: 'https://wiki.52poke.com', cc: true },
  wdx: { name: 'WikiDex', url: 'https://www.wikidex.net', cc: true },
  pdb: { name: 'Pokémon Database', url: 'https://pokemondb.net' },
  ser: { name: 'Serebii', url: 'https://www.serebii.net' },
  pcn: { name: '宝可梦中国官网', url: 'https://www.pokemon.cn' },
  pos: { name: 'Pokéos', url: 'https://www.pokeos.com' },
  api: { name: 'PokeAPI', url: 'https://pokeapi.co' },
};

export function Desc({ text, src }: { text: L | undefined; src?: Src }) {
  const { nl, t, lang } = useI18n();
  if (!text || !Object.keys(text).length) return <p className="muted">{t('noDescription')}</p>;
  const r = nl(text);
  const source = src?.[r.lang ?? lang];
  return (
    <div className="desc">
      <p lang={r.lang === 'zh' ? 'zh-Hans' : r.lang ?? undefined}>{r.text}</p>
      {r.lang && r.lang !== lang && <p className="fallback-note">{t('fallbackNote', { lang: t(`lang.${r.lang}` as const) })}</p>}
      {source && (
        <p className="fallback-note">
          {t('sourceNote')} <a href={SOURCES[source].url} target="_blank" rel="noreferrer">{SOURCES[source].name}</a>
        </p>
      )}
    </div>
  );
}

export function Section({ title, children, id, aside }: { title: ReactNode; children: ReactNode; id?: string; aside?: ReactNode }) {
  return (
    <section className="card section" id={id}>
      <div className="section-head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function PokemonCard({ p, showFav = false }: { p: Pokemon; showFav?: boolean }) {
  const { n } = useI18n();
  const { isFav } = useFavorites();
  return (
    <Link to={`/pokemon/${p.id}`} className="poke-card">
      <Sprite id={p.id} size={72} alt="" />
      <span className="poke-num">{dexNumber(p.sp)}</span>
      <span className="poke-name">{n(p.n)}</span>
      <Types ids={p.t} small link={false} />
      {showFav && isFav(p.id) && <span className="fav-dot" aria-hidden>★</span>}
    </Link>
  );
}

/** Enlace pequeño a un Pokémon: sprite + nombre. */
export function PokemonChip({ p, note }: { p: Pokemon; note?: ReactNode }) {
  const { n } = useI18n();
  return (
    <Link to={`/pokemon/${p.id}`} className="poke-chip">
      <Sprite id={p.id} size={40} />
      <span>{n(p.n)}</span>
      {note != null && <span className="chip-note">{note}</span>}
    </Link>
  );
}

export function FavButton({ id }: { id: number }) {
  const { t } = useI18n();
  const { isFav, toggle } = useFavorites();
  const on = isFav(id);
  return (
    <button className={'btn icon-btn' + (on ? ' active' : '')} onClick={() => toggle(id)} aria-pressed={on} title={on ? t('pk.favRemove') : t('pk.favAdd')}>
      <span aria-hidden>{on ? '★' : '☆'}</span> <span className="btn-label">{on ? t('pk.favRemove') : t('pk.favAdd')}</span>
    </button>
  );
}

export function Chips<T extends string | number>({ options, value, onChange, label }: {
  options: { value: T; label: ReactNode; className?: string }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map(o => (
        <button key={String(o.value)} className={'chip ' + (o.className ?? '') + (o.value === value ? ' active' : '')} aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
