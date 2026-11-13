import { useMemo, useState, type FormEvent } from 'react';
import { useDb, type Pokemon } from '../../lib/data';
import { useI18n } from '../../lib/i18n';
import { Link } from '../../lib/router';
import { matchesName, search } from '../../lib/search';
import { useStored } from '../../lib/storage';
import { dexNumber, formatHeight, formatWeight, total } from '../../lib/pokemon';
import { Artwork, NameTriple, Sprite, Status, TypeBadge, Types } from '../../components/ui';
import { dailySpecies } from '../Home';

const MAX_TRIES = 8;

/** Fecha de hoy (hora del navegador) como "2026-11-13" */
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** Fecha de ayer, para saber si la racha sigue */
const yesterday = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
/** Número fijo para cada fecha (FNV-1a): así todo el mundo tiene el mismo Pokémon ese día */
const hash = (s: string) => {
  let h = 0x811c9dc5;
  for (const c of 'pokeall:' + s) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
  return h >>> 0;
};

type Saved = { date: string; guesses: number[]; gaveUp?: boolean };
type Stats = { played: number; won: number; streak: number; best: number; last: string };

/** Pista de un número: igual, o si el secreto tiene más (↑) o menos (↓) */
function Num({ guess, secret, label }: { guess: number; secret: number; label: string }) {
  const cls = guess === secret ? 'hit' : 'miss';
  return <span className={'daily-cell ' + cls}>{label}{guess !== secret && <b aria-label={guess < secret ? '↑' : '↓'}>{guess < secret ? ' ↑' : ' ↓'}</b>}</span>;
}

