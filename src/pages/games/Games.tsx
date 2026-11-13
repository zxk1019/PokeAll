import { useI18n, type Key } from '../../lib/i18n';
import { Link } from '../../lib/router';

// Minijuegos: para añadir uno, se crea su página en esta carpeta, su ruta en App.tsx y una línea aquí.
const GAMES: { path: string; title: Key; desc: Key; icon: string }[] = [
  { path: '/daily', title: 'daily.title', desc: 'games.daily', icon: '📅' },
  { path: '/quiz', title: 'quiz.title', desc: 'home.quiz', icon: '👤' },
  { path: '/cry', title: 'cry.title', desc: 'games.cry', icon: '🔊' },
  { path: '/higher-lower', title: 'hl.title', desc: 'games.hl', icon: '⚖' },
  { path: '/type-quiz', title: 'tq.title', desc: 'games.tq', icon: '◈' },
];

export function GamesPage() {
  const { t } = useI18n();
  return (
    <div className="page">
      <h1>{t('nav.games')}</h1>
      <div className="section-grid">
        {GAMES.map(g => (
          <Link key={g.path} to={g.path} className="card section-card">
            <span className="section-icon" aria-hidden>{g.icon}</span>
            <strong>{t(g.title)}</strong>
            <span className="muted small">{t(g.desc)}</span>
          </Link>
        ))}
      </div>
      <p className="muted small">{t('games.more')}</p>
    </div>
  );
}
