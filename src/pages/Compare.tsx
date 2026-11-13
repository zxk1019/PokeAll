import { useDb } from '../lib/data';
import { useI18n, type Key } from '../lib/i18n';
import { Link, useQueryParam } from '../lib/router';
import { defensiveChart, formatHeight, formatWeight, statColor, total } from '../lib/pokemon';
import { Artwork, Section, Status, TypeBadge, Types } from '../components/ui';
import { SearchBox } from '../components/SearchBox';

const MAX = 4;

export function ComparePage() {
  const { data: db, error } = useDb();
  const { t, n } = useI18n();
  const [idsParam, setIds] = useQueryParam('ids');
  if (!db) return <Status error={error} />;

  const ids = idsParam.split(',').map(Number).filter(id => db.pokemon.has(id)).slice(0, MAX);
  const mons = ids.map(id => db.pokemon.get(id)!);
  const add = (id: number) => { if (!ids.includes(id) && ids.length < MAX) setIds([...ids, id].join(',')); };
  const remove = (id: number) => setIds(ids.filter(x => x !== id).join(','));

  const best = (values: number[]) => { const m = Math.max(...values); return values.map(v => mons.length > 1 && v === m); };
  const totals = mons.map(total);

  return (
    <div className="page">
      <h1>{t('cmp.title')}</h1>
      <p className="muted">{t('cmp.hint')}</p>
      {ids.length < MAX && (
        <div className="picker">
          <SearchBox kinds={['p']} placeholder={t('cmp.add')} onPick={e => add(e.id)} />
        </div>
      )}

      {mons.length > 0 && (
        <Section title={t('pk.stats')}>
          <div className="table-wrap">
            <table className="table compare">
              <thead>
                <tr>
                  <th />
                  {mons.map(p => (
                    <th key={p.id} className="compare-head">
                      <Link to={`/pokemon/${p.id}`}><Artwork id={p.id} size={110} /><span>{n(p.n)}</span></Link>
                      <button className="btn small" onClick={() => remove(p.id)} aria-label={`${t('cmp.remove')} ${n(p.n)}`}>✕</button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>{t('col.type')}</th>
                  {mons.map(p => <td key={p.id}><Types ids={p.t} small /></td>)}
                </tr>
                <tr>
                  <th>{t('pk.abilities')}</th>
                  {mons.map(p => (
                    <td key={p.id} className="small">
                      {!p.ab.length && <span className="muted">{t('pk.abilityUnknown')}</span>}
                      {p.ab.map(([aid, hidden]) => (
                        <div key={aid}><Link to={`/ability/${aid}`}>{n(db.abilities.get(aid)?.n)}</Link>{hidden ? <span className="muted"> ({t('pk.hidden')})</span> : null}</div>
                      ))}
                    </td>
                  ))}
                </tr>
                {[0, 1, 2, 3, 4, 5].map(i => {
                  const vals = mons.map(p => p.s[i]);
                  const b = best(vals);
                  return (
                    <tr key={i}>
                      <th>{t(`stat.${i}` as Key)}</th>
                      {mons.map((p, j) => (
                        <td key={p.id} className={b[j] ? 'best' : ''}>
                          <span className="cmp-stat">
                            <span className="stat-val">{p.s[i]}</span>
                            <span className="stat-bar"><span style={{ width: `${(p.s[i] / 255) * 100}%`, background: statColor(p.s[i]) }} /></span>
                          </span>
                        </td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="total-row">
                  <th>{t('pk.total')}</th>
                  {mons.map((p, j) => <td key={p.id} className={best(totals)[j] ? 'best' : ''}><strong>{totals[j]}</strong></td>)}
                </tr>
                <tr>
                  <th>{t('pk.height')} / {t('pk.weight')}</th>
                  {mons.map(p => <td key={p.id} className="small">{formatHeight(p.h)} · {formatWeight(p.w)}</td>)}
                </tr>
                <tr>
                  <th>{t('ty.weakTo')}</th>
                  {mons.map(p => (
                    <td key={p.id}>
                      <span className="types">
                        {defensiveChart(db.meta, p.t).filter(c => c.mult > 1).map(c => (
                          <span key={c.type} className="weak-chip"><TypeBadge id={c.type} small />{c.mult === 4 && <b>×4</b>}</span>
                        ))}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}
