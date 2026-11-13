import { useDb } from '../lib/data';
import { useI18n, LANGS, type Key } from '../lib/i18n';
import { useQueryParam } from '../lib/router';
import { Section, Status } from '../components/ui';

// En los datos: 2 ataque, 3 defensa, 4 at. esp., 5 def. esp., 6 velocidad. En la interfaz stat.1 ... stat.5
const STATS = [2, 3, 4, 5, 6];

export function NaturesPage() {
  const { data: db, error } = useDb();
  const { t, n, lang } = useI18n();
  const [sel, setSel] = useQueryParam('sel');
  if (!db) return <Status error={error} />;
  const natures = db.meta.natures;
  const statName = (id: number) => t(`stat.${id - 1}` as Key);
  const flavor = (id: number) => t(`flavor.${id}` as Key);

  return (
    <div className="page">
      <h1>{t('nav.natures')}</h1>
      <p className="muted">{t('nat.hint')}</p>

      <div className="card flush table-wrap">
        <table className="nature-matrix">
          <thead>
            <tr>
              <th className="corner">↑ {t('nat.up')} / ↓ {t('nat.down')}</th>
              {STATS.map(s => <th key={s}>↓ {statName(s)}</th>)}
            </tr>
          </thead>
          <tbody>
            {STATS.map(up => (
              <tr key={up}>
                <th>↑ {statName(up)}</th>
                {STATS.map(down => {
                  const nat = natures.find(x => x.up === up && x.down === down);
                  if (!nat) return <td key={down} />;
                  return (
                    <td key={down} className={(up === down ? 'neutral' : '') + (sel === String(nat.id) ? ' sel' : '')}>
                      <button className="link-btn" onClick={() => setSel(sel === String(nat.id) ? '' : String(nat.id))}>{n(nat.n)}</button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Section title={t('nav.natures')}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {LANGS.map(l => <th key={l}>{t(`lang.${l}` as Key)}</th>)}
                <th>{t('nat.up')}</th>
                <th>{t('nat.down')}</th>
                <th>{t('nat.likes')}</th>
                <th>{t('nat.hates')}</th>
              </tr>
            </thead>
            <tbody>
              {natures.map(nat => {
                const neutral = nat.up === nat.down;
                return (
                  <tr key={nat.id} className={sel === String(nat.id) ? 'sel' : ''} id={`nature-${nat.id}`}>
                    {LANGS.map(l => <td key={l} className={l === lang ? 'strong' : ''} lang={l === 'zh' ? 'zh-Hans' : l}>{nat.n[l] ?? '—'}</td>)}
                    <td className={neutral ? 'muted' : 'up'}>{neutral ? t('nat.neutral') : '↑ ' + statName(nat.up)}</td>
                    <td className={neutral ? 'muted' : 'down'}>{neutral ? '—' : '↓ ' + statName(nat.down)}</td>
                    <td>{neutral ? '—' : flavor(nat.likes)}</td>
                    <td>{neutral ? '—' : flavor(nat.hates)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}
