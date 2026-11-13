import { useMemo } from 'react';
import { useDb, useLearnsets, type Move, type Pokemon } from '../lib/data';
import { useI18n, type Key } from '../lib/i18n';
import { Link, useQueryParam } from '../lib/router';
import { search } from '../lib/search';
import { typeSlug } from '../lib/pokemon';
import { Desc, NameTriple, PokemonChip, Section, Status, TypeBadge } from '../components/ui';
import { MoveClass } from '../components/Learnset';

const SORTS = ['name', 'power', 'accuracy', 'pp'] as const;

export function MovesPage() {
  const { data: db, error } = useDb();
  const { t, n, lang } = useI18n();
  const [q, setQ] = useQueryParam('q');
  const [type, setType] = useQueryParam('type');
  const [cls, setCls] = useQueryParam('class');
  const [gen, setGen] = useQueryParam('gen');
  const [sort, setSort] = useQueryParam('sort', 'name');

  const list = useMemo(() => {
    if (!db) return [];
    const ids = q.trim() ? new Set(search(db.search, q, { kinds: ['m'], limit: 5000 }).map(e => e.id)) : null;
    const collator = new Intl.Collator(lang === 'zh' ? 'zh-Hans-u-co-pinyin' : lang);
    const cmp: Record<string, (a: Move, b: Move) => number> = {
      name: (a, b) => collator.compare(n(a.n), n(b.n)),
      power: (a, b) => (b.p ?? -1) - (a.p ?? -1),
      accuracy: (a, b) => (b.a ?? 101) - (a.a ?? 101),
      pp: (a, b) => (b.pp ?? 0) - (a.pp ?? 0),
    };
    return db.moveList
      .filter(m => (!ids || ids.has(m.id)) && (!type || m.t === Number(type)) && (!cls || m.c === Number(cls)) && (!gen || m.gen === Number(gen)))
      .sort((a, b) => (cmp[sort] ?? cmp.name)(a, b) || cmp.name(a, b));
  }, [db, q, type, cls, gen, sort, lang, n]);

  if (!db) return <Status error={error} />;

  return (
    <div className="page">
      <h1>{t('nav.moves')}</h1>
      <div className="filters card">
        <input type="search" className="input" value={q} onChange={e => setQ(e.target.value)} placeholder={t('mv.filter')} aria-label={t('mv.filter')} />
        <div className="filter-row wrap">
          <label className="select-label">
            {t('col.type')}{' '}
            <select value={type} onChange={e => setType(e.target.value)}>
              <option value="">{t('mv.allTypes')}</option>
              {db.meta.types.map(ty => <option key={ty.id} value={ty.id}>{n(ty.n)}</option>)}
            </select>
          </label>
          <label className="select-label">
            {t('col.class')}{' '}
            <select value={cls} onChange={e => setCls(e.target.value)}>
              <option value="">{t('mv.allClasses')}</option>
              {[2, 3, 1].map(c => <option key={c} value={c}>{t(`class.${c}` as Key)}</option>)}
            </select>
          </label>
          <label className="select-label">
            {t('dex.gen')}{' '}
            <select value={gen} onChange={e => setGen(e.target.value)}>
              <option value="">{t('all')}</option>
              {db.meta.generations.map(g => <option key={g.id} value={g.id}>{g.id}</option>)}
            </select>
          </label>
          <label className="select-label">
            {t('dex.sort')}{' '}
            <select value={sort} onChange={e => setSort(e.target.value)}>
              {SORTS.map(s => <option key={s} value={s}>{t(s === 'name' ? 'col.name' : `col.${s}` as Key)}</option>)}
            </select>
          </label>
          {(q || type || cls || gen || sort !== 'name') && <a className="link-btn" href="#/moves">{t('clear')}</a>}
        </div>
      </div>
      <p className="muted count">{t('mv.count', { n: list.length })}</p>
      <div className="table-wrap card flush">
        <table className="table moves-table">
          <thead>
            <tr>
              <th>{t('col.name')}</th>
              <th>{t('col.type')}</th>
              <th>{t('col.class')}</th>
              <th className="num">{t('col.power')}</th>
              <th className="num">{t('col.accuracy')}</th>
              <th className="num">{t('col.pp')}</th>
              <th className="num hide-sm">{t('col.gen')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map(m => (
              <tr key={m.id}>
                <td>
                  <Link to={`/move/${m.id}`}>{n(m.n)}</Link>
                  <span className="cell-sub">{n(m.d)}</span>
                </td>
                <td><TypeBadge id={m.t} small /></td>
                <td><MoveClass c={m.c} /></td>
                <td className="num">{m.p ?? '—'}</td>
                <td className="num">{m.a ?? '—'}</td>
                <td className="num">{m.pp ?? '—'}</td>
                <td className="num hide-sm">{m.gen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MovePage({ id }: { id: number }) {
  const { data: db, error } = useDb();
  const { data: learnsets } = useLearnsets();
  const { t, n } = useI18n();

  const learners = useMemo(() => {
    if (!db || !learnsets) return null;
    const byMethod = new Map<number, { p: Pokemon; lvl: number }[]>();
    for (const [pid, ls] of Object.entries(learnsets)) {
      const p = db.pokemon.get(Number(pid));
      if (!p) continue;
      const seen = new Set<number>();
      for (const [mid, method, lvl] of ls.m) {
        if (mid !== id || seen.has(method)) continue;
        seen.add(method);
        if (!byMethod.has(method)) byMethod.set(method, []);
        byMethod.get(method)!.push({ p, lvl });
      }
    }
    for (const list of byMethod.values()) list.sort((a, b) => a.p.sp - b.p.sp || a.p.id - b.p.id);
    return byMethod;
  }, [db, learnsets, id]);

  if (!db) return <Status error={error} />;
  const m = db.moves.get(id);
  if (!m) return <div className="page narrow center"><p>{t('mv.notFound')}</p><Link to="/moves" className="btn">{t('nav.moves')}</Link></div>;
  const entry = db.search.find(e => e.kind === 'm' && e.id === id);
  const tm = m.tm ? db.items.get(m.tm) : undefined;

  return (
    <div className="page narrow">
      <p className="breadcrumb"><Link to="/moves">{t('nav.moves')}</Link> / <Link to={`/moves?type=${m.t}`}>{n(db.meta.types[m.t - 1].n)}</Link></p>
      <div className={`card detail-head move-head t-${typeSlug(m.t)}`}>
        <div>
          <h1>{n(m.n)}</h1>
          <NameTriple names={m.n} pinyin={entry?.pinyin} />
        </div>
      </div>
      <Section title={t('col.description')}>
        <Desc text={m.d} src={m.src} />
        <dl className="facts">
          <div><dt>{t('col.type')}</dt><dd><TypeBadge id={m.t} /></dd></div>
          <div><dt>{t('col.class')}</dt><dd><MoveClass c={m.c} /></dd></div>
          <div><dt>{t('col.power')}</dt><dd>{m.p ?? '—'}</dd></div>
          <div><dt>{t('col.accuracy')}</dt><dd>{m.a ?? '—'}</dd></div>
          <div><dt>{t('col.pp')}</dt><dd>{m.pp ?? '—'}</dd></div>
          <div><dt>{t('col.priority')}</dt><dd>{m.pr > 0 ? '+' + m.pr : m.pr}</dd></div>
          {m.ec != null && <div><dt>{t('mv.effectChance')}</dt><dd>{m.ec}%</dd></div>}
          <div><dt>{t('pk.generation')}</dt><dd>{n(db.meta.generations[m.gen - 1]?.n)}</dd></div>
          {tm && <div><dt>{t('method.4')}</dt><dd><Link to={`/item/${tm.id}`}>{n(tm.n)}</Link></dd></div>}
        </dl>
      </Section>
      <Section title={t('mv.learners')}>
        {!learners ? <Status /> : learners.size === 0 ? <p className="muted">{t('mv.none')}</p> : (
          <>
            {[1, 4, 2, 3].filter(k => learners.has(k)).map(k => (
              <div key={k}>
                <h3>{t(`method.${k}` as Key)} <span className="muted small">({learners.get(k)!.length})</span></h3>
                <div className="chip-list">
                  {learners.get(k)!.map(({ p, lvl }) => (
                    <PokemonChip key={p.id} p={p} note={k === 1 ? (lvl === 0 ? t('learn.evo') : `${t('col.level')} ${lvl}`) : undefined} />
                  ))}
                </div>
              </div>
            ))}
            <p className="muted small">{t('mv.learnersNote')}</p>
          </>
        )}
      </Section>
    </div>
  );
}
