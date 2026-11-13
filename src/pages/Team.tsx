import { useState } from 'react';
import { useDb } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { Link, navigate, useLocation } from '../lib/router';
import { TEAM_SIZE, useTeam } from '../lib/storage';
import { effectiveness, multLabel } from '../lib/pokemon';
import { Section, Sprite, Status, TypeBadge, Types } from '../components/ui';
import { SearchBox } from '../components/SearchBox';

export function TeamPage() {
  const { data: db, error } = useDb();
  const { t, n } = useI18n();
  const { query } = useLocation();
  const { team, setTeam, add } = useTeam();
  const [copied, setCopied] = useState(false);
  if (!db) return <Status error={error} />;

  // Un equipo compartido llega como #/team?ids=1,4,7
  const sharedIds = (query.get('ids') ?? '').split(',').map(Number).filter(id => db.pokemon.has(id)).slice(0, TEAM_SIZE);
  const viewingShared = sharedIds.length > 0 && sharedIds.join(',') !== team.join(',');
  const ids = viewingShared ? sharedIds : team.filter(id => db.pokemon.has(id));
  const members = ids.map(id => db.pokemon.get(id)!);

  const remove = (i: number) => setTeam(team.filter((_, j) => j !== i));
  const share = async () => {
    const url = `${location.origin}${location.pathname}#/team?ids=${team.join(',')}`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* sin portapapeles */ }
  };

  const rows = db.meta.types.map(ty => {
    const mults = members.map(p => effectiveness(db.meta, ty.id, p.t));
    const weak = mults.filter(m => m > 1).length;
    const resist = mults.filter(m => m < 1).length;
    return { ty, mults, weak, resist, danger: weak - resist >= 2 || (weak >= 2 && resist === 0) };
  });
  const stabTypes = [...new Set(members.flatMap(p => p.t))];
  const covered = db.meta.types.filter(d => stabTypes.some(a => effectiveness(db.meta, a, [d.id]) > 1));
  const uncovered = db.meta.types.filter(d => !covered.includes(d));

  return (
    <div className="page">
      <h1>{t('team.title')}</h1>
      <p className="muted">{t('team.hint')}</p>

      {viewingShared && (
        <div className="note card">
          {t('team.shared')}{' '}
          <button className="btn primary" onClick={() => { setTeam(sharedIds); navigate('/team', true); }}>{t('team.load')}</button>
        </div>
      )}

      {!viewingShared && team.length < TEAM_SIZE && (
        <div className="picker">
          <SearchBox kinds={['p']} placeholder={t('team.add')} onPick={e => add(e.id)} />
        </div>
      )}

      <div className="team-slots">
        {Array.from({ length: TEAM_SIZE }, (_, i) => {
          const p = members[i];
          if (!p) return <div key={i} className="team-slot empty" aria-hidden>+</div>;
          return (
            <div key={i} className="team-slot card">
              {!viewingShared && <button className="slot-remove" onClick={() => remove(i)} aria-label={`✕ ${n(p.n)}`}>✕</button>}
              <Link to={`/pokemon/${p.id}`} className="slot-link">
                <Sprite id={p.id} size={80} />
                <span className="poke-name">{n(p.n)}</span>
              </Link>
              <Types ids={p.t} small />
            </div>
          );
        })}
      </div>

      {members.length === 0 ? <p className="empty">{t('team.empty')}</p> : (
        <>
          {!viewingShared && (
            <div className="actions">
              <button className="btn" onClick={share}>🔗 {copied ? t('tr.copied') : t('team.share')}</button>
              <button className="btn" onClick={() => setTeam([])}>{t('team.clear')}</button>
            </div>
          )}

          <Section title={t('team.defense')}>
            <p className="muted small">{t('team.defenseHint')}</p>
            <div className="table-wrap">
              <table className="table team-table">
                <thead>
                  <tr>
                    <th />
                    {members.map((p, i) => <th key={i} title={n(p.n)}><Sprite id={p.id} size={40} /></th>)}
                    <th className="num">{t('team.weak')}</th>
                    <th className="num">{t('team.resist')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.ty.id} className={r.danger ? 'danger' : ''}>
                      <th><TypeBadge id={r.ty.id} small /></th>
                      {r.mults.map((m, i) => <td key={i} className={`mult-cell f${String(m).replace('.', '')}`}>{m === 1 ? '' : '×' + multLabel(m)}</td>)}
                      <td className="num strong">{r.weak || ''}</td>
                      <td className="num">{r.resist || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title={t('team.offense')}>
            <p className="muted small">{t('team.offenseHint')}</p>
            <h3>{t('team.covered')} ({covered.length}/18)</h3>
            <div className="types">{covered.map(ty => <TypeBadge key={ty.id} id={ty.id} small />)}</div>
            <h3>{t('team.uncovered')} ({uncovered.length})</h3>
            <div className="types">{uncovered.length ? uncovered.map(ty => <TypeBadge key={ty.id} id={ty.id} small />) : <span className="muted">{t('none')}</span>}</div>
          </Section>
        </>
      )}
    </div>
  );
}
