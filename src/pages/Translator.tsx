import { useMemo, useState } from 'react';
import { useDb, type Lang } from '../lib/data';
import { useI18n, LANGS, type Key } from '../lib/i18n';
import { Link, useQueryParam } from '../lib/router';
import { KINDS, search, type Kind } from '../lib/search';
import { Chips, Status } from '../components/ui';
import { EntryIcon, entryPath } from '../components/SearchBox';

const EXAMPLES = ['皮卡丘', 'Thunderbolt', 'Piedra Trueno', 'pkq', 'Levitate', '喷火龙'];

function CopyText({ text, lang }: { text?: string; lang: Lang }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  if (!text) return <span className="muted">—</span>;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1000);
    } catch { /* sin portapapeles */ }
  };
  return (
    <button className="copy-text" onClick={copy} title={t('tr.copy')} lang={lang === 'zh' ? 'zh-Hans' : lang}>
      {text} <span className="copy-icon" aria-hidden>{done ? '✓' : '⧉'}</span>
      <span className="sr-only">{done ? t('tr.copied') : t('tr.copy')}</span>
    </button>
  );
}

export function TranslatorPage() {
  const { data: db, error } = useDb();
  const { t } = useI18n();
  const [q, setQ] = useQueryParam('q');
  const [kind, setKind] = useQueryParam('kind');

  const results = useMemo(
    () => (db && q.trim() ? search(db.search, q, { kinds: kind ? [kind as Kind] : undefined, limit: 80 }) : []),
    [db, q, kind],
  );

  if (!db) return <Status error={error} />;

  return (
    <div className="page">
      <h1>{t('tr.title')}</h1>
      <p className="muted">{t('tr.hint')}</p>
      <div className="filters card">
        <input type="search" className="input big" autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder={t('tr.placeholder')} aria-label={t('tr.title')} />
        <Chips label={t('col.type')} value={kind} onChange={setKind}
          options={[{ value: '', label: t('all') }, ...KINDS.map(k => ({ value: k, label: t(`kind.${k}` as Key) }))]} />
        {!q && (
          <p className="small">
            {t('tr.examples')}{' '}
            {EXAMPLES.map(ex => <button key={ex} className="chip" onClick={() => setQ(ex)}>{ex}</button>)}
          </p>
        )}
      </div>

      {q.trim() && results.length === 0 && <p className="empty">{t('search.noResults')}</p>}
      {results.length > 0 && (
        <div className="table-wrap card flush">
          <table className="table translator">
            <thead>
              <tr>
                <th />
                {LANGS.map(l => <th key={l}>{t(`lang.${l}` as Key)}</th>)}
                <th className="hide-sm">{t('col.type')}</th>
              </tr>
            </thead>
            <tbody>
              {results.map(e => (
                <tr key={e.kind + e.id}>
                  <td><Link to={entryPath(e)} aria-label={e.n.en}><EntryIcon e={e} /></Link></td>
                  {LANGS.map(l => (
                    <td key={l}>
                      <CopyText text={e.n[l]} lang={l} />
                      {l === 'zh' && e.pinyin && <span className="pinyin">{e.pinyin}</span>}
                    </td>
                  ))}
                  <td className="hide-sm"><Link to={entryPath(e)} className="muted small">{t(`kind.${e.kind}` as Key)} →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
