import { useDb } from '../lib/data';
import { useI18n, type Key } from '../lib/i18n';
import { Link, useLocation } from '../lib/router';
import { KINDS, search } from '../lib/search';
import { Section, Status } from '../components/ui';
import { EntryIcon, entryPath, SearchBox } from '../components/SearchBox';

export function SearchPage() {
  const { data: db, error } = useDb();
  const { t, n, lang } = useI18n();
  const { query } = useLocation();
  const q = query.get('q') ?? '';
  if (!db) return <Status error={error} />;

  const results = search(db.search, q, { limit: 300 });
  const others = (l: Partial<Record<string, string>>) => (['zh', 'en', 'es'] as const).filter(x => x !== lang && l[x]).map(x => l[x]).join(' · ');

  return (
    <div className="page">
      <h1>{t('search.title', { q })}</h1>
      <SearchBox big />
      <p className="muted small">{t('search.hint')}</p>
      {results.length === 0 && <p className="empty">{t('search.noResults')}</p>}
      {KINDS.map(k => {
        const group = results.filter(e => e.kind === k);
        if (!group.length) return null;
        return (
          <Section key={k} title={<>{t(`kind.${k}` as Key)} <span className="muted small">({group.length})</span></>}>
            <ul className="row-list">
              {group.map(e => (
                <li key={e.id}>
                  <Link to={entryPath(e)} className="row-link">
                    <EntryIcon e={e} />
                    <span className="row-main">
                      <span className="row-title">{n(e.n)}</span>
                      <span className="row-sub">{others(e.n)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
    </div>
  );
}
