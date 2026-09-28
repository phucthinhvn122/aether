import { createStore } from '../../lib/store';

const COLLAPSED_KEY = 'aether.sidebarCollapsed';

export const uiStore = createStore({
  /** Mobile drawer visibility. */
  drawerOpen: false,
  /** Desktop sidebar collapsed state. */
  sidebarCollapsed: localStorage.getItem(COLLAPSED_KEY) === '1',
});

export function openDrawer() {
  uiStore.set({ drawerOpen: true });
}

export function closeDrawer() {
  uiStore.set({ drawerOpen: false });
}

export function toggleSidebarCollapsed() {
  const next = !uiStore.get().sidebarCollapsed;
  localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0');
  uiStore.set({ sidebarCollapsed: next });
}
