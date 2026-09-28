import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'new'; projectId?: string }
  | { name: 'chat'; id: string }
  | { name: 'projects' }
  | { name: 'project'; id: string }
  | { name: 'settings' };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'c':
      return parts[1] ? { name: 'chat', id: parts[1] } : { name: 'new' };
    case 'new':
      return { name: 'new', projectId: parts[1] };
    case 'projects':
      return { name: 'projects' };
    case 'p':
      return parts[1] ? { name: 'project', id: parts[1] } : { name: 'projects' };
    case 'settings':
      return { name: 'settings' };
    default:
      return { name: 'new' };
  }
}

export function routeHref(route: Route): string {
  switch (route.name) {
    case 'new':
      return route.projectId ? `#/new/${encodeURIComponent(route.projectId)}` : '#/';
    case 'chat':
      return `#/c/${encodeURIComponent(route.id)}`;
    case 'projects':
      return '#/projects';
    case 'project':
      return `#/p/${encodeURIComponent(route.id)}`;
    case 'settings':
      return '#/settings';
  }
}

export function navigate(route: Route, replace = false): void {
  const href = routeHref(route);
  if (replace) window.history.replaceState(null, '', href);
  else window.history.pushState(null, '', href);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  window.addEventListener('popstate', cb);
  return () => {
    window.removeEventListener('hashchange', cb);
    window.removeEventListener('popstate', cb);
  };
}

export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash);
}
