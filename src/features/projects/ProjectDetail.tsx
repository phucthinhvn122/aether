import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, MessageSquare, SquarePen, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../../components/Button';
import { IconButton } from '../../components/IconButton';
import { PageHeader } from '../../components/PageHeader';
import { SkeletonLines } from '../../components/Skeleton';
import { db } from '../../lib/db';
import { navigate, routeHref } from '../../lib/router';
import { strings } from '../../lib/strings';
import { deleteProject, updateProject } from './actions';
import { ProjectFiles } from './ProjectFiles';
import { ProjectForm } from './ProjectForm';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-serif text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function ProjectDetail({ projectId }: { projectId: string }) {
  const project = useLiveQuery(() => db.projects.get(projectId).then((p) => p ?? null), [projectId]);
  const chats = useLiveQuery(
    () => db.conversations.where('projectId').equals(projectId).reverse().sortBy('updatedAt'),
    [projectId],
  );
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    if (project === null) navigate({ name: 'projects' }, true);
  }, [project]);

  const onDelete = async () => {
    if (!window.confirm(strings.projects.confirmDelete)) return;
    await deleteProject(projectId);
    navigate({ name: 'projects' }, true);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        leading={
          <IconButton label={strings.common.back} onClick={() => navigate({ name: 'projects' })}>
            <ArrowLeft className="size-5" aria-hidden />
          </IconButton>
        }
        title={project?.name}
        actions={
          <Button variant="primary" onClick={() => navigate({ name: 'new', projectId })} className="mr-1">
            <SquarePen className="size-4" aria-hidden />
            <span className="hidden sm:inline">{strings.projects.newChat}</span>
          </Button>
        }
      />
      <div className="scroll-area pb-safe min-h-0 flex-1">
        <div className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-6 sm:py-10">
          {!project ? (
            <SkeletonLines lines={6} />
          ) : (
            <>
              <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
                <ProjectForm
                  key={`${project.id}|${project.name}|${project.instructions}`}
                  initialName={project.name}
                  initialInstructions={project.instructions}
                  submitLabel={strings.common.save}
                  onSubmit={async (name, instructions) => {
                    await updateProject(project.id, { name: name.trim(), instructions: instructions.trim() });
                    setSavedAt(Date.now());
                  }}
                />
                {savedAt > 0 && <p className="mt-2 text-right text-xs text-ink-faint animate-fade-in">{strings.common.saved}</p>}
              </div>

              <Section title={strings.projects.files}>
                <ProjectFiles projectId={project.id} />
              </Section>

              <Section title={strings.projects.chats}>
                {!chats ? (
                  <SkeletonLines lines={2} />
                ) : chats.length === 0 ? (
                  <p className="text-sm text-ink-faint">{strings.projects.noChats}</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
                    {chats.map((c) => (
                      <li key={c.id}>
                        <a
                          href={routeHref({ name: 'chat', id: c.id })}
                          className="flex min-h-12 items-center gap-3 px-4 text-sm text-ink hover:bg-muted/60"
                        >
                          <MessageSquare className="size-4 shrink-0 text-ink-faint" aria-hidden />
                          <span className="truncate">{c.title}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
                <Button onClick={() => navigate({ name: 'new', projectId })} className="self-start">
                  <SquarePen className="size-4" aria-hidden />
                  {strings.projects.newChat}
                </Button>
              </Section>

              <div className="border-t border-line pt-6">
                <Button variant="danger" onClick={onDelete}>
                  <Trash2 className="size-4" aria-hidden />
                  {strings.projects.deleteProject}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
