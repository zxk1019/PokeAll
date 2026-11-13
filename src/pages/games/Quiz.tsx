import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useDb } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { Link } from '../../lib/router';
import { matchesName } from '../../lib/search';
import { useStored } from '../../lib/storage';
import { cryUrl, dexNumber, randomInt } from '../../lib/pokemon';
import { Artwork, NameTriple, Status, Types } from '../../components/ui';

/** ¿Quién es ese Pokémon? por la silueta (shape) o por el grito (cry). */
export function QuizPage({ mode = 'shape' }: { mode?: 'shape' | 'cry' }) {
  const { data: db, error } = useDb();
  const { t, n } = useI18n();
  const prefix = mode === 'cry' ? 'cry' : 'quiz';
  const [gens, setGens] = useStored<number[]>(prefix + '-gens', []); // vacío = todas
  const [best, setBest] = useStored<number>(prefix + '-best', 0);
  const [streak, setStreak] = useState(0);
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [answer, setAnswer] = useState('');
  const [state, setState] = useState<'playing' | 'right' | 'gaveup'>('playing');
  const [wrong, setWrong] = useState(false);
  const [hints, setHints] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  const gensKey = gens.join(',');
  const pool = useMemo(
    () => (db ? db.pokemonList.filter(p => p.def && (!gens.length || gens.includes(p.gen))) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, gensKey],
  );

  // Primera pregunta en cuanto hay datos
  useEffect(() => {
    if (currentId === null && pool.length) setCurrentId(pool[randomInt(pool.length)].id);
  }, [pool, currentId]);

  // Modo grito: suena solo al cambiar de pregunta (si el navegador lo deja; si no, con el botón)
  const audio = useRef<HTMLAudioElement | null>(null);
  const playCry = () => {
    if (currentId === null) return;
    audio.current?.pause();
    audio.current = new Audio(cryUrl(currentId));
    audio.current.volume = 0.6;
    audio.current.play().catch(() => {});
  };
  useEffect(() => {
    if (mode === 'cry' && currentId !== null) playCry();
    return () => audio.current?.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, currentId]);

  if (!db) return <Status error={error} />;

  const next = () => {
    if (!pool.length) return;
    let id = pool[randomInt(pool.length)].id;
    if (pool.length > 1) while (id === currentId) id = pool[randomInt(pool.length)].id;
    setCurrentId(id);
    setAnswer('');
    setState('playing');
    setWrong(false);
    setHints(0);
    setTimeout(() => input.current?.focus(), 0);
  };

  if (currentId === null || !db.pokemon.has(currentId)) return <Status />;

  const p = db.pokemon.get(currentId)!;
  const entry = db.search.find(e => e.kind === 'p' && e.id === p.id);
  const revealed = state !== 'playing';

  const check = (ev: FormEvent) => {
    ev.preventDefault();
    if (revealed) { next(); return; }
    if (matchesName(p.n, entry?.pinyin ?? '', answer)) {
      const s = streak + 1;
      setStreak(s);
      if (s > best) setBest(s);
      setState('right');
    } else {
      setWrong(true);
    }
  };
  const giveUp = () => { setState('gaveup'); setStreak(0); };
  const toggleGen = (g: number) => setGens(gens.includes(g) ? gens.filter(x => x !== g) : [...gens, g].sort());

  return (
    <div className="page narrow">
      <p className="breadcrumb"><Link to="/games">{t('nav.games')}</Link></p>
      <h1>{t(mode === 'cry' ? 'cry.title' : 'quiz.title')}</h1>

      <div className="filter-row wrap">
        <span className="filter-label">{t('quiz.gens')}</span>
        <div className="chips">
          <button className={'chip' + (!gens.length ? ' active' : '')} onClick={() => setGens([])}>{t('all')}</button>
          {db.meta.generations.map(g => (
            <button key={g.id} className={'chip' + (gens.includes(g.id) ? ' active' : '')} aria-pressed={gens.includes(g.id)} onClick={() => toggleGen(g.id)}>{g.id}</button>
          ))}
        </div>
      </div>

      <div className="card quiz">
        <div className="quiz-score">
          <span>{t('quiz.streak')}: <strong>{streak}</strong></span>
          <span>{t('quiz.best')}: <strong>{best}</strong></span>
        </div>
        {mode === 'cry' && !revealed ? (
          <div className="quiz-art">
            <button type="button" className="cry-btn" onClick={playCry} aria-label={t('cry.play')}>
              <span aria-hidden>🔊</span>
              {t('cry.play')}
            </button>
          </div>
        ) : (
          <div className={'quiz-art' + (revealed ? ' revealed' : '')}>
            <Artwork id={p.id} silhouette={!revealed} size={260} alt={revealed ? n(p.n) : '?'} />
          </div>
        )}

        {!revealed && hints > 0 && (
          <div className="quiz-hints">
            <span>{t('quiz.hintType', { x: p.t.map(id => n(db.meta.types[id - 1].n)).join(' / ') })}</span>
            {hints > 1 && <span>{t('quiz.hintLetter', { x: [...n(p.n)][0] })}</span>}
          </div>
        )}

        {revealed ? (
          <div className="quiz-result">
            <p className={state === 'right' ? 'good' : 'muted'}>{state === 'right' ? t('quiz.correct') : t('quiz.itWas')}</p>
            <h2><Link to={`/pokemon/${p.id}`}>{dexNumber(p.sp)} {n(p.n)}</Link></h2>
            <Types ids={p.t} />
            <NameTriple names={p.n} pinyin={entry?.pinyin} />
            <button className="btn primary" onClick={next} autoFocus>{t('quiz.next')} →</button>
          </div>
        ) : (
          <form onSubmit={check} className="quiz-form">
            <input
              ref={input}
              className="input big"
              value={answer}
              onChange={e => { setAnswer(e.target.value); setWrong(false); }}
              placeholder={t('quiz.placeholder')}
              aria-label={t('quiz.placeholder')}
              autoComplete="off"
              autoFocus
            />
            {wrong && <p className="bad" role="status">{t('quiz.wrong')}</p>}
            <div className="actions">
              <button type="submit" className="btn primary">{t('quiz.check')}</button>
              <button type="button" className="btn" disabled={hints >= 2} onClick={() => setHints(hints + 1)}>💡 {t('quiz.hint')}</button>
              <button type="button" className="btn" onClick={giveUp}>{t('quiz.giveUp')}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
