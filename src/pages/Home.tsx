import { useDb } from '../lib/data';
import { useI18n, type Key } from '../lib/i18n';
import { Link, navigate } from '../lib/router';
import { NAV } from '../components/Layout';
import { SearchBox } from '../components/SearchBox';
import { Artwork, Status, Types } from '../components/ui';
import { dexNumber, randomInt } from '../lib/pokemon';

/** Mismo Pokémon para todos durante el día */
function dailySpecies(count: number): number {
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  let h = seed;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h ^= h >>> 16;
  return (Math.abs(h) % count) + 1;
}

export function Home() {
  const { data: db, error } = useDb();
  const { t, n } = useI18n();
  if (!db) return <Status error={error} />;

  const daily = db.pokemon.get(dailySpecies(db.speciesList.length))!;
  const sp = db.species.get(daily.sp)!;

  return (
    <div className="page">
      <section className="hero">
        <h1>{t('home.title')}</h1>
        <p className="hero-sub">
          {t('home.subtitle', { p: db.speciesList.length, i: db.itemList.length, a: db.abilityList.length, m: db.moveList.length })}
        </p>
        <SearchBox big />
        <p className="muted small">{t('search.hint')}</p>
      </section>

      <div className="home-grid">
        <Link to={`/pokemon/${daily.id}`} className="card daily">
          <span className="eyebrow">{t('home.daily')}</span>
          <Artwork id={daily.id} size={180} alt={n(daily.n)} />
          <span className="poke-num">{dexNumber(daily.sp)}</span>
          <strong className="daily-name">{n(daily.n)}</strong>
          <span className="muted small">{n(sp.g)}</span>
          <Types ids={daily.t} link={false} />
        </Link>

        <div className="section-grid">
          {NAV.map(item => (
            <Link key={item.path} to={item.path} className="card section-card">
              <span className="section-icon" aria-hidden>{item.icon}</span>
              <strong>{t(item.key)}</strong>
              <span className="muted small">{t(('home.' + item.path.slice(1)) as Key)}</span>
            </Link>
          ))}
          <button className="card section-card random-card" onClick={() => navigate(`/pokemon/${randomInt(db.speciesList.length) + 1}`)}>
            <span className="section-icon" aria-hidden>🎲</span>
            <strong>{t('home.random')}</strong>
          </button>
        </div>
      </div>
    </div>
  );
}
