import { db } from '../../lib/db';
import { readFileAsAttachment } from '../../lib/files';
import { uid } from '../../lib/id';
import type { Project } from '../../lib/types';

export async function createProject(name: string, instructions: string): Promise<string> {
  const id = uid();
  await db.projects.add({ id, name: name.trim(), instructions: instructions.trim(), createdAt: Date.now() });
  return id;
}

export async function updateProject(id: string, patch: Partial<Pick<Project, 'name' | 'instructions'>>): Promise<void> {
  await db.projects.update(id, patch);
}

export async function deleteProject(id: string): Promise<void> {
  await db.transaction('rw', db.projects, db.projectFiles, db.conversations, async () => {
    await db.projectFiles.where('projectId').equals(id).delete();
    await db.conversations.where('projectId').equals(id).modify((c) => {
      delete c.projectId;
    });
    await db.projects.delete(id);
  });
}

/** Extracts each file and stores it. Returns per-file error messages. */
export async function addProjectFiles(projectId: string, files: File[]): Promise<string[]> {
  const errors: string[] = [];
  for (const file of files) {
    try {
      const a = await readFileAsAttachment(file);
      await db.projectFiles.add({
        id: uid(),
        projectId,
        name: a.name,
        mime: a.mime,
        size: a.size,
        textExtract: a.textExtract ?? '',
        dataUrl: a.dataUrl,
        createdAt: Date.now(),
      });
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  return errors;
}

export async function deleteProjectFile(id: string): Promise<void> {
  await db.projectFiles.delete(id);
}
