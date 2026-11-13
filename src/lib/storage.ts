// Guardado en el navegador (favoritos, equipo, idioma, tema...).
// Todo va con try/catch porque en modo incógnito o con cookies bloqueadas localStorage puede fallar.
import { useSyncExternalStore } from 'react';

const PREFIX = 'tridex:';
const listeners = new Set<() => void>();
const memory = new Map<string, string>(); // por si localStorage no funciona

function read(key: string): string | null {
  try {
    const v = localStorage.getItem(PREFIX + key);
    if (v !== null) return v;
  } catch { /* sin almacenamiento */ }
  return memory.get(key) ?? null;
}

function write(key: string, value: string) {
  memory.set(key, value);
  try { localStorage.setItem(PREFIX + key, value); } catch { /* sin almacenamiento */ }
  listeners.forEach(l => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key?.startsWith(PREFIX)) cb(); };
  window.addEventListener('storage', onStorage); // cambios desde otra pestaña
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}

export function useStored<T>(key: string, fallback: T): [T, (v: T) => void] {
  const raw = useSyncExternalStore(subscribe, () => read(key));
  let value = fallback;
  if (raw !== null) {
    try { value = JSON.parse(raw) as T; } catch { /* valor roto: usamos el de por defecto */ }
  }
  return [value, (v: T) => write(key, JSON.stringify(v))];
}

export function getStored<T>(key: string, fallback: T): T {
  const raw = read(key);
  if (raw === null) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

export function useFavorites() {
  const [favs, setFavs] = useStored<number[]>('favorites', []);
  const toggle = (id: number) => setFavs(favs.includes(id) ? favs.filter(x => x !== id) : [...favs, id]);
  return { favs, isFav: (id: number) => favs.includes(id), toggle };
}

export const TEAM_SIZE = 6;
export function useTeam() {
  const [team, setTeam] = useStored<number[]>('team', []);
  return {
    team,
    setTeam,
    add: (id: number) => { if (team.length < TEAM_SIZE) setTeam([...team, id]); },
    has: (id: number) => team.includes(id),
    isFull: team.length >= TEAM_SIZE,
  };
}
