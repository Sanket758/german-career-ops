import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Inbox, ListTree, Radar } from 'lucide-react';
import {
  fetchPipeline,
  fetchScanHistory,
  triggerScan,
} from '../../data/api';
import type { ScanHistoryEntry } from '../../data/api';
import { cn } from '../../utils/cn';
import {
  ActionButton,
  ErrorBar,
  Panel,
  PanelHeader,
  SectionLabel,
  Spinner,
} from './ui';

type ScanState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; message: string }
  | { kind: 'error'; message: string };

/**
 * Portal scanner — trigger a scan, watch the pipeline queue, and review
 * scan history rows (dynamic TSV columns).
 */
export function ScanPanel() {
  const [pipeline, setPipeline] = useState<string[]>([]);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scan, setScan] = useState<ScanState>({ kind: 'idle' });

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [urls, rows] = await Promise.all([fetchPipeline(), fetchScanHistory()]);
      setPipeline(urls);
      setHistory(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scan data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleScan = async () => {
    if (scan.kind === 'running') return;

    setScan({ kind: 'running' });
    try {
      const result = await triggerScan();
      if (result.status === 'error' || result.status === 'failed') {
        setScan({ kind: 'error', message: result.message });
      } else {
        setScan({ kind: 'done', message: result.message });
        await loadAll();
      }
    } catch (err) {
      setScan({
        kind: 'error',
        message: err instanceof Error ? err.message : 'Scan failed to start',
      });
    }
  };

  const columns = useMemo(() => {
    const seen = new Set<string>();
    for (const row of history) {
      for (const key of Object.keys(row)) seen.add(key);
    }
    return Array.from(seen);
  }, [history]);

  return (
    <Panel>
      <PanelHeader
        icon={<Radar className="h-3.5 w-3.5" />}
        title="Portal Scan"
        eyebrow="Pipeline queue · scan history"
        tone="violet"
        right={
          <span
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em]',
              scan.kind === 'running'
                ? 'border-cyan-border bg-cyan-bg text-cyan'
                : scan.kind === 'done'
                  ? 'border-gain-border bg-gain-bg text-gain'
                  : scan.kind === 'error'
                    ? 'border-loss-border bg-loss-bg text-loss'
                    : 'border-border-secondary/60 bg-bg-secondary/60 text-text-dim'
            )}
          >
            <span
              aria-hidden
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                scan.kind === 'running'
                  ? 'animate-pulse-dot bg-cyan'
                  : scan.kind === 'done'
                    ? 'bg-gain'
                    : scan.kind === 'error'
                      ? 'bg-loss'
                      : 'bg-text-dim'
              )}
            />
            {scan.kind === 'running'
              ? 'Scanning'
              : scan.kind === 'done'
                ? 'Scan complete'
                : scan.kind === 'error'
                  ? 'Scan failed'
                  : 'Idle'}
          </span>
        }
      />

      <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-2">
        {/* Trigger + pipeline */}
        <div className="flex flex-col gap-5">
          <section>
            <SectionLabel className="mb-2">Trigger</SectionLabel>
            <ActionButton
              onClick={handleScan}
              loading={scan.kind === 'running'}
              disabled={scan.kind === 'running'}
              tone="violet"
            >
              {scan.kind === 'running' ? 'Scanning portals…' : 'Trigger Scan'}
            </ActionButton>

            {scan.kind === 'done' && (
              <p className="mt-2.5 rounded-md border border-gain-border bg-gain-bg px-3 py-2 text-[11px] leading-snug text-gain animate-slide-in">
                {scan.message || 'Scan finished — pipeline updated.'}
              </p>
            )}
            {scan.kind === 'error' && (
              <div className="mt-2.5 animate-slide-in">
                <ErrorBar message={scan.message} />
              </div>
            )}
          </section>

          <section className="flex min-h-0 flex-1 flex-col">
            <SectionLabel className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ListTree className="h-3 w-3" />
                Pipeline queue
              </span>
              <span className="tabular-nums text-text-muted">{pipeline.length}</span>
            </SectionLabel>

            {loading ? (
              <div className="flex flex-1 items-center justify-center rounded-md border border-border-primary/50 bg-bg-secondary/30 py-6">
                <Spinner label="Loading queue…" />
              </div>
            ) : pipeline.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border-secondary/60 bg-bg-secondary/20 px-4 py-8 text-center">
                <Inbox className="h-4 w-4 text-text-dim" />
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
                  No URLs queued
                </p>
              </div>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {pipeline.map((url, i) => (
                  <li
                    key={`${url}-${i}`}
                    className="group flex items-center gap-2.5 rounded-md border border-border-primary/50 bg-bg-secondary/40 px-2.5 py-1.5"
                  >
                    <span className="font-mono text-[9px] tabular-nums text-text-dim">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-text-secondary">
                      {url}
                    </span>
                    {url.startsWith('http') && (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open ${url}`}
                        className="text-text-dim opacity-0 transition-opacity group-hover:opacity-100 hover:text-cyan"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Scan history */}
        <section className="flex min-h-0 flex-col">
          <SectionLabel className="mb-2 flex items-center justify-between">
            <span>Scan history</span>
            <span className="tabular-nums text-text-muted">{history.length}</span>
          </SectionLabel>

          {loading ? (
            <div className="flex flex-1 items-center justify-center rounded-md border border-border-primary/50 bg-bg-secondary/30 py-6">
              <Spinner label="Loading history…" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border-secondary/60 bg-bg-secondary/20 px-4 py-8 text-center">
              <Radar className="h-4 w-4 text-text-dim" />
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-dim">
                No scans recorded yet
              </p>
            </div>
          ) : (
            <div className="max-h-72 overflow-auto rounded-md border border-border-primary/60">
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 bg-bg-card">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col}
                        scope="col"
                        className="whitespace-nowrap border-b border-border-primary/70 px-3 py-2 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-text-dim"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((row, i) => (
                    <tr key={i} className="odd:bg-bg-secondary/25 hover:bg-bg-input/50">
                      {columns.map((col) => (
                        <td
                          key={col}
                          className="max-w-[14rem] truncate border-b border-border-primary/40 px-3 py-1.5 font-mono text-[10px] text-text-secondary"
                          title={row[col] ?? ''}
                        >
                          {row[col] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {error && (
        <div className="border-t border-border-primary/70 p-4">
          <ErrorBar message={error} />
        </div>
      )}
    </Panel>
  );
}
