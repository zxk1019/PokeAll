import { useDb } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { Link } from '../lib/router';
import { useFavorites } from '../lib/storage';
import { PokemonCard, Status } from '../components/ui';

export function FavoritesPage() {
  const { data: db, error } = useDb();
  const { t } = useI18n();
  const { favs } = useFavorites();
  if (!db) return <Status error={error} />;
  const list = favs.map(id => db.pokemon.get(id)).filter(p => p !== undefined);

  return (
    <div className="page">
      <h1>★ {t('nav.favorites')}</h1>
      {list.length === 0 ? (
        <div className="empty">
          <p>{t('fav.empty')}</p>
          <Link to="/pokedex" className="btn">{t('nav.pokedex')}</Link>
        </div>
      ) : (
        <div className="poke-grid">
          {list.map(p => <PokemonCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
