import { useMemo, type ReactNode } from 'react';
import { useAbilityEffects, useDb, type AbilityEffect } from '../lib/data';
import { useI18n, type Key } from '../lib/i18n';
import { Link, useQueryParam } from '../lib/router';
import { search } from '../lib/search';
import { Chips, Desc, NameTriple, PokemonChip, Section, SourceLink, Status } from '../components/ui';

export function AbilitiesPage() {
  const { data: db, error } = useDb();
  const { t, n, lang } = useI18n();
  const [q, setQ] = useQueryParam('q');
  const [gen, setGen] = useQueryParam('gen');
  const [ex, setEx] = useQueryParam('ex');

  const list = useMemo(() => {
    if (!db) return [];
    const ids = q.trim() ? new Set(search(db.search, q, { kinds: ['a'], limit: 5000 }).map(e => e.id)) : null;
    const collator = new Intl.Collator(lang === 'zh' ? 'zh-Hans-u-co-pinyin' : lang);
    return db.abilityList
      .filter(a => (!ids || ids.has(a.id)) && (!gen || a.gen === Number(gen)) && (!ex || a.ex))
      .sort((a, b) => collator.compare(n(a.n), n(b.n)));
  }, [db, q, gen, ex, lang, n]);

  if (!db) return <Status error={error} />;

  return (
    <div className="page">
      <h1>{t('nav.abilities')}</h1>
      <div className="filters card">
        <input type="search" className="input" value={q} onChange={e => setQ(e.target.value)} placeholder={t('ab.filter')} aria-label={t('ab.filter')} />
        <div className="filter-row">
          <span className="filter-label">{t('dex.gen')}</span>
          <Chips label={t('dex.gen')} value={gen} onChange={setGen}
            options={[{ value: '', label: t('all') }, ...db.meta.generations.filter(g => g.id >= 3).map(g => ({ value: String(g.id), label: String(g.id) }))]} />
        </div>
        <div className="filter-row wrap">
          <label className="check"><input type="checkbox" checked={!!ex} onChange={e => setEx(e.target.checked ? '1' : '')} /> ★ {t('ab.onlyExclusive')}</label>
          {(q || gen || ex) && <a className="link-btn" href="#/abilities">{t('clear')}</a>}
        </div>
      </div>
      <p className="muted count">{t('ab.count', { n: list.length })}</p>
      <ul className="row-list">
        {list.map(a => {
          const holders = db.abilityHolders.get(a.id) ?? [];
          const species = new Set(holders.map(h => h.p.sp)).size;
          return (
            <li key={a.id}>
              <Link to={`/ability/${a.id}`} className="row-link">
                <span className="row-main">
                  <span className="row-title">
                    {n(a.n)} {a.ex && <span className="tag gold">★ {t(`ab.ex.${a.ex}` as Key)}</span>}
                  </span>
                  <span className="row-sub">{n(a.d)}</span>
                </span>
                <span className="row-side muted small">{species} {t('col.pokemon')}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function AbilityPage({ id }: { id: number }) {
  const { data: db, error } = useDb();
  const { t, n } = useI18n();
  if (!db) return <Status error={error} />;
  const a = db.abilities.get(id);
  if (!a) return <div className="page narrow center"><p>{t('ab.notFound')}</p><Link to="/abilities" className="btn">{t('nav.abilities')}</Link></div>;
  const holders = (db.abilityHolders.get(id) ?? []).slice().sort((x, y) => x.p.sp - y.p.sp || x.p.id - y.p.id);
  const normal = holders.filter(h => !h.hidden);
  const hidden = holders.filter(h => h.hidden);
  const entry = db.search.find(e => e.kind === 'a' && e.id === id);

  return (
    <div className="page narrow">
      <p className="breadcrumb"><Link to="/abilities">{t('nav.abilities')}</Link></p>
      <div className="card detail-head">
        <div>
          <h1>{n(a.n)} {a.ex && <span className="tag gold big-tag">★ {t(`ab.ex.${a.ex}` as Key)}</span>}</h1>
          <NameTriple names={a.n} pinyin={entry?.pinyin} />
        </div>
      </div>
      <Section title={t('col.description')}>
        <Desc text={a.d} src={a.src} />
        <dl className="facts">
          <div><dt>{t('pk.generation')}</dt><dd>{n(db.meta.generations[a.gen - 1]?.n)}</dd></div>
        </dl>
        {a.ex && <p className="note gold-note">★ {t(`ab.ex.${a.ex}.long` as Key)}</p>}
      </Section>
      <Section title={t('ab.effect')}>
        <EffectText id={id} />
      </Section>
      <Section title={t('ab.holders')}>
        {holders.length === 0 && <p className="muted">{t('ab.none')}</p>}
        {normal.length > 0 && (
          <>
            <h3>{t('ab.asNormal')} <span className="muted small">({normal.length})</span></h3>
            <div className="chip-list">{normal.map(h => <PokemonChip key={h.p.id} p={h.p} />)}</div>
          </>
        )}
        {hidden.length > 0 && (
          <>
            <h3>{t('ab.asHidden')} <span className="muted small">({hidden.length})</span></h3>
            <div className="chip-list">{hidden.map(h => <PokemonChip key={h.p.id} p={h.p} />)}</div>
          </>
        )}
      </Section>
    </div>
  );
}

/** Efecto detallado (de las wikis): "# título", "## etiqueta", "• punto" o un párrafo por línea */
function EffectText({ id }: { id: number }) {
  const { data: effects, error } = useAbilityEffects();
  const { t, nl, lang } = useI18n();
  if (!effects) return <Status error={error} />;
  const e: AbilityEffect | undefined = effects[id];
  const { src, ...texts } = e ?? { src: {} };
  if (!Object.keys(texts).length) return <p className="muted">{t('ab.noEffect')}</p>;
  const r = nl(texts);
  const source = src[r.lang ?? lang];
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) blocks.push(<ul key={blocks.length}>{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>);
    bullets = [];
  };
  for (const line of r.text.split('\n')) {
    if (line.startsWith('• ')) { bullets.push(line.slice(2)); continue; }
    flush();
    if (line.startsWith('# ')) blocks.push(<h3 key={blocks.length}>{line.slice(2)}</h3>);
    else if (line.startsWith('## ')) blocks.push(<p key={blocks.length} className="effect-label">{line.slice(3)}</p>);
    else blocks.push(<p key={blocks.length}>{line}</p>);
  }
  flush();
  return (
    <div className="desc effect" lang={r.lang === 'zh' ? 'zh-Hans' : r.lang ?? undefined}>
      {blocks}
      {r.lang && r.lang !== lang && <p className="fallback-note">{t('fallbackNote', { lang: t(`lang.${r.lang}` as const) })}</p>}
      {source && (
        <p className="fallback-note">
          {t('ab.effectBy')} <SourceLink source={source} />
        </p>
      )}
    </div>
  );
}
