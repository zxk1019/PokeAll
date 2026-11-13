// Router mínimo con # en la URL (#/pokemon/25). Así la web funciona en cualquier hosting estático sin configurar nada.
import { useMemo, useSyncExternalStore, type AnchorHTMLAttributes } from 'react';

const EVENT = 'app:navigate';
const getHash = () => window.location.hash.slice(1) || '/';
function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener('hashchange', cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function useLocation() {
  const hash = useSyncExternalStore(subscribe, getHash);
  return useMemo(() => {
    const [path, qs = ''] = hash.split('?');
    return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs) };
  }, [hash]);
}

export function navigate(to: string, replace = false) {
  if (replace) {
    history.replaceState(null, '', '#' + to);
    window.dispatchEvent(new Event(EVENT));
  } else {
    window.location.hash = to;
  }
}

/** Lee y cambia un parámetro de la URL (?type=10) sin añadir una entrada nueva al historial. */
export function useQueryParam(key: string, fallback = ''): [string, (v: string) => void] {
  const { path, query } = useLocation();
  const value = query.get(key) ?? fallback;
  const set = (v: string) => {
    const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
    if (v === '' || v === fallback) q.delete(key);
    else q.set(key, v);
    const s = q.toString();
    navigate(path + (s ? '?' + s : ''), true);
  };
  return [value, set];
}

export function Link({ to, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a href={'#' + to} {...rest} />;
}
