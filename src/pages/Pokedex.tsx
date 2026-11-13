import { useMemo } from 'react';
import { useDb, type Pokemon } from '../lib/data';
import { useI18n, type Key } from '../lib/i18n';
import { useQueryParam } from '../lib/router';
import { search } from '../lib/search';
import { useFavorites } from '../lib/storage';
import { total, typeSlug } from '../lib/pokemon';
import { Chips, PokemonCard, Status } from '../components/ui';

const SORTS = ['num', 'name', 'total', '0', '1', '2', '3', '4', '5'];

export function Pokedex() {
  const { data: db, error } = useDb();
  const { t, n, lang } = useI18n();
  const { favs } = useFavorites();
  const [q, setQ] = useQueryParam('q');
  const [gen, setGen] = useQueryParam('gen');
  const [typeParam, setTypes] = useQueryParam('type');
  const [sort, setSort] = useQueryParam('sort', 'num');
  const [forms, setForms] = useQueryParam('forms');
  const [onlyFavs, setOnlyFavs] = useQueryParam('favs');
  const [cat, setCat] = useQueryParam('cat');

  const types = typeParam ? typeParam.split(',').map(Number) : [];

  const list = useMemo(() => {
    if (!db) return [];
    let ids: Set<number> | null = null;
    if (q.trim()) ids = new Set(search(db.search, q, { kinds: ['p'], limit: 5000 }).map(e => e.id));
    const out = db.pokemonList.filter(p => {
      if (!forms && !p.def) return false;
      if (ids && !ids.has(p.id)) return false;
      if (gen && p.gen !== Number(gen)) return false;
      if (types.length && !types.every(tid => p.t.includes(tid))) return false;
      if (onlyFavs && !favs.includes(p.id)) return false;
      if (cat) {
        const s = db.species.get(p.sp)!;
        if (cat === 'leg' && !s.leg) return false;
        if (cat === 'myth' && !s.myth) return false;
        if (cat === 'baby' && !s.baby) return false;
        if (cat === 'normal' && (s.leg || s.myth || s.baby)) return false;
      }
      return true;
    });
    const collator = new Intl.Collator(lang === 'zh' ? 'zh-Hans-u-co-pinyin' : lang);
    const cmp: Record<string, (a: Pokemon, b: Pokemon) => number> = {
      num: (a, b) => a.sp - b.sp || a.id - b.id,
      name: (a, b) => collator.compare(n(a.n), n(b.n)),
      total: (a, b) => total(b) - total(a) || a.sp - b.sp,
    };
    const statIdx = Number(sort);
    const sorter = cmp[sort] ?? (Number.isInteger(statIdx) ? (a: Pokemon, b: Pokemon) => b.s[statIdx] - a.s[statIdx] || a.sp - b.sp : cmp.num);
    return out.sort(sorter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, q, gen, typeParam, sort, forms, onlyFavs, cat, favs.join(','), lang]);

  if (!db) return <Status error={error} />;

  const toggleType = (id: number) => {
    let next = types.includes(id) ? types.filter(x => x !== id) : [...types, id];
    if (next.length > 2) next = next.slice(-2);
    setTypes(next.join(','));
  };
  const hasFilters = q || gen || typeParam || forms || onlyFavs || cat;

  return (
    <div className="page">
      <h1>{t('nav.pokedex')}</h1>
      <div className="filters card">
        <input type="search" className="input" value={q} onChange={e => setQ(e.target.value)} placeholder={t('dex.filter')} aria-label={t('dex.filter')} />

        <div className="filter-row">
          <span className="filter-label">{t('dex.gen')}</span>
          <Chips
            label={t('dex.gen')}
            value={gen}
            onChange={setGen}
            options={[{ value: '', label: t('all') }, ...db.meta.generations.map(g => ({ value: String(g.id), label: <>{g.id}<span className="chip-sub"> {n(g.region)}</span></> }))]}
          />
        </div>

        <div className="filter-row">
          <span className="filter-label">{t('dex.type')}</span>
          <div className="chips" role="group" aria-label={t('dex.type')}>
            {db.meta.types.map(ty => (
              <button key={ty.id} className={`chip type-chip t-${typeSlug(ty.id)}` + (types.includes(ty.id) ? ' active' : '')} aria-pressed={types.includes(ty.id)} onClick={() => toggleType(ty.id)}>
                {n(ty.n)}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-row">
          <span className="filter-label">{t('dex.category')}</span>
          <Chips
            label={t('dex.category')}
            value={cat}
            onChange={setCat}
            options={[
              { value: '', label: t('all') },
              { value: 'normal', label: t('cat.normal') },
              { value: 'leg', label: t('cat.legendary') },
              { value: 'myth', label: t('cat.mythical') },
              { value: 'baby', label: t('cat.baby') },
            ]}
          />
        </div>

        <div className="filter-row wrap">
          <label className="select-label">
            {t('dex.sort')}{' '}
            <select value={sort} onChange={e => setSort(e.target.value)}>
              {SORTS.map(s => (
                <option key={s} value={s}>{/^\d$/.test(s) ? t(`stat.${s}` as Key) : t(`sort.${s === 'num' ? 'number' : s}` as Key)}</option>
              ))}
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={!!forms} onChange={e => setForms(e.target.checked ? '1' : '')} /> {t('dex.showForms')}</label>
          <label className="check"><input type="checkbox" checked={!!onlyFavs} onChange={e => setOnlyFavs(e.target.checked ? '1' : '')} /> ★ {t('dex.onlyFavs')}</label>
          {hasFilters && <a className="link-btn" href="#/pokedex">{t('clear')}</a>}
        </div>
      </div>

      <p className="muted count">{t('dex.count', { n: list.length })}</p>
      {list.length === 0 ? <p className="empty">{t('dex.empty')}</p> : (
        <div className="poke-grid">
          {list.map(p => <PokemonCard key={p.id} p={p} showFav />)}
        </div>
      )}
    </div>
  );
}
