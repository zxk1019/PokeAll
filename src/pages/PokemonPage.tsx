import { useState } from 'react';
import { useDb, useLearnsets, type Db, type Pokemon } from '../lib/data';
import { useI18n, type Key } from '../lib/i18n';
import { Link } from '../lib/router';
import { useTeam } from '../lib/storage';
import { cryUrl, defensiveChart, dexNumber, formatHeight, formatWeight, multLabel, statColor, total } from '../lib/pokemon';
import { Artwork, Desc, FavButton, ItemIcon, NameTriple, Section, Sprite, Status, TypeBadge, Types } from '../components/ui';
import { EvolutionTree } from '../components/Evolution';
import { Learnset } from '../components/Learnset';

export function StatBars({ p, highlight }: { p: Pokemon; highlight?: boolean[] }) {
  const { t } = useI18n();
  return (
    <div className="stats">
      {p.s.map((v, i) => (
        <div className={'stat-row' + (highlight?.[i] ? ' best' : '')} key={i}>
          <span className="stat-name">{t(`stat.${i}` as Key)}</span>
          <span className="stat-val">{v}</span>
          <span className="stat-bar"><span style={{ width: `${Math.min(100, (v / 255) * 100)}%`, background: statColor(v) }} /></span>
        </div>
      ))}
      <div className="stat-row total">
        <span className="stat-name">{t('pk.total')}</span>
        <span className="stat-val">{total(p)}</span>
        <span />
      </div>
    </div>
  );
}

export function Weaknesses({ db, types }: { db: Db; types: number[] }) {
  const { t } = useI18n();
  const chart = defensiveChart(db.meta, types);
  const groups = [4, 2, 0.5, 0.25, 0].map(m => ({ m, types: chart.filter(c => c.mult === m).map(c => c.type) })).filter(g => g.types.length);
  return (
    <div className="weak-groups">
      {groups.map(g => (
        <div key={g.m} className={'weak-row m' + String(g.m).replace('.', '')}>
          <span className="mult">×{multLabel(g.m)}</span>
          <span className="types">{g.types.map(id => <TypeBadge key={id} id={id} small />)}</span>
        </div>
      ))}
      <p className="muted small">{t('pk.weakNote')}</p>
    </div>
  );
}

