// Buscador con sugerencias. Se usa en la cabecera y (filtrando solo Pokémon) en Comparar y Equipo.
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useDb } from '../lib/data';
import { useI18n } from '../lib/i18n';
import { search, type Kind, type SearchEntry } from '../lib/search';
import { navigate } from '../lib/router';
import { ItemIcon, Sprite } from './ui';
import { typeSlug } from '../lib/pokemon';

export function entryPath(e: SearchEntry): string {
  switch (e.kind) {
    case 'p': return `/pokemon/${e.id}`;
    case 'i': return `/item/${e.id}`;
    case 'a': return `/ability/${e.id}`;
    case 'm': return `/move/${e.id}`;
    case 't': return `/types?sel=${e.id}`;
    case 'n': return `/natures?sel=${e.id}`;
  }
}

export function EntryIcon({ e, size = 32 }: { e: SearchEntry; size?: number }) {
  if (e.kind === 'p') return <Sprite id={e.id} size={size} />;
  if (e.kind === 'i') return <ItemIcon slug={String(e.extra)} size={size} />;
  if (e.kind === 'm') return <span className={`type-dot t-${typeSlug(Number(e.extra))}`} style={{ width: size / 2, height: size / 2 }} aria-hidden />;
  if (e.kind === 't') return <span className={`type-dot t-${typeSlug(e.id)}`} style={{ width: size / 2, height: size / 2 }} aria-hidden />;
  return <span className="kind-icon" aria-hidden>{e.kind === 'a' ? '✦' : '♥'}</span>;
}

interface Props {
  kinds?: Kind[];
  placeholder?: string;
  /** Si se pasa, al elegir un resultado se llama a esto en vez de navegar */
  onPick?: (e: SearchEntry) => void;
  autoFocus?: boolean;
  big?: boolean;
  shortcut?: boolean;
}

export function SearchBox({ kinds, placeholder, onPick, autoFocus, big, shortcut }: Props) {
  const { data: db } = useDb();
  const { t, n, lang } = useI18n();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const results = useMemo(() => (db && q.trim() ? search(db.search, q, { kinds, limit: 8 }) : []), [db, q, kinds]);

  // Atajo: "/" para ir al buscador
  useEffect(() => {
    if (!shortcut) return;
    const onKey = (ev: KeyboardEvent) => {
      const tag = (ev.target as HTMLElement)?.tagName;
      if (ev.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        ev.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shortcut]);

  const pick = (e: SearchEntry) => {
    setOpen(false);
    setQ('');
    if (onPick) onPick(e);
    else navigate(entryPath(e));
    input.current?.blur();
  };

  const onKeyDown = (ev: ReactKeyboardEvent) => {
    if (ev.key === 'ArrowDown') { ev.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, results.length - 1)); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (ev.key === 'Escape') { setOpen(false); }
    else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (results[active]) pick(results[active]);
      else if (!onPick && q.trim()) { navigate(`/search?q=${encodeURIComponent(q.trim())}`); setOpen(false); }
    }
  };

  const others = (e: SearchEntry) => (['zh', 'en', 'es'] as const).filter(l => l !== lang && e.n[l] && e.n[l] !== n(e.n)).map(l => e.n[l]).join(' · ');

  return (
    <div className={'searchbox' + (big ? ' big' : '')}>
      <input
        ref={input}
        type="search"
        value={q}
        placeholder={placeholder ?? t('search.placeholder')}
        autoFocus={autoFocus}
        onChange={ev => { setQ(ev.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={placeholder ?? t('search.placeholder')}
      />
      {shortcut && !q && <kbd className="kbd-hint" aria-hidden>/</kbd>}
      {open && q.trim() && (
        <ul className="suggestions" id={listId} role="listbox">
          {results.length === 0 && <li className="muted no-results">{t('search.noResults')}</li>}
          {results.map((e, i) => (
            <li
              key={e.kind + e.id}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseDown={ev => { ev.preventDefault(); pick(e); }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="sugg-icon"><EntryIcon e={e} /></span>
              <span className="sugg-text">
                <span className="sugg-name">{n(e.n)}</span>
                <span className="sugg-other">{others(e)}</span>
              </span>
              <span className="sugg-kind">{t(`kind.${e.kind}` as const)}</span>
            </li>
          ))}
          {!onPick && results.length > 0 && (
            <li className="see-all" onMouseDown={ev => { ev.preventDefault(); navigate(`/search?q=${encodeURIComponent(q.trim())}`); setOpen(false); }}>
              {t('search.seeAll')} →
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
