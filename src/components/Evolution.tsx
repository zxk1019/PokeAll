// Árbol de evolución con las condiciones escritas en el idioma elegido.
import { Fragment, type ReactNode } from 'react';
import type { Db, EvoCond } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { defaultPokemon } from '../lib/pokemon';
import { Link } from '../lib/router';
import { Sprite, Types } from './ui';

/** Cambia {x} y {n} de una plantilla por elementos de React (enlaces, etc.) */
function fmt(template: string, vars: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/).map((part, i) => {
    const m = part.match(/^\{(\w+)\}$/);
    return <Fragment key={i}>{m && m[1] in vars ? vars[m[1]] : part}</Fragment>;
  });
}

function Condition({ c, db }: { c: EvoCond; db: Db }) {
  const { t, n, lang } = useI18n();
  const item = (id?: number) => (id ? <Link to={`/item/${id}`}>{n(db.items.get(id)?.n)}</Link> : '?');
  const move = (id?: number) => (id ? <Link to={`/move/${id}`}>{n(db.moves.get(id)?.n)}</Link> : '?');
  const species = (id?: number) => (id ? <Link to={`/pokemon/${id}`}>{n(db.species.get(id)?.n)}</Link> : '?');
  const type = (id?: number) => (id ? n(db.meta.types[id - 1]?.n) : '?');

  let base: ReactNode;
  switch (c.t) {
    case 1:
    case 10:
      base = c.lvl ? t('evo.level', { n: c.lvl }) : t('evo.levelUp');
      if (c.t === 10) base = <>{base} {t('evo.inBattle')}</>;
      break;
    case 2: base = <>{t('evo.trade')}{c.tradeWith ? <> {fmt(t('evo.tradeWith'), { x: species(c.tradeWith) })}</> : null}</>; break;
    case 3: base = fmt(t('evo.useItem'), { x: item(c.item) }); break;
    case 4: base = t('evo.shed'); break;
    case 5: base = t('evo.spin'); break;
    case 6: base = t('evo.towerDark'); break;
    case 7: base = t('evo.towerWater'); break;
    case 8: base = t('evo.crits'); break;
    case 9: base = c.dmg ? `${t('evo.takeDamage')} ${t('evo.dmg', { n: c.dmg })}` : t('evo.takeDamage'); break;
    case 11: base = fmt(t('evo.agile'), { x: move(c.usedMove), n: c.count ?? '?' }); break;
    case 12: base = fmt(t('evo.strong'), { x: move(c.usedMove), n: c.count ?? '?' }); break;
    case 13: base = t('evo.recoil', { n: c.dmg ?? '?' }); break;
    case 14: base = fmt(t('evo.useMove'), { x: move(c.usedMove), n: c.count ?? '?' }); break;
    case 15: base = t('evo.bisharp'); break;
    case 16: base = t('evo.coins'); break;
    case 17: base = t('evo.meltan'); break;
    default: base = t('evo.special');
  }

  const mods: ReactNode[] = [];
  if (c.held) mods.push(fmt(t('evo.held'), { x: item(c.held) }));
  if (c.happy) mods.push(t('evo.happy'));
  if (c.aff) mods.push(t('evo.aff'));
  if (c.beauty) mods.push(t('evo.beauty'));
  if (c.time === 'day' || c.time === 'night' || c.time === 'dusk') mods.push(t(`evo.time.${c.time}`));
  if (c.gender === 1) mods.push(t('evo.female'));
  if (c.gender === 2) mods.push(t('evo.male'));
  if (c.move) mods.push(fmt(t('evo.knowing'), { x: move(c.move) }));
  if (c.moveType) mods.push(t('evo.knowingType', { x: type(c.moveType) }));
  if (c.phys === 1 || c.phys === 0 || c.phys === -1) mods.push(t(`evo.phys.${c.phys}` as 'evo.phys.1'));
  if (c.party) mods.push(fmt(t('evo.party'), { x: species(c.party) }));
  if (c.partyType) mods.push(t('evo.partyType', { x: type(c.partyType) }));
  if (c.rain) mods.push(t('evo.rain'));
  if (c.upside) mods.push(t('evo.upside'));
  if (c.multi) mods.push(t('evo.multi'));
  if (c.rock) mods.push(t('evo.rock'));
  if (c.loc) mods.push(t('evo.loc', { x: n(db.meta.locs[c.loc]) }));
  if (c.region) mods.push(t('evo.region', { x: n(db.meta.regions[c.region]) }));
  if (c.steps) mods.push(t('evo.steps', { n: c.steps }));
  if (c.dmg && c.t !== 9 && c.t !== 13) mods.push(t('evo.dmg', { n: c.dmg }));
  if (c.nature) mods.push(t('evo.nature'));
  if (c.chance) mods.push(t('evo.chance', { n: c.chance }));

  return (
    <span className="evo-cond">
      {c.fromForm && <>{t('evo.from', { x: n(db.pokemon.get(c.fromForm)?.n) })} </>}
      {base}
      {mods.map((m, i) => <Fragment key={i}>{lang === 'zh' ? '，' : ', '}{m}</Fragment>)}
    </span>
  );
}

