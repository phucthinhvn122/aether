import { useEffect, useMemo } from 'react';
import { ChatView } from './features/chat/ChatView';
import { Sidebar } from './features/conversations/Sidebar';
import { closeDrawer } from './features/layout/uiStore';
import { ProjectDetail } from './features/projects/ProjectDetail';
import { ProjectsView } from './features/projects/ProjectsView';
import { SettingsView } from './features/settings/SettingsView';
import { parseRoute, useHash, type Route } from './lib/router';
import { DESKTOP_QUERY, useMediaQuery } from './lib/useMediaQuery';
import { useVisualViewport } from './lib/useVisualViewport';

function Screen({ route }: { route: Route }) {
  switch (route.name) {
    case 'chat':
      return <ChatView conversationId={route.id} />;
    case 'new':
      return <ChatView key={route.projectId ?? 'new'} newProjectId={route.projectId} />;
    case 'projects':
      return <ProjectsView />;
    case 'project':
      return <ProjectDetail projectId={route.id} />;
    case 'settings':
      return <SettingsView />;
  }
}

export function App() {
  useVisualViewport();
  const hash = useHash();
  const route = useMemo(() => parseRoute(hash), [hash]);
  const desktop = useMediaQuery(DESKTOP_QUERY);

  useEffect(() => {
    closeDrawer();
  }, [hash]);

  return (
    <div className="app-root flex overflow-hidden bg-bg">
      <Sidebar route={route} desktop={desktop} />
      <main className="pr-safe relative min-w-0 flex-1">
        <Screen route={route} />
      </main>
    </div>
  );
}
