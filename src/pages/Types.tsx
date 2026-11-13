import { useState } from 'react';
import { useDb } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { Link, useQueryParam } from '../lib/router';
import { multLabel, typeSlug } from '../lib/pokemon';
import { Section, Status, TypeBadge } from '../components/ui';
import { Weaknesses } from './PokemonPage';

export function TypesPage() {
  const { data: db, error } = useDb();
  const { t, n } = useI18n();
  const [selParam, setSel] = useQueryParam('sel');
  const [calcParam, setCalc] = useQueryParam('calc');
  const [hover, setHover] = useState<[number, number] | null>(null);

  if (!db) return <Status error={error} />;
  const { types, eff } = db.meta;
  const sel = Number(selParam) || 0;
  const calc = calcParam ? calcParam.split(',').map(Number).filter(x => x >= 1 && x <= 18) : [];

  const toggleCalc = (id: number) => {
    let next = calc.includes(id) ? calc.filter(x => x !== id) : [...calc, id];
    if (next.length > 2) next = next.slice(-2);
    setCalc(next.join(','));
  };

  const list = (ids: number[]) => ids.length ? <span className="types">{ids.map(id => <TypeBadge key={id} id={id} small />)}</span> : <span className="muted">{t('none')}</span>;
  const attacking = (f: number) => types.filter(d => eff[sel - 1][d.id - 1] === f).map(d => d.id);
  const defending = (f: number) => types.filter(a => eff[a.id - 1][sel - 1] === f).map(a => a.id);

  return (
    <div className="page">
      <h1>{t('ty.title')}</h1>
      <p className="muted">{t('ty.howTo')} {t('ty.clickHint')}</p>

      <div className="card type-chart-card">
        {/* Qué significa cada color */}
        <div className="ty-legend">
          {([[2, 'f2', 'ty.f2'], [0.5, 'f05', 'ty.f05'], [0, 'f0', 'ty.f0'], [1, 'f1', 'ty.f1']] as const).map(([m, cls, key]) => (
            <span key={cls} className="ty-legend-item">
              <span className={'ty-swatch ' + cls}>{m === 1 ? '' : multLabel(m)}</span>{t(key)} ×{multLabel(m)}
            </span>
          ))}
        </div>
        {/* La casilla señalada, explicada con palabras */}
        <p className="ty-readout" aria-live="polite">
          {hover ? (() => {
            const f = eff[hover[0] - 1][hover[1] - 1];
            return <><TypeBadge id={hover[0]} small link={false} /> → <TypeBadge id={hover[1]} small link={false} /> · <strong>{t(`ty.f${String(f).replace('.', '')}` as 'ty.f2')} ×{multLabel(f)}</strong></>;
          })() : <span className="muted">{t('ty.hoverHint')}</span>}
        </p>
        <div className="type-chart-wrap">
        <table className="type-chart" onMouseLeave={() => setHover(null)}>
          <thead>
            <tr>
              <th className="corner">{t('ty.corner')}</th>
              {types.map(d => (
                <th key={d.id} className={hover?.[1] === d.id ? 'hl' : ''} scope="col">
                  <button className={`type-head t-${typeSlug(d.id)}` + (sel === d.id ? ' active' : '')} onClick={() => setSel(sel === d.id ? '' : String(d.id))} title={n(d.n)}>
                    {n(d.n).slice(0, 3)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map(a => (
              <tr key={a.id} className={hover?.[0] === a.id ? 'hl' : ''}>
                <th>
                  <button className={`type-head row t-${typeSlug(a.id)}` + (sel === a.id ? ' active' : '')} onClick={() => setSel(sel === a.id ? '' : String(a.id))}>
                    {n(a.n)}
                  </button>
                </th>
                {types.map(d => {
                  const f = eff[a.id - 1][d.id - 1];
                  const isSel = sel && (sel === a.id || sel === d.id);
                  return (
                    <td
                      key={d.id}
                      className={`f${String(f).replace('.', '')}` + (hover?.[1] === d.id ? ' hl' : '') + (isSel ? ' sel' : '')}
                      onMouseEnter={() => setHover([a.id, d.id])}
                      onClick={() => setHover([a.id, d.id])}
                      title={`${n(a.n)} → ${n(d.n)}: ×${multLabel(f)}`}
                    >
                      {f === 1 ? '' : multLabel(f)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {sel > 0 && (
        <Section title={<TypeBadge id={sel} link={false} />} aside={<button className="btn small" onClick={() => setSel('')}>✕</button>}>
          <div className="two-col inner">
            <div>
              <h3>{t('ty.attacking')}</h3>
              <dl className="facts stacked">
                <div><dt>{t('ty.superEffective')} (×2)</dt><dd>{list(attacking(2))}</dd></div>
                <div><dt>{t('ty.notVery')} (×½)</dt><dd>{list(attacking(0.5))}</dd></div>
                <div><dt>{t('ty.noEffect')} (×0)</dt><dd>{list(attacking(0))}</dd></div>
              </dl>
            </div>
            <div>
              <h3>{t('ty.defending')}</h3>
              <dl className="facts stacked">
                <div><dt>{t('ty.weakTo')} (×2)</dt><dd>{list(defending(2))}</dd></div>
                <div><dt>{t('ty.resists')} (×½)</dt><dd>{list(defending(0.5))}</dd></div>
                <div><dt>{t('ty.immune')} (×0)</dt><dd>{list(defending(0))}</dd></div>
              </dl>
            </div>
          </div>
          <div className="actions">
            <Link className="btn" to={`/pokedex?type=${sel}`}>{t('ty.seePokemon')}</Link>
            <Link className="btn" to={`/moves?type=${sel}`}>{t('ty.seeMoves')}</Link>
          </div>
        </Section>
      )}

      <Section title={t('ty.calc')}>
        <p className="muted small">{t('ty.calcHint')}</p>
        <div className="chips">
          {types.map(ty => (
            <button key={ty.id} className={`chip type-chip t-${typeSlug(ty.id)}` + (calc.includes(ty.id) ? ' active' : '')} aria-pressed={calc.includes(ty.id)} onClick={() => toggleCalc(ty.id)}>
              {n(ty.n)}
            </button>
          ))}
        </div>
        {calc.length > 0 && <Weaknesses db={db} types={calc} />}
      </Section>
    </div>
  );
}
