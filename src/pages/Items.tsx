import { useMemo } from 'react';
import { useDb } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { Link, useQueryParam } from '../lib/router';
import { search } from '../lib/search';
import { defaultPokemon } from '../lib/pokemon';
import { Desc, ItemIcon, NameTriple, PokemonChip, Section, Status, TypeBadge } from '../components/ui';
import { MoveClass } from '../components/Learnset';

export function ItemsPage() {
  const { data: db, error } = useDb();
  const { t, n } = useI18n();
  const [q, setQ] = useQueryParam('q');
  const [pocket, setPocket] = useQueryParam('pocket');
  const [cat, setCat] = useQueryParam('cat');

  const list = useMemo(() => {
    if (!db) return [];
    const ids = q.trim() ? new Set(search(db.search, q, { kinds: ['i'], limit: 5000 }).map(e => e.id)) : null;
    return db.itemList.filter(it => {
      const c = db.meta.itemCats[it.cat];
      if (pocket && String(c?.pocket) !== pocket) return false;
      if (cat && String(it.cat) !== cat) return false;
      if (ids && !ids.has(it.id)) return false;
      return true;
    });
  }, [db, q, pocket, cat]);

  if (!db) return <Status error={error} />;

  const cats = Object.entries(db.meta.itemCats)
    .filter(([, c]) => !pocket || String(c.pocket) === pocket)
    .sort((a, b) => n(a[1].n).localeCompare(n(b[1].n)));

  return (
    <div className="page">
      <h1>{t('nav.items')}</h1>
      <div className="filters card">
        <input type="search" className="input" value={q} onChange={e => setQ(e.target.value)} placeholder={t('items.filter')} aria-label={t('items.filter')} />
        <div className="filter-row wrap">
          <label className="select-label">
            {t('item.pocket')}{' '}
            <select value={pocket} onChange={e => { setPocket(e.target.value); setCat(''); }}>
              <option value="">{t('items.allPockets')}</option>
              {Object.entries(db.meta.pockets).map(([id, name]) => <option key={id} value={id}>{n(name)}</option>)}
            </select>
          </label>
          <label className="select-label">
            {t('item.category')}{' '}
            <select value={cat} onChange={e => setCat(e.target.value)}>
              <option value="">{t('items.allCats')}</option>
              {cats.map(([id, c]) => <option key={id} value={id}>{n(c.n)}</option>)}
            </select>
          </label>
          {(q || pocket || cat) && <a className="link-btn" href="#/items">{t('clear')}</a>}
        </div>
      </div>
      <p className="muted count">{t('items.count', { n: list.length })}</p>
      <ul className="row-list">
        {list.map(it => (
          <li key={it.id}>
            <Link to={`/item/${it.id}`} className="row-link">
              <ItemIcon slug={it.slug} />
              <span className="row-main">
                <span className="row-title">{n(it.n)}</span>
                <span className="row-sub">{n(it.d) !== '?' ? n(it.d) : n(db.meta.itemCats[it.cat]?.n)}</span>
              </span>
              <span className="row-side muted small">{n(db.meta.itemCats[it.cat]?.n)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ItemPage({ id }: { id: number }) {
  const { data: db, error } = useDb();
  const { t, n } = useI18n();
  if (!db) return <Status error={error} />;
  const it = db.items.get(id);
  if (!it) return <div className="page narrow center"><p>{t('item.notFound')}</p><Link to="/items" className="btn">{t('nav.items')}</Link></div>;
  const cat = db.meta.itemCats[it.cat];
  const entry = db.search.find(e => e.kind === 'i' && e.id === id);
  const move = it.tm ? db.moves.get(it.tm) : undefined;

  return (
    <div className="page narrow">
      <p className="breadcrumb"><Link to="/items">{t('nav.items')}</Link> / <Link to={`/items?cat=${it.cat}`}>{n(cat?.n)}</Link></p>
      <div className="card detail-head">
        <ItemIcon slug={it.slug} size={64} />
        <div>
          <h1>{n(it.n)}</h1>
          <NameTriple names={it.n} pinyin={entry?.pinyin} />
        </div>
      </div>

      <Section title={t('col.description')}>
        {/* Las MT no traen texto propio: en el juego enseñan el del movimiento */}
        <Desc text={move ? { ...move.d, ...it.d } : it.d} src={move ? { ...move.src, ...it.src } : it.src} />
        <dl className="facts">
          <div><dt>{t('item.category')}</dt><dd>{n(cat?.n)}</dd></div>
          <div><dt>{t('item.pocket')}</dt><dd>{n(db.meta.pockets[cat?.pocket ?? 0])}</dd></div>
          {it.cost > 0 && <div><dt>{t('item.price')}</dt><dd>₽ {it.cost.toLocaleString()}</dd></div>}
          {it.fling != null && <div><dt>{t('item.fling')}</dt><dd>{it.fling}</dd></div>}
        </dl>
      </Section>

      {move && (
        <Section title={t('item.teaches')}>
          <Link to={`/move/${move.id}`} className="row-link">
            <span className="row-main">
              <span className="row-title">{n(move.n)}</span>
              <span className="row-sub">{n(move.d)}</span>
            </span>
            <TypeBadge id={move.t} small link={false} />
            <MoveClass c={move.c} />
          </Link>
        </Section>
      )}

      {it.evo && (
        <Section title={t('item.evolves')}>
          <div className="chip-list">
            {it.evo.map(sid => { const p = defaultPokemon(db, sid); return p ? <PokemonChip key={sid} p={p} /> : null; })}
          </div>
        </Section>
      )}

      {it.held && (
        <Section title={t('item.heldBy')}>
          <div className="chip-list">
            {it.held.map(pid => { const p = db.pokemon.get(pid); return p ? <PokemonChip key={pid} p={p} /> : null; })}
          </div>
        </Section>
      )}
    </div>
  );
}
