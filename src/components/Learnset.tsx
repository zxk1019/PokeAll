// Tabla de movimientos que aprende un Pokémon, separada por método (nivel, MT, huevo, tutor).
import { useState } from 'react';
import type { Db, LearnEntry, Learnsets, Pokemon } from '../lib/data';
import { useI18n, type Key } from '../lib/i18n';
import { defaultPokemon } from '../lib/pokemon';
import { Link } from '../lib/router';
import { TypeBadge } from './ui';

const METHODS = [1, 4, 2, 3];

export function MoveClass({ c }: { c: number }) {
  const { t } = useI18n();
  return <span className={`move-class c${c}`}>{t(`class.${c}` as Key)}</span>;
}

export function Learnset({ db, p, learnsets }: { db: Db; p: Pokemon; learnsets: Learnsets }) {
  const { t, n, lang } = useI18n();
  const own = learnsets[p.id];
  const fallback = own ? null : learnsets[defaultPokemon(db, p.sp)!.id];
  const data = own ?? fallback;
  const methods = data ? METHODS.filter(m => data.m.some(e => e[1] === m)) : [];
  const [method, setMethod] = useState(methods[0] ?? 1);

  if (!data) return <p className="muted">{t('pk.noMoves')}</p>;
  const current = methods.includes(method) ? method : methods[0];
  const collator = new Intl.Collator(lang === 'zh' ? 'zh-Hans-u-co-pinyin' : lang);
  const rows = data.m
    .filter(e => e[1] === current)
    .sort((a, b) => (current === 1 ? a[2] - b[2] : 0) || collator.compare(n(db.moves.get(a[0])?.n), n(db.moves.get(b[0])?.n)));
  const isSV = data.v === 25;

  const levelLabel = (e: LearnEntry) => (e[2] === 0 ? t('learn.evo') : e[2]);

  return (
    <div>
      <div className="tabs" role="tablist">
        {methods.map(m => (
          <button key={m} role="tab" aria-selected={m === current} className={'tab' + (m === current ? ' active' : '')} onClick={() => setMethod(m)}>
            {t(`method.${m}` as Key)} <span className="tab-count">{data.m.filter(e => e[1] === m).length}</span>
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              {current === 1 && <th>{t('col.level')}</th>}
              {current === 4 && isSV && <th>{t('method.4')}</th>}
              <th>{t('col.move')}</th>
              <th>{t('col.type')}</th>
              <th>{t('col.class')}</th>
              <th className="num">{t('col.power')}</th>
              <th className="num">{t('col.accuracy')}</th>
              <th className="num">{t('col.pp')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(e => {
              const mv = db.moves.get(e[0]);
              if (!mv) return null;
              return (
                <tr key={e.join('-')}>
                  {current === 1 && <td className="num">{levelLabel(e)}</td>}
                  {current === 4 && isSV && <td className="muted small">{mv.tm ? n(db.items.get(mv.tm)?.n) : ''}</td>}
                  <td><Link to={`/move/${mv.id}`}>{n(mv.n)}</Link></td>
                  <td><TypeBadge id={mv.t} small /></td>
                  <td><MoveClass c={mv.c} /></td>
                  <td className="num">{mv.p ?? '—'}</td>
                  <td className="num">{mv.a ?? '—'}</td>
                  <td className="num">{mv.pp ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        {t('pk.movesFrom', { game: n(db.meta.vgNames[data.v]) })}
        {fallback && <> · {t('pk.movesFormNote')}</>}
      </p>
    </div>
  );
}
