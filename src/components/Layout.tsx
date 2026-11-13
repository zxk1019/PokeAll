import { useEffect, type ReactNode } from 'react';
import { useI18n, LANGS, LANG_LABEL, type Key } from '../lib/i18n';
import { Link, useLocation } from '../lib/router';
import { useStored } from '../lib/storage';
import { useDb } from '../lib/data';
import { SearchBox } from './SearchBox';
import { SOURCES } from './ui';

type Theme = 'auto' | 'light' | 'dark';

export const NAV: { path: string; key: Key; icon?: string }[] = [
  { path: '/pokedex', key: 'nav.pokedex', icon: '◓' },
  { path: '/items', key: 'nav.items', icon: '🎒' },
  { path: '/abilities', key: 'nav.abilities', icon: '✦' },
  { path: '/moves', key: 'nav.moves', icon: '⚡' },
  { path: '/types', key: 'nav.types', icon: '◈' },
  { path: '/natures', key: 'nav.natures', icon: '♥' },
  { path: '/translator', key: 'nav.translator', icon: '文' },
  { path: '/compare', key: 'nav.compare', icon: '⇄' },
  { path: '/team', key: 'nav.team', icon: '⬡' },
  { path: '/games', key: 'nav.games', icon: '🎮' },
  { path: '/favorites', key: 'nav.favorites', icon: '★' },
];

const SECTION_OF: Record<string, string> = { pokemon: '/pokedex', item: '/items', ability: '/abilities', move: '/moves', quiz: '/games', cry: '/games', 'higher-lower': '/games', 'type-quiz': '/games', daily: '/games' };

export function Layout({ children }: { children: ReactNode }) {
  const { t, lang, setLang } = useI18n();
  const { parts } = useLocation();
  const { data: db } = useDb();
  const [theme, setTheme] = useStored<Theme>('theme', 'auto');

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  const current = '/' + (parts[0] ?? '');
  const activePath = SECTION_OF[parts[0] ?? ''] ?? current;
  const nextTheme: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };
  const themeIcon = { auto: '◐', light: '☀', dark: '☾' }[theme];

  return (
    <>
      <a href="#main" className="skip-link" onClick={e => { e.preventDefault(); document.getElementById('main')?.focus(); }}>↓</a>
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="logo" aria-label={t('nav.home')}>
            <span className="logo-ball" aria-hidden />
            <span className="logo-text">PokeAll</span>
          </Link>
          <SearchBox shortcut />
          <div className="topbar-actions">
            <div className="lang-switch" role="group" aria-label={t('language')}>
              {LANGS.map(l => (
                <button key={l} className={l === lang ? 'active' : ''} aria-pressed={l === lang} onClick={() => setLang(l)}>
                  {LANG_LABEL[l]}
                </button>
              ))}
            </div>
            <button className="btn icon-btn theme-btn" onClick={() => setTheme(nextTheme[theme])} title={t(`theme.${theme}`)} aria-label={t(`theme.${theme}`)}>
              {themeIcon}
            </button>
          </div>
        </div>
        <nav className="mainnav" aria-label="Main">
          <div className="mainnav-inner">
            {NAV.map(item => (
              <Link key={item.path} to={item.path} className={activePath === item.path ? 'active' : ''} aria-current={activePath === item.path ? 'page' : undefined}>
                {item.icon && <><span aria-hidden className="nav-icon">{item.icon}</span> </>}{t(item.key)}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>{children}</main>
      <footer className="footer">
        <p>{t('footer')}</p>
        {db && <p className="muted small">{t('dataDate', { date: db.meta.generated })} · <a href="https://pokeapi.co" target="_blank" rel="noreferrer">pokeapi.co</a></p>}
        <p className="muted small">
          {t('footerTexts')}{' '}
          {Object.entries(SOURCES).filter(([k]) => k !== 'api').map(([, s], i) => (
            <span key={s.url}>
              {i > 0 && ' · '}<a href={s.url} target="_blank" rel="noreferrer">{s.name}</a>
              {s.cc && <> (<a href="https://creativecommons.org/licenses/by-nc-sa/3.0/" target="_blank" rel="noreferrer">CC BY-NC-SA</a>)</>}
            </span>
          ))}
        </p>
      </footer>
    </>
  );
}
