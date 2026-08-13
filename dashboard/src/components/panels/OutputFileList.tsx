import { useEffect, useState } from 'react';
import {
  Calendar,
  Download,
  FileText,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { fetchOutputFiles } from '../../data/api';
import type { OutputFile } from '../../data/api';
import { cn } from '../../utils/cn';
import { ErrorBar, GhostButton, Panel, PanelHeader, Spinner } from './ui';

/**
 * Format bytes into a human-readable size (mono numerals).
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format an ISO timestamp into a short date-time readout.
 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Grid of generated output files (CVs / cover letters) with size, date and
 * a direct download link.
 *
 * Exported under both `OutputFilesPanel` (canonical) and `OutputFileList`
 * (kept for backwards compatibility with the original tab wiring).
 */
export function OutputFilesPanel() {
  const [files, setFiles] = useState<OutputFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchOutputFiles();
      setFiles(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  return (
    <Panel>
      <PanelHeader
        icon={<HardDrive className="h-3.5 w-3.5" />}
        title="Output Files"
        eyebrow={`${files.length} file${files.length === 1 ? '' : 's'} in output/`}
        tone="info"
        right={
          <GhostButton onClick={loadFiles} disabled={loading}>
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
            Refresh
          </GhostButton>
        }
      />

      {loading && files.length === 0 ? (
        <div className="flex items-center justify-center p-10">
          <Spinner label="Loading files…" />
        </div>
      ) : error ? (
        <div className="p-5">
          <ErrorBar message={error} />
        </div>
      ) : files.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-b-panel border-t border-border-primary/60 px-6 py-14 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border-secondary/60 bg-bg-secondary/60">
            <FileText className="h-4.5 w-4.5 text-text-dim" />
          </span>
          <p className="text-sm font-medium text-text-primary">No generated files yet</p>
          <p className="max-w-sm font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
            CVs and cover letters appear here after generation
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {files.map((file, i) => {
            const href =
              file.url &&
              (file.url.startsWith('http') ? file.url : `http://localhost:3001${file.url}`);

            return (
              <div
                key={i}
                className="group flex flex-col gap-3 rounded-md border border-border-primary/70 bg-bg-secondary/40 p-3.5 transition-colors hover:border-cyan/30 hover:bg-bg-input/40"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-accent-border bg-accent-bg">
                    <FileText className="h-4 w-4 text-accent" />
                  </span>
                  <span
                    title={file.filename}
                    className="min-w-0 flex-1 truncate pt-0.5 font-mono text-[11px] font-medium text-text-primary"
                  >
                    {file.filename}
                  </span>
                </div>

                <div className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.12em] text-text-dim">
                  <span className="flex items-center gap-1">
                    <HardDrive className="h-2.5 w-2.5" />
                    <span className="tabular-nums">{formatSize(file.size)}</span>
                  </span>
                  <span className="flex min-w-0 items-center gap-1">
                    <Calendar className="h-2.5 w-2.5 shrink-0" />
                    <span className="truncate">{formatDate(file.modified)}</span>
                  </span>
                </div>

                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-accent-border bg-accent-bg px-2 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-accent opacity-80 transition-all hover:border-accent/50 hover:bg-accent/15 hover:opacity-100 group-hover:opacity-100"
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

/** Backwards-compatible export name (original tab wiring). */
export { OutputFilesPanel as OutputFileList };
