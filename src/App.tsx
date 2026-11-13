import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { useI18n } from './lib/i18n';
import { Link, useLocation } from './lib/router';
import { Home } from './pages/Home';
import { Pokedex } from './pages/Pokedex';
import { PokemonPage } from './pages/PokemonPage';
import { ItemsPage, ItemPage } from './pages/Items';
import { AbilitiesPage, AbilityPage } from './pages/Abilities';
import { MovesPage, MovePage } from './pages/Moves';
import { TypesPage } from './pages/Types';
import { NaturesPage } from './pages/Natures';
import { TranslatorPage } from './pages/Translator';
import { ComparePage } from './pages/Compare';
import { TeamPage } from './pages/Team';
import { QuizPage } from './pages/Quiz';
import { FavoritesPage } from './pages/Favorites';
import { SearchPage } from './pages/SearchPage';

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="page narrow center">
      <h1>404</h1>
      <p>{t('notFound')}</p>
      <Link to="/" className="btn">{t('backHome')}</Link>
    </div>
  );
}

function Route() {
  const { parts } = useLocation();
  const [section, param] = parts;
  const id = Number(param);
  switch (section) {
    case undefined: return <Home />;
    case 'pokedex': return <Pokedex />;
    case 'pokemon': return <PokemonPage id={id} />;
    case 'items': return <ItemsPage />;
    case 'item': return <ItemPage id={id} />;
    case 'abilities': return <AbilitiesPage />;
    case 'ability': return <AbilityPage id={id} />;
    case 'moves': return <MovesPage />;
    case 'move': return <MovePage id={id} />;
    case 'types': return <TypesPage />;
    case 'natures': return <NaturesPage />;
    case 'translator': return <TranslatorPage />;
    case 'compare': return <ComparePage />;
    case 'team': return <TeamPage />;
    case 'quiz': return <QuizPage />;
    case 'favorites': return <FavoritesPage />;
    case 'search': return <SearchPage />;
    default: return <NotFound />;
  }
}

export default function App() {
  const { path } = useLocation();
  const { t } = useI18n();

  // Al cambiar de página, volver arriba
  useEffect(() => { window.scrollTo(0, 0); }, [path]);
  useEffect(() => { document.title = 'TriDex · ' + t('tagline'); }, [t]);

  return (
    <Layout>
      <Route />
    </Layout>
  );
}
