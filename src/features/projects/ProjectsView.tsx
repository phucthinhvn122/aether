import { useLiveQuery } from 'dexie-react-hooks';
import { Folder, FolderPlus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/Button';
import { PageHeader } from '../../components/PageHeader';
import { Skeleton } from '../../components/Skeleton';
import { db } from '../../lib/db';
import { navigate, routeHref } from '../../lib/router';
import { strings } from '../../lib/strings';
import { createProject } from './actions';
import { ProjectForm } from './ProjectForm';

export function ProjectsView() {
  const [creating, setCreating] = useState(false);
  const projects = useLiveQuery(async () => {
    const list = await db.projects.orderBy('createdAt').reverse().toArray();
    return Promise.all(
      list.map(async (p) => ({
        project: p,
        files: await db.projectFiles.where('projectId').equals(p.id).count(),
        chats: await db.conversations.where('projectId').equals(p.id).count(),
      })),
    );
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title={strings.projects.title}
        actions={
          !creating && (
            <Button variant="primary" onClick={() => setCreating(true)} className="mr-1">
              <FolderPlus className="size-4" aria-hidden />
              <span className="hidden sm:inline">{strings.projects.new}</span>
            </Button>
          )
        }
      />
      <div className="scroll-area pb-safe min-h-0 flex-1">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:py-10">
          <div>
            <h1 className="font-serif text-2xl text-ink sm:text-3xl">{strings.projects.title}</h1>
            <p className="mt-1 text-sm text-ink-faint">{strings.projects.subtitle}</p>
          </div>

          {creating && (
            <div className="rounded-2xl border border-line bg-surface p-4 sm:p-6 animate-fade-in">
              <ProjectForm
                submitLabel={strings.common.create}
                onCancel={() => setCreating(false)}
                onSubmit={async (name, instructions) => {
                  const id = await createProject(name, instructions);
                  navigate({ name: 'project', id });
                }}
              />
            </div>
          )}

          {!projects ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-28" />
              <Skeleton className="h-28" />
            </div>
          ) : projects.length === 0 && !creating ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line px-6 py-14 text-center">
              <Folder className="size-8 text-ink-faint" aria-hidden />
              <p className="max-w-sm text-sm text-ink-soft">{strings.projects.empty}</p>
              <Button variant="primary" onClick={() => setCreating(true)}>
                <FolderPlus className="size-4" aria-hidden />
                {strings.projects.new}
              </Button>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {projects.map(({ project, files, chats }) => (
                <li key={project.id}>
                  <a
                    href={routeHref({ name: 'project', id: project.id })}
                    className="flex h-full flex-col gap-2 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-ink-faint/50"
                  >
                    <span className="flex items-center gap-2 font-medium text-ink">
                      <Folder className="size-4 text-accent" aria-hidden />
                      <span className="truncate">{project.name}</span>
                    </span>
                    {project.instructions && <span className="line-clamp-2 text-sm text-ink-soft">{project.instructions}</span>}
                    <span className="mt-auto pt-1 text-xs text-ink-faint">
                      {strings.projects.fileCount(files)} · {strings.projects.chatCount(chats)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
