import { useState, useEffect } from 'react';
import {
  FileText,
  RefreshCw,
  Download,
  HardDrive,
  Calendar,
} from 'lucide-react';
import { fetchOutputFiles } from '../../data/api';
import type { OutputFile } from '../../data/api';
import { cn } from '../../utils/cn';

/**
 * Format bytes into human-readable size.
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Format ISO date string into a readable short form.
 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-DE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function OutputFileList() {
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
    <div className="bg-bg-card/40 backdrop-blur-xl border border-border-primary/50 rounded-xl overflow-hidden shadow-xl shadow-black/10">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border-primary/30 flex items-center justify-between bg-bg-card/20">
        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-info" />
            Generated Files
          </h3>
          <p className="text-[10px] text-text-dim font-mono tracking-wider mt-0.5">
            {files.length} FILE{files.length !== 1 ? 'S' : ''} IN OUTPUT
          </p>
        </div>
        <button
          onClick={loadFiles}
          disabled={loading}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all',
            loading
              ? 'text-text-dim cursor-wait'
              : 'text-text-muted hover:text-text-primary hover:bg-bg-card/50'
          )}
        >
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading && files.length === 0 ? (
        <div className="p-8 flex items-center justify-center">
          <div className="flex items-center gap-2 text-text-muted">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span className="text-xs">Loading files...</span>
          </div>
        </div>
      ) : error ? (
        <div className="p-8 text-center">
          <p className="text-xs text-loss">{error}</p>
        </div>
      ) : files.length === 0 ? (
        <div className="p-8 text-center">
          <FileText className="w-8 h-8 text-text-dim mx-auto mb-2 opacity-30" />
          <p className="text-sm text-text-muted">No generated files yet</p>
          <p className="text-[10px] text-text-dim mt-1">
            CVs and cover letters will appear here after generation
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border-primary/30">
          {files.map((file, i) => (
            <div
              key={i}
              className="group flex items-center gap-4 px-5 py-3 hover:bg-bg-card-hover/80 transition-all duration-300"
            >
              <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0 shadow-sm shadow-black/20">
                <FileText className="w-4 h-4 text-accent" />
              </div>

              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-text-primary group-hover:text-accent transition-colors truncate block">
                  {file.filename}
                </span>
              </div>

              <div className="hidden sm:flex items-center gap-1 text-[10px] text-text-dim shrink-0">
                <HardDrive className="w-3 h-3" />
                <span className="font-mono">{formatSize(file.size)}</span>
              </div>

              <div className="hidden md:flex items-center gap-1 text-[10px] text-text-dim shrink-0">
                <Calendar className="w-3 h-3" />
                <span className="font-mono">{formatDate(file.modified)}</span>
              </div>

              {file.url && (
                <a
                  href={file.url.startsWith('http') ? file.url : `http://localhost:3001${file.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-[10px] font-bold uppercase tracking-wider shrink-0"
                >
                  <Download className="w-3 h-3" />
                  Get
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
