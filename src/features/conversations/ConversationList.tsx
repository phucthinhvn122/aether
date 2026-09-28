import { Skeleton } from '../../components/Skeleton';
import { dateGroup, type DateGroup } from '../../lib/format';
import { strings } from '../../lib/strings';
import { ConversationItem } from './ConversationItem';
import type { ConversationHit } from './useConversationSearch';

interface ConversationListProps {
  hits: ConversationHit[] | undefined;
  activeId?: string;
  searching: boolean;
}

const GROUP_ORDER: DateGroup[] = ['today', 'yesterday', 'week', 'older'];

function Group({ label, hits, activeId }: { label: string; hits: ConversationHit[]; activeId?: string }) {
  if (hits.length === 0) return null;
  return (
    <section className="flex flex-col gap-0.5">
      <h3 className="px-3 pt-4 pb-1 text-xs font-medium text-ink-faint">{label}</h3>
      {hits.map((h) => (
        <ConversationItem key={h.conversation.id} conversation={h.conversation} snippet={h.snippet} active={h.conversation.id === activeId} />
      ))}
    </section>
  );
}

export function ConversationList({ hits, activeId, searching }: ConversationListProps) {
  if (!hits) {
    return (
      <div className="flex flex-col gap-3 px-3 pt-5">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }
  if (hits.length === 0) {
    return <p className="px-3 pt-6 text-sm text-ink-faint">{searching ? strings.sidebar.noResults : strings.sidebar.noChats}</p>;
  }

  const pinned = hits.filter((h) => h.conversation.pinned);
  const rest = hits.filter((h) => !h.conversation.pinned);
  const now = Date.now();
  const grouped = GROUP_ORDER.map((g) => ({ g, items: rest.filter((h) => dateGroup(h.conversation.updatedAt, now) === g) }));

  return (
    <nav aria-label={strings.sidebar.recents} className="flex flex-col pb-4">
      <Group label={strings.sidebar.pinned} hits={pinned} activeId={activeId} />
      {grouped.map(({ g, items }) => (
        <Group key={g} label={strings.sidebar[g]} hits={items} activeId={activeId} />
      ))}
    </nav>
  );
}