export function DailyPage() {
  const { data: db, error } = useDb();
  const { t, n } = useI18n();
  const date = today();
  const [saved, setSaved] = useStored<Saved>('daily', { date, guesses: [] });
  const [stats, setStats] = useStored<Stats>('daily-stats', { played: 0, won: 0, streak: 0, best: 0, last: '' });
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);
  const [copied, setCopied] = useState(false);

  const pool = useMemo(() => (db ? db.pokemonList.filter(p => p.def).sort((a, b) => a.id - b.id) : []), [db]);
  if (!db) return <Status error={error} />;
  if (!pool.length) return <Status />;

  // Si toca el mismo que el "Pokémon del día" de la portada, el siguiente (si no, la portada lo destriparía)
  let pick = hash(date) % pool.length;
  if (pool[pick].sp === dailySpecies(db.speciesList.length)) pick = (pick + 1) % pool.length;
  const secret = pool[pick];
  const state: Saved = saved.date === date ? saved : { date, guesses: [] };
  const guesses = state.guesses.map(id => db.pokemon.get(id)).filter((p): p is Pokemon => !!p);
  const won = guesses.some(p => p.id === secret.id);
  const over = won || state.gaveUp || guesses.length >= MAX_TRIES;

  // Sugerencias mientras se escribe (solo formas normales, que son las que pueden salir)
  const suggestions = answer.trim()
    ? search(db.search, answer, { kinds: ['p'], limit: 12 })
      .map(e => db.pokemon.get(e.id)).filter((p): p is Pokemon => !!p && !!p.def && !state.guesses.includes(p.id)).slice(0, 6)
    : [];
  const entryOf = (p: Pokemon) => db.search.find(e => e.kind === 'p' && e.id === p.id);

  const finish = (guessIds: number[], isWin: boolean, gaveUp = false) => {
    setSaved({ date, guesses: guessIds, gaveUp });
    if (stats.last === date) return;
    const streak = isWin ? (stats.last === yesterday() ? stats.streak + 1 : 1) : 0;
    setStats({ played: stats.played + 1, won: stats.won + (isWin ? 1 : 0), streak, best: Math.max(stats.best, streak), last: date });
  };
  const guess = (p: Pokemon) => {
    if (over || state.guesses.includes(p.id)) return;
    const ids = [...state.guesses, p.id];
    setAnswer('');
    setWrong(false);
    if (p.id === secret.id || ids.length >= MAX_TRIES) finish(ids, p.id === secret.id);
    else setSaved({ date, guesses: ids });
  };
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    const exact = pool.find(p => matchesName(p.n, entryOf(p)?.pinyin ?? '', answer));
    const p = exact ?? suggestions[0];
    if (p) guess(p); else setWrong(true);
  };

  const share = async () => {
    const rows = guesses.map(p => [
      p.gen === secret.gen, p.t[0] === secret.t[0], (p.t[1] ?? 0) === (secret.t[1] ?? 0), p.h === secret.h, p.w === secret.w, total(p) === total(secret),
    ].map(ok => (ok ? '🟩' : '⬜')).join(''));
    const text = `PokeAll ${date} ${won ? guesses.length : 'X'}/${MAX_TRIES}\n${rows.join('\n')}\n${location.href.split('#')[0]}#/daily`;
    try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* sin portapapeles */ }
  };

  // Tipo: verde si está en la misma posición, amarillo si el secreto lo tiene en la otra
  const typeCell = (p: Pokemon, slot: 0 | 1) => {
    const ty = p.t[slot];
    const cls = (ty ?? 0) === (secret.t[slot] ?? 0) ? 'hit' : ty && secret.t.includes(ty) ? 'near' : 'miss';
    return <span className={'daily-cell ' + cls}>{ty ? <TypeBadge id={ty} small link={false} /> : '—'}</span>;
  };

  return (
    <div className="page narrow">
      <p className="breadcrumb"><Link to="/games">{t('nav.games')}</Link></p>
      <h1>{t('daily.title')}</h1>
      <p className="muted">{t('daily.intro', { n: MAX_TRIES })}</p>

      <div className="card quiz">
        <div className="quiz-score">
          <span>{t('daily.tries')}: <strong>{guesses.length}/{MAX_TRIES}</strong></span>
          <span>{t('quiz.streak')}: <strong>{stats.last === date || stats.last === yesterday() ? stats.streak : 0}</strong> · {t('quiz.best')}: <strong>{stats.best}</strong></span>
        </div>

        {over ? (
          <div className="quiz-result">
            <div className="quiz-art revealed"><Artwork id={secret.id} size={200} alt={n(secret.n)} /></div>
            <p className={won ? 'good' : 'muted'}>{won ? t('daily.won', { n: guesses.length }) : t('quiz.itWas')}</p>
            <h2><Link to={`/pokemon/${secret.id}`}>{dexNumber(secret.sp)} {n(secret.n)}</Link></h2>
            <Types ids={secret.t} />
            <NameTriple names={secret.n} pinyin={entryOf(secret)?.pinyin} />
            <div className="actions" style={{ justifyContent: 'center' }}>
              <button className="btn" onClick={share}>{copied ? t('daily.copied') : t('daily.share')}</button>
            </div>
            <p className="muted small">{t('daily.comeBack')}</p>
          </div>
        ) : (
          <form onSubmit={submit} className="quiz-form">
            <input
              className="input big"
              value={answer}
              onChange={e => { setAnswer(e.target.value); setWrong(false); }}
              placeholder={t('quiz.placeholder')}
              aria-label={t('quiz.placeholder')}
              autoComplete="off"
              autoFocus
            />
            {suggestions.length > 0 && (
              <div className="daily-suggest">
                {suggestions.map(p => (
                  <button key={p.id} type="button" className="chip" onClick={() => guess(p)}>
                    <Sprite id={p.id} size={28} /> {n(p.n)}
                  </button>
                ))}
              </div>
            )}
            {wrong && <p className="bad" role="status">{t('daily.unknown')}</p>}
            <div className="actions">
              <button type="submit" className="btn primary">{t('quiz.check')}</button>
              <button type="button" className="btn" onClick={() => finish(state.guesses, false, true)}>{t('quiz.giveUp')}</button>
            </div>
          </form>
        )}
      </div>

      {guesses.length > 0 && (
        <div className="card daily-table" role="table" aria-label={t('daily.title')}>
          <div className="daily-row daily-head" role="row">
            <span>{t('col.pokemon')}</span><span>{t('dex.gen')}</span><span>{t('daily.type1')}</span><span>{t('daily.type2')}</span>
            <span>{t('pk.height')}</span><span>{t('pk.weight')}</span><span>{t('pk.total')}</span>
          </div>
          {[...guesses].reverse().map(p => (
            <div key={p.id} className="daily-row" role="row">
              <span className={'daily-cell daily-name ' + (p.id === secret.id ? 'hit' : '')}><Sprite id={p.id} size={36} /> {n(p.n)}</span>
              <Num guess={p.gen} secret={secret.gen} label={String(p.gen)} />
              {typeCell(p, 0)}
              {typeCell(p, 1)}
              <Num guess={p.h} secret={secret.h} label={formatHeight(p.h)} />
              <Num guess={p.w} secret={secret.w} label={formatWeight(p.w)} />
              <Num guess={total(p)} secret={total(secret)} label={String(total(p))} />
            </div>
          ))}
          <p className="muted small">{t('daily.legend')}</p>
        </div>
      )}
    </div>
  );
}
