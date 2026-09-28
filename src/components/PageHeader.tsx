import { Menu, PanelLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { openDrawer, toggleSidebarCollapsed, uiStore } from '../features/layout/uiStore';
import { strings } from '../lib/strings';
import { IconButton } from './IconButton';

interface PageHeaderProps {
  title?: ReactNode;
  actions?: ReactNode;
  leading?: ReactNode;
}

export function PageHeader({ title, actions, leading }: PageHeaderProps) {
  const collapsed = uiStore.use((s) => s.sidebarCollapsed);
  return (
    <header className="pt-safe shrink-0 border-b border-line/60 bg-bg/90 backdrop-blur">
      <div className="flex h-14 items-center gap-1 px-2 lg:px-3">
        <IconButton label={strings.sidebar.openMenu} onClick={openDrawer} className="lg:hidden">
          <Menu className="size-5" aria-hidden />
        </IconButton>
        {collapsed && (
          <IconButton label={strings.sidebar.openMenu} onClick={toggleSidebarCollapsed} className="hidden lg:inline-flex">
            <PanelLeft className="size-5" aria-hidden />
          </IconButton>
        )}
        {leading}
        <div className="min-w-0 flex-1 truncate px-1 text-[15px] font-medium text-ink">{title}</div>
        {actions && <div className="flex items-center gap-1">{actions}</div>}
      </div>
    </header>
  );
}
