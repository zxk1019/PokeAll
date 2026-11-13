import { useEffect, useMemo, useState } from 'react';
import { useDb, type Pokemon } from '../../lib/data';
import { useI18n, type Key } from '../../lib/i18n';
import { Link } from '../../lib/router';
import { useStored } from '../../lib/storage';
import { formatHeight, formatWeight, randomInt, total } from '../../lib/pokemon';
import { Artwork, Status, Types } from '../../components/ui';

// Qué se compara en cada ronda: las 6 estadísticas, el total, el peso y la altura
const STATS: { key: Key; get: (p: Pokemon) => number; show?: (v: number) => string }[] = [
  ...[0, 1, 2, 3, 4, 5].map(i => ({ key: `stat.${i}` as Key, get: (p: Pokemon) => p.s[i] })),
  { key: 'pk.total', get: total },
  { key: 'pk.weight', get: p => p.w, show: formatWeight },
  { key: 'pk.height', get: p => p.h, show: formatHeight },
];

type Round = { a: Pokemon; b: Pokemon; stat: number };

export function HigherLowerPage() {
  const { data: db, error } = useDb();
  const { t, n } = useI18n();
  const [best, setBest] = useStored<number>('hl-best', 0);
  const [streak, setStreak] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [picked, setPicked] = useState<'a' | 'b' | null>(null);

  const pool = useMemo(() => (db ? db.pokemonList.filter(p => p.def) : []), [db]);
  const newRound = (): Round | null => {
    if (pool.length < 2) return null;
    const stat = randomInt(STATS.length);
    const a = pool[randomInt(pool.length)];
    let b = a;
    // dos Pokémon distintos y que no empaten en lo que se compara
    for (let k = 0; k < 50 && (b.id === a.id || STATS[stat].get(b) === STATS[stat].get(a)); k++) b = pool[randomInt(pool.length)];
    return { a, b, stat };
  };

  // primera ronda en cuanto hay datos
  useEffect(() => {
    if (!round && pool.length >= 2) setRound(newRound());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, round]);

  if (!db) return <Status error={error} />;
  const r = round;
  if (!r) return <Status />;

  const stat = STATS[r.stat];
  const va = stat.get(r.a), vb = stat.get(r.b);
  const winner = va >= vb ? 'a' : 'b';
  const right = picked === winner;
  const show = (v: number) => (stat.show ? stat.show(v) : String(v));

  const pick = (side: 'a' | 'b') => {
    if (picked) return;
    setPicked(side);
    if (side === winner) {
      const s = streak + 1;
      setStreak(s);
      if (s > best) setBest(s);
    } else setStreak(0);
  };
  const next = () => { setRound(newRound()); setPicked(null); };

  return (
    <div className="page narrow">
      <p className="breadcrumb"><Link to="/games">{t('nav.games')}</Link></p>
      <h1>{t('hl.title')}</h1>
      <div className="card quiz">
        <div className="quiz-score">
          <span>{t('quiz.streak')}: <strong>{streak}</strong></span>
          <span>{t('quiz.best')}: <strong>{best}</strong></span>
        </div>
        <p className="hl-question">{t('hl.question', { x: t(stat.key) })}</p>
        <div className="hl-pair">
          {(['a', 'b'] as const).map(side => {
            const p = r[side];
            const cls = 'hl-card' + (picked ? (side === winner ? ' win' : ' lose') : '') + (picked === side ? ' picked' : '');
            return (
              <button key={side} type="button" className={cls} onClick={() => pick(side)} disabled={!!picked}>
                <Artwork id={p.id} size={150} alt={n(p.n)} />
                <strong>{n(p.n)}</strong>
                <Types ids={p.t} small link={false} />
                {picked && <span className="hl-value">{show(stat.get(p))}</span>}
              </button>
            );
          })}
        </div>
        {picked && (
          <div className="quiz-result">
            <p className={right ? 'good' : 'bad'}>{right ? t('quiz.correct') : t('hl.wrong')}</p>
            <button className="btn primary" onClick={next} autoFocus>{t('quiz.next')} →</button>
          </div>
        )}
      </div>
    </div>
  );
}
