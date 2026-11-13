import { useEffect, useMemo, useState } from 'react';
import { useDb, type Pokemon } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { Link } from '../../lib/router';
import { useStored } from '../../lib/storage';
import { effectiveness, multLabel, randomInt } from '../../lib/pokemon';
import { Artwork, Status, TypeBadge, Types } from '../../components/ui';

// Respuestas posibles: el multiplicador de daño de un tipo contra los tipos del Pokémon (sin contar habilidades)
const ANSWERS = [0, 0.25, 0.5, 1, 2, 4];

type Round = { attack: number; p: Pokemon };

export function TypeQuizPage() {
  const { data: db, error } = useDb();
  const { t, n } = useI18n();
  const [best, setBest] = useStored<number>('types-best', 0);
  const [streak, setStreak] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [picked, setPicked] = useState<number | null>(null);

  const pool = useMemo(() => (db ? db.pokemonList.filter(p => p.def) : []), [db]);
  const newRound = (): Round | null => {
    if (!db || !pool.length) return null;
    const p = pool[randomInt(pool.length)];
    const types = db.meta.types.map(x => x.id);
    // La mitad de las veces un tipo que no hace daño normal (si no, casi siempre sería ×1)
    const special = types.filter(a => effectiveness(db.meta, a, p.t) !== 1);
    const from = special.length && Math.random() < 0.6 ? special : types;
    return { attack: from[randomInt(from.length)], p };
  };

  useEffect(() => {
    if (!round && pool.length) setRound(newRound());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool, round]);

  if (!db) return <Status error={error} />;
  if (!round) return <Status />;

  const answer = effectiveness(db.meta, round.attack, round.p.t);
  const pick = (m: number) => {
    if (picked !== null) return;
    setPicked(m);
    if (m === answer) {
      const s = streak + 1;
      setStreak(s);
      if (s > best) setBest(s);
    } else setStreak(0);
  };
  const next = () => { setRound(newRound()); setPicked(null); };

  return (
    <div className="page narrow">
      <p className="breadcrumb"><Link to="/games">{t('nav.games')}</Link></p>
      <h1>{t('tq.title')}</h1>
      <div className="card quiz">
        <div className="quiz-score">
          <span>{t('quiz.streak')}: <strong>{streak}</strong></span>
          <span>{t('quiz.best')}: <strong>{best}</strong></span>
        </div>
        <div className="tq-matchup">
          <div className="tq-side">
            <span className="muted small">{t('tq.attack')}</span>
            <TypeBadge id={round.attack} link={false} />
          </div>
          <span className="tq-arrow" aria-hidden>→</span>
          <div className="tq-side">
            <Artwork id={round.p.id} size={130} alt={n(round.p.n)} />
            <strong>{n(round.p.n)}</strong>
            <Types ids={round.p.t} small link={false} />
          </div>
        </div>
        <p className="hl-question">{t('tq.question')}</p>
        <div className="tq-answers">
          {ANSWERS.map(m => {
            const cls = 'btn tq-answer' + (picked !== null ? (m === answer ? ' right' : m === picked ? ' wrong' : '') : '');
            return <button key={m} type="button" className={cls} onClick={() => pick(m)} disabled={picked !== null}>×{multLabel(m)}</button>;
          })}
        </div>
        {picked !== null && (
          <div className="quiz-result">
            <p className={picked === answer ? 'good' : 'bad'}>
              {picked === answer ? t('quiz.correct') : t('tq.itWas', { x: '×' + multLabel(answer) })}
            </p>
            <button className="btn primary" onClick={next} autoFocus>{t('quiz.next')} →</button>
          </div>
        )}
        <p className="muted small">{t('tq.note')}</p>
      </div>
    </div>
  );
}