export function PokemonPage({ id }: { id: number }) {
  const { data: db, error } = useDb();
  const { data: learnsets } = useLearnsets();
  const { t, n, lang } = useI18n();
  const [shiny, setShiny] = useState(false);
  const team = useTeam();

  if (!db) return <Status error={error} />;
  const p = db.pokemon.get(id);
  if (!p) return <div className="page narrow center"><p>{t('pk.notFound')}</p><Link to="/pokedex" className="btn">{t('nav.pokedex')}</Link></div>;
  const sp = db.species.get(p.sp)!;
  const entry = db.search.find(e => e.kind === 'p' && e.id === p.id);
  const prev = db.species.get(p.sp - 1);
  const next = db.species.get(p.sp + 1);

  const gender = sp.gr === -1 ? t('pk.genderless') : `♂ ${100 - (sp.gr / 8) * 100}% · ♀ ${(sp.gr / 8) * 100}%`;
  const evs = p.ev.map((v, i) => (v ? `${v} ${t(`stat.${i}` as Key)}` : null)).filter(Boolean).join(', ');
  // Nombre corto de una forma; si no está traducida, usamos "Gigamax"/"Megaevolución" de la interfaz
  const formLabel = (f: Pokemon) => {
    if (f.def || !f.f) return n(f.n);
    if (f.f[lang]) return f.f[lang]!;
    if (f.gmax) return t('pk.gmax');
    if (f.mega) return t('pk.mega') + (/-[xy]$/.test(f.slug) ? ' ' + f.slug.slice(-1).toUpperCase() : '');
    return n(f.f);
  };
  const playCry = () => { new Audio(cryUrl(p.id)).play().catch(() => new Audio(cryUrl(p.sp)).play().catch(() => {})); };

  return (
    <div className="page">
      <nav className="prev-next" aria-label="Pokémon">
        {prev ? <Link to={`/pokemon/${prev.id}`}>← {dexNumber(prev.id)} {n(prev.n)}</Link> : <span />}
        {next ? <Link to={`/pokemon/${next.id}`}>{n(next.n)} {dexNumber(next.id)} →</Link> : <span />}
      </nav>

      <div className="poke-head card">
        <div className="poke-art">
          <Artwork id={p.id} shiny={shiny} alt={n(p.n)} />
          <div className="seg" role="group">
            <button className={!shiny ? 'active' : ''} aria-pressed={!shiny} onClick={() => setShiny(false)}>{t('pk.normal')}</button>
            <button className={shiny ? 'active' : ''} aria-pressed={shiny} onClick={() => setShiny(true)}>✨ {t('pk.shiny')}</button>
          </div>
        </div>
        <div className="poke-info">
          <span className="poke-num big">{dexNumber(p.sp)}</span>
          <h1>{n(p.n)}</h1>
          <p className="genus">{n(sp.g)}</p>
          <div className="tags">
            <Types ids={p.t} />
            {sp.leg && <span className="tag">{t('cat.legendary')}</span>}
            {sp.myth && <span className="tag">{t('cat.mythical')}</span>}
            {sp.baby && <span className="tag">{t('cat.baby')}</span>}
            {p.mega && <span className="tag">{t('pk.mega')}</span>}
            {p.gmax && <span className="tag">{t('pk.gmax')}</span>}
          </div>
          <div className="actions">
            <FavButton id={p.id} />
            <button className="btn" onClick={playCry}>🔊 {t('pk.cry')}</button>
            <button className="btn" disabled={team.has(p.id) || team.isFull} onClick={() => team.add(p.id)}>
              ⬡ {team.has(p.id) ? t('pk.inTeam') : team.isFull ? t('pk.teamFull') : t('pk.addTeam')}
            </button>
            <Link className="btn" to={`/compare?ids=${p.id}`}>⇄ {t('pk.compare')}</Link>
          </div>
          <NameTriple names={p.n} pinyin={entry?.pinyin} />
        </div>
      </div>

      {sp.forms.length > 1 && (
        <Section title={t('pk.forms')}>
          <div className="form-list">
            {sp.forms.map(fid => {
              const f = db.pokemon.get(fid)!;
              return (
                <Link key={fid} to={`/pokemon/${fid}`} className={'form-chip' + (fid === p.id ? ' active' : '')} aria-current={fid === p.id ? 'page' : undefined}>
                  <Sprite id={fid} size={48} />
                  <span>{formLabel(f)}</span>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      <div className="two-col">
        <Section title={t('pk.description')}>
          <Desc text={sp.d} src={sp.src} />
        </Section>
        <Section title={t('pk.data')}>
          <dl className="facts">
            <div><dt>{t('pk.height')}</dt><dd>{formatHeight(p.h)}</dd></div>
            <div><dt>{t('pk.weight')}</dt><dd>{formatWeight(p.w)}</dd></div>
            <div><dt>{t('pk.gender')}</dt><dd>{gender}</dd></div>
            <div><dt>{t('pk.catchRate')}</dt><dd>{sp.cr}</dd></div>
            <div><dt>{t('pk.eggGroups')}</dt><dd>{sp.egg.map(e => n(db.meta.eggGroups[e])).join(', ') || '—'}</dd></div>
            <div><dt>{t('pk.hatch')}</dt><dd>{sp.hatch ?? '—'}</dd></div>
            <div><dt>{t('pk.ev')}</dt><dd>{evs || '—'}</dd></div>
            <div><dt>{t('pk.generation')}</dt><dd><Link to={`/pokedex?gen=${p.gen}`}>{n(db.meta.generations[p.gen - 1]?.n)}</Link></dd></div>
          </dl>
        </Section>
      </div>

      <Section title={t('pk.abilities')}>
        {/* Megas nuevas de Leyendas Z-A (Mega-Darkrai...): las wikis aún no saben su habilidad */}
        {!p.ab.length && <p className="muted">{t('pk.abilityUnknown')}</p>}
        <ul className="ability-list">
          {p.ab.map(([aid, hidden]) => {
            const a = db.abilities.get(aid);
            if (!a) return null;
            return (
              <li key={aid}>
                <div className="ability-name">
                  <Link to={`/ability/${aid}`}>{n(a.n)}</Link>
                  {hidden === 1 && <span className="tag">{t('pk.hidden')}</span>}
                  {a.ex && <span className="tag gold" title={t(`ab.ex.${a.ex}.long` as Key)}>★ {t(`ab.ex.${a.ex}` as Key)}</span>}
                </div>
                <p className="muted">{n(a.d)}</p>
              </li>
            );
          })}
        </ul>
      </Section>

      <div className="two-col">
        <Section title={t('pk.stats')}>
          <StatBars p={p} />
        </Section>
        <Section title={t('pk.weaknesses')}>
          <Weaknesses db={db} types={p.t} />
        </Section>
      </div>

      <Section title={t('pk.evolution')}>
        <EvolutionTree db={db} speciesId={p.sp} current={p.id} />
      </Section>

      {p.held && p.held.length > 0 && (
        <Section title={t('pk.heldItems')}>
          <div className="chip-list">
            {p.held.map(iid => {
              const it = db.items.get(iid);
              return it ? <Link key={iid} to={`/item/${iid}`} className="poke-chip"><ItemIcon slug={it.slug} /> <span>{n(it.n)}</span></Link> : null;
            })}
          </div>
        </Section>
      )}

      <Section title={t('pk.moves')}>
        {learnsets ? <Learnset db={db} p={p} learnsets={learnsets} /> : <Status />}
      </Section>
    </div>
  );
}
