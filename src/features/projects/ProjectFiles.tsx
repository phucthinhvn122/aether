import { useLiveQuery } from 'dexie-react-hooks';
import { FileText, LoaderCircle, Trash2, TriangleAlert, Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { IconButton } from '../../components/IconButton';
import { Skeleton } from '../../components/Skeleton';
import { db } from '../../lib/db';
import { FILE_ACCEPT } from '../../lib/files';
import { formatBytes } from '../../lib/format';
import { strings } from '../../lib/strings';
import { addProjectFiles, deleteProjectFile } from './actions';

export function ProjectFiles({ projectId }: { projectId: string }) {
  const inputId = useId();
  const [uploading, setUploading] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const files = useLiveQuery(
    () => db.projectFiles.where('projectId').equals(projectId).reverse().sortBy('createdAt'),
    [projectId],
  );

  const onFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list);
    setErrors([]);
    setUploading((n) => n + picked.length);
    try {
      setErrors(await addProjectFiles(projectId, picked));
    } finally {
      setUploading((n) => n - picked.length);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label
        htmlFor={inputId}
        className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line bg-surface/50 px-4 py-5 text-center transition-colors hover:border-accent hover:bg-accent-soft/30"
      >
        {uploading > 0 ? (
          <LoaderCircle className="size-5 animate-spin text-accent" aria-hidden />
        ) : (
          <Upload className="size-5 text-ink-soft" aria-hidden />
        )}
        <span className="text-sm font-medium text-ink">{uploading > 0 ? strings.chat.extracting : strings.projects.upload}</span>
        <span className="text-xs text-ink-faint">{strings.projects.filesHint}</span>
        <input
          id={inputId}
          type="file"
          multiple
          accept={FILE_ACCEPT}
          className="sr-only"
          onChange={(e) => {
            void onFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {errors.map((err) => (
        <p key={err} role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm text-danger">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {err}
        </p>
      ))}

      {!files ? (
        <Skeleton className="h-14" />
      ) : files.length === 0 ? (
        <p className="text-sm text-ink-faint">{strings.projects.noFiles}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 py-2 pr-2 pl-3">
              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                {f.dataUrl ? <img src={f.dataUrl} alt="" className="size-full object-cover" /> : <FileText className="size-4 text-ink-soft" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{f.name}</span>
                <span className="block truncate text-xs text-ink-faint">
                  {formatBytes(f.size)} · {f.dataUrl ? strings.projects.imageFile : strings.projects.textChars(f.textExtract.length)}
                </span>
              </span>
              <IconButton
                label={`${strings.projects.deleteFile}: ${f.name}`}
                size="sm"
                onClick={() => void deleteProjectFile(f.id)}
              >
                <Trash2 className="size-4" aria-hidden />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