const MAX_CONDS = 3;

function Conditions({ conds, db }: { conds: EvoCond[]; db: Db }) {
  const { t } = useI18n();
  return (
    <div className="evo-conds">
      {conds.slice(0, MAX_CONDS).map((c, i) => <Condition key={i} c={c} db={db} />)}
      {conds.length > MAX_CONDS && <span className="muted small">{t('evo.more', { n: conds.length - MAX_CONDS })}</span>}
    </div>
  );
}

function Node({ db, speciesId, pokemonId, current, recurse }: { db: Db; speciesId: number; pokemonId: number; current: number; recurse: boolean }) {
  const { n } = useI18n();
  const sp = db.species.get(speciesId)!;
  const edges = recurse ? (db.evolutions[sp.chain] ?? []).filter(e => e.from === speciesId) : [];

  // Si una evolución lleva a formas distintas (Raichu / Raichu de Alola), cada forma es una rama
  const branches = edges.flatMap(e => {
    const groups = new Map<number | undefined, EvoCond[]>();
    for (const c of e.c) {
      if (!groups.has(c.toForm)) groups.set(c.toForm, []);
      groups.get(c.toForm)!.push(c);
    }
    return [...groups].map(([toForm, conds]) => ({
      speciesId: e.to,
      pokemonId: toForm ?? defaultPokemon(db, e.to)!.id,
      conds,
      recurse: toForm === undefined,
    }));
  });

  const p = db.pokemon.get(pokemonId)!;
  return (
    <div className="evo-node">
      <Link to={`/pokemon/${p.id}`} className={'evo-mon' + (p.id === current ? ' current' : '')} aria-current={p.id === current ? 'page' : undefined}>
        <Sprite id={p.id} size={80} />
        <span className="evo-name">{n(p.n)}</span>
        <Types ids={p.t} small link={false} />
      </Link>
      {branches.length > 0 && (
        <div className="evo-branches">
          {branches.map(b => (
            <div className="evo-branch" key={b.pokemonId}>
              <div className="evo-arrow">
                <span className="arrow" aria-hidden>➜</span>
                <Conditions conds={b.conds} db={db} />
              </div>
              <Node db={db} speciesId={b.speciesId} pokemonId={b.pokemonId} current={current} recurse={b.recurse} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EvolutionTree({ db, speciesId, current }: { db: Db; speciesId: number; current: number }) {
  const { t } = useI18n();
  const sp = db.species.get(speciesId)!;
  const edges = db.evolutions[sp.chain] ?? [];
  if (!edges.length) return <p className="muted">{t('pk.noEvolution')}</p>;
  const targets = new Set(edges.map(e => e.to));
  const root = edges.find(e => !targets.has(e.from))!.from;
  return (
    <div className="evo-tree">
      <Node db={db} speciesId={root} pokemonId={defaultPokemon(db, root)!.id} current={current} recurse />
    </div>
  );
}
