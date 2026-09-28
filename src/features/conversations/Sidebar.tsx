import { FolderOpen, PanelLeft, Plus, Search, Settings, X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { IconButton } from '../../components/IconButton';
import { Logo } from '../../components/Logo';
import { cn } from '../../lib/cn';
import { routeHref, type Route } from '../../lib/router';
import { strings } from '../../lib/strings';
import { closeDrawer, toggleSidebarCollapsed, uiStore } from '../layout/uiStore';
import { ConversationList } from './ConversationList';
import { useConversationSearch } from './useConversationSearch';

function NavLink({ href, icon, label, active }: { href: string; icon: ReactNode; label: string; active?: boolean }) {
  return (
    <a
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors lg:min-h-9',
        active ? 'bg-muted text-ink' : 'text-ink-soft hover:bg-muted/70 hover:text-ink',
      )}
    >
      {icon}
      {label}
    </a>
  );
}

function SidebarContent({ route, mobile }: { route: Route; mobile: boolean }) {
  const [query, setQuery] = useState('');
  const hits = useConversationSearch(query);
  const activeId = route.name === 'chat' ? route.id : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <div className="pt-safe shrink-0">
        <div className="flex h-14 items-center gap-2 pr-2 pl-4">
          <Logo className="size-5 text-accent" />
          <span className="flex-1 font-serif text-lg font-semibold tracking-tight text-ink">{strings.appName}</span>
          {mobile ? (
            <IconButton label={strings.sidebar.closeMenu} onClick={closeDrawer}>
              <X className="size-5" aria-hidden />
            </IconButton>
          ) : (
            <IconButton label={strings.sidebar.collapse} onClick={toggleSidebarCollapsed}>
              <PanelLeft className="size-5" aria-hidden />
            </IconButton>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-1 px-2">
        <a
          href={routeHref({ name: 'new' })}
          className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-accent-strong transition-colors hover:bg-accent-soft lg:min-h-9"
        >
          <span className="flex size-6 items-center justify-center rounded-full bg-accent text-on-accent">
            <Plus className="size-4" aria-hidden />
          </span>
          {strings.sidebar.newChat}
        </a>
        <NavLink
          href={routeHref({ name: 'projects' })}
          icon={<FolderOpen className="size-4" aria-hidden />}
          label={strings.sidebar.projects}
          active={route.name === 'projects' || route.name === 'project'}
        />
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint" aria-hidden />
          <label htmlFor="chat-search" className="sr-only">
            {strings.sidebar.search}
          </label>
          <input
            id="chat-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={strings.sidebar.search}
            className="h-11 w-full rounded-lg border border-transparent bg-muted/60 pr-3 pl-9 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-line focus:bg-surface lg:h-9 lg:text-sm"
          />
        </div>
      </div>

      <div className="scroll-area min-h-0 flex-1 px-2">
        <ConversationList hits={hits} activeId={activeId} searching={query.trim().length > 0} />
      </div>

      <div className="pb-safe shrink-0 border-t border-line/70 px-2 py-2">
        <NavLink
          href={routeHref({ name: 'settings' })}
          icon={<Settings className="size-4" aria-hidden />}
          label={strings.sidebar.settings}
          active={route.name === 'settings'}
        />
      </div>
    </div>
  );
}

export function Sidebar({ route, desktop }: { route: Route; desktop: boolean }) {
  const drawerOpen = uiStore.use((s) => s.drawerOpen);
  const collapsed = uiStore.use((s) => s.sidebarCollapsed);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeDrawer();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  if (desktop) {
    if (collapsed) return null;
    return (
      <aside className="pl-safe h-full w-72 shrink-0 border-r border-line/70" aria-label={strings.appName}>
        <SidebarContent route={route} mobile={false} />
      </aside>
    );
  }

  if (!drawerOpen) return null;
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={strings.appName}>
      <button
        type="button"
        aria-label={strings.sidebar.closeMenu}
        onClick={closeDrawer}
        className="absolute inset-0 bg-black/30 animate-fade-in"
      />
      <aside className="pl-safe absolute inset-y-0 left-0 w-[86%] max-w-80 shadow-2xl animate-slide-in">
        <SidebarContent route={route} mobile />
      </aside>
    </div>
  );
}
