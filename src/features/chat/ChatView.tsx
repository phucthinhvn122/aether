import { useLiveQuery } from 'dexie-react-hooks';
import { Folder, PanelRight, SquarePen } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { IconButton } from '../../components/IconButton';
import { PageHeader } from '../../components/PageHeader';
import { SkeletonLines } from '../../components/Skeleton';
import { db } from '../../lib/db';
import { navigate, routeHref } from '../../lib/router';
import { strings } from '../../lib/strings';
import type { Attachment } from '../../lib/types';
import { DESKTOP_QUERY, useMediaQuery } from '../../lib/useMediaQuery';
import { ArtifactPanel } from '../artifacts/ArtifactPanel';
import { artifactStore, closeArtifact, openArtifact } from '../artifacts/artifactStore';
import { ModelMenu } from '../models/ModelMenu';
import { isConfigured, useSettings } from '../settings/useSettings';
import { Composer } from './Composer';
import { Greeting, NotConfigured, Suggestions } from './EmptyState';
import { MessageList } from './MessageList';
import { editAndResend, regenerate, sendMessage, stopGeneration } from './runner';
import { useConversationView } from './useConversationView';
import { useStickToBottom } from './useStickToBottom';

interface ChatViewProps {
  conversationId?: string;
  /** Project for a brand-new chat (route #/new/:projectId). */
  newProjectId?: string;
}

export function ChatView({ conversationId, newProjectId }: ChatViewProps) {
  const settings = useSettings();
  const configured = isConfigured(settings);
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const { conversation, project, messages, loading, artifacts, streamingId, phase } = useConversationView(conversationId);
  const newProject = useLiveQuery(() => (newProjectId ? db.projects.get(newProjectId) : undefined), [newProjectId]);
  const openArtifactId = artifactStore.use((s) => s.openId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streaming = streamingId !== null;

  const scrollToBottom = useStickToBottom(scrollRef, [messages], conversationId);

  useEffect(() => {
    if (conversationId && conversation === null) navigate({ name: 'new' }, true);
  }, [conversationId, conversation]);

  const activeProject = project ?? newProject ?? undefined;
  const panelOpen = openArtifactId !== null && artifacts.has(openArtifactId);

  const onSend = async (text: string, attachments: Attachment[]) => {
    const id = await sendMessage({ conversationId, projectId: conversationId ? undefined : newProjectId, text, attachments });
    if (!conversationId) navigate({ name: 'chat', id }, true);
    requestAnimationFrame(scrollToBottom);
  };

  const onRegenerate = useCallback(() => {
    if (conversationId) void regenerate(conversationId);
  }, [conversationId]);

  const onEdit = useCallback((messageId: string, content: string) => {
    void editAndResend(messageId, content);
  }, []);

  const toggleArtifacts = () => {
    if (panelOpen) return closeArtifact();
    const lastId = Array.from(artifacts.keys()).pop();
    if (lastId && conversationId) openArtifact(conversationId, lastId);
  };

  const empty = !loading && messages.length === 0;
  const composer = (
    <Composer
      onSend={onSend}
      onStop={stopGeneration}
      streaming={streaming}
      disabled={!configured}
      placeholder={empty ? strings.chat.placeholder : strings.chat.replyPlaceholder}
      autoFocus
      tools={settings?.baseUrl.trim() ? <ModelMenu /> : undefined}
    />
  );

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <PageHeader
          title={
            <span className="flex min-w-0 items-center gap-2">
              {activeProject && (
                <a
                  href={routeHref({ name: 'project', id: activeProject.id })}
                  className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg px-1.5 text-ink-faint hover:bg-muted hover:text-ink"
                >
                  <Folder className="size-4" aria-hidden />
                  <span className="max-w-32 truncate text-sm">{activeProject.name}</span>
                  <span aria-hidden>/</span>
                </a>
              )}
              <span className="truncate">{conversation?.title ?? (empty ? '' : strings.chat.untitled)}</span>
            </span>
          }
          actions={
            <>
              {artifacts.size > 0 && (
                <IconButton
                  label={panelOpen ? strings.chat.hideArtifacts : strings.chat.showArtifacts}
                  active={panelOpen}
                  onClick={toggleArtifacts}
                >
                  <PanelRight className="size-5" aria-hidden />
                </IconButton>
              )}
              <IconButton
                label={strings.sidebar.newChat}
                onClick={() => navigate(activeProject ? { name: 'new', projectId: activeProject.id } : { name: 'new' })}
                className="lg:hidden"
              >
                <SquarePen className="size-5" aria-hidden />
              </IconButton>
            </>
          }
        />

        {empty ? (
          <div className="scroll-area flex min-h-0 flex-1 flex-col items-center justify-center gap-8 px-4 pb-10">
            <Greeting projectName={activeProject?.name} />
            <div className="flex w-full max-w-2xl flex-col gap-4">
              {settings && !configured && <NotConfigured />}
              {composer}
              {configured && <Suggestions onPick={(s) => void onSend(s, [])} />}
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="scroll-area min-h-0 flex-1">
              {loading ? (
                <div className="mx-auto max-w-3xl px-6 py-10">
                  <SkeletonLines lines={5} />
                </div>
              ) : (
                <MessageList
                  messages={messages}
                  streamingId={streamingId}
                  phase={phase}
                  artifacts={artifacts}
                  openArtifactId={openArtifactId}
                  onRegenerate={onRegenerate}
                  onEdit={onEdit}
                />
              )}
            </div>
            <div className="pb-safe shrink-0 bg-gradient-to-t from-bg via-bg to-bg/0 px-3 pt-2 sm:px-6">
              <div className="mx-auto w-full max-w-3xl pb-3">
                {settings && !configured && (
                  <div className="mb-2">
                    <NotConfigured />
                  </div>
                )}
                {composer}
                <p className="mt-2 hidden text-center text-[11px] text-ink-faint sm:block">{strings.chat.disclaimer}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {panelOpen && desktop && (
        <div className="w-[46%] min-w-[380px] max-w-[760px] shrink-0">
          <ArtifactPanel index={artifacts} sheet={false} />
        </div>
      )}
      {panelOpen && !desktop && <ArtifactPanel index={artifacts} sheet />}
    </div>
  );
}
