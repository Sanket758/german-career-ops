import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  Check,
  ChevronDown,
  ExternalLink,
  FileSearch,
  FileText,
  Loader2,
  MapPin,
  MessageSquare,
  Paperclip,
  Send,
  Tag,
  TrendingUp,
  X,
} from 'lucide-react';
import type { Application, ApplicationStatus } from '../types';
import { PriorityBadge, ScoreBadge, StatusBadge } from './StatusBadge';
import { updateApplicationStatus, generateCV, generateCoverLetter } from '../data/api';
import { cn } from '../utils/cn';

interface ApplicationDetailProps {
  application: Application;
  onClose: () => void;
  /** Called after a status update succeeds — lets the parent refresh its state. */
  onStatusChange?: (id: string, status: ApplicationStatus) => void;
}

/** 8 canonical statuses in flow order — the dropdown options. */
const STATUS_ORDER: ApplicationStatus[] = [
  'Evaluated',
  'Applied',
  'Responded',
  'Interview',
  'Offer',
  'Rejected',
  'Discarded',
  'SKIP',
];

/** Status token families — mirrors StatusBadge palette. */
const STATUS_META: Record<
  ApplicationStatus,
  { text: string; bg: string; border: string; dot: string; left: string }
> = {
  Evaluated: {
    text: 'text-status-evaluated',
    bg: 'bg-status-evaluated-bg',
    border: 'border-status-evaluated-border',
    dot: 'bg-status-evaluated',
    left: 'border-l-status-evaluated',
  },
  Applied: {
    text: 'text-status-applied',
    bg: 'bg-status-applied-bg',
    border: 'border-status-applied-border',
    dot: 'bg-status-applied',
    left: 'border-l-status-applied',
  },
  Responded: {
    text: 'text-status-responded',
    bg: 'bg-status-responded-bg',
    border: 'border-status-responded-border',
    dot: 'bg-status-responded',
    left: 'border-l-status-responded',
  },
  Interview: {
    text: 'text-status-interview',
    bg: 'bg-status-interview-bg',
    border: 'border-status-interview-border',
    dot: 'bg-status-interview',
    left: 'border-l-status-interview',
  },
  Offer: {
    text: 'text-status-offer',
    bg: 'bg-status-offer-bg',
    border: 'border-status-offer-border',
    dot: 'bg-status-offer',
    left: 'border-l-status-offer',
  },
  Rejected: {
    text: 'text-status-rejected',
    bg: 'bg-status-rejected-bg',
    border: 'border-status-rejected-border',
    dot: 'bg-status-rejected',
    left: 'border-l-status-rejected',
  },
  Discarded: {
    text: 'text-status-discarded',
    bg: 'bg-status-discarded-bg',
    border: 'border-status-discarded-border',
    dot: 'bg-status-discarded',
    left: 'border-l-status-discarded',
  },
  SKIP: {
    text: 'text-status-skip',
    bg: 'bg-status-skip-bg',
    border: 'border-status-skip-border',
    dot: 'bg-status-skip',
    left: 'border-l-status-skip',
  },
};

function matchTone(matchScore: number): string {
  if (matchScore >= 80) return 'text-gain';
  if (matchScore >= 70) return 'text-warn';
  if (matchScore >= 60) return 'text-info';
  return 'text-loss';
}

export function ApplicationDetail({ application: app, onClose, onStatusChange }: ApplicationDetailProps) {
  const [status, setStatus] = useState<ApplicationStatus>(app.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [applied, setApplied] = useState(false);
  const [cvState, setCvState] = useState<{ loading: boolean; error?: string; result?: string }>({ loading: false });
  const [clState, setClState] = useState<{ loading: boolean; error?: string; result?: string }>({ loading: false });

  // Re-sync local state when the viewed application changes
  // (the modal stays mounted as App swaps selectedApp).
  useEffect(() => {
    setStatus(app.status);
    setError(null);
    setMenuOpen(false);
    setSaving(false);
    setApplied(false);
    setCvState({ loading: false });
    setClState({ loading: false });
  }, [app]);

  // Escape closes the modal; page scroll is locked while it is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleStatusChange = async (next: ApplicationStatus) => {
    if (next === status || saving) return;
    setMenuOpen(false);

    // Optimistic update — revert on failure.
    const previous = status;
    setStatus(next);
    setError(null);
    setSaving(true);

    const result = await updateApplicationStatus(app.id, next);
    setSaving(false);
    if (!result.success) {
      setStatus(previous);
      setError(result.error || 'Could not update status — API unreachable.');
    } else {
      onStatusChange?.(app.id, next);
    }
  };

  const handleApplyNow = () => {
    if (app.jobUrl) window.open(app.jobUrl, '_blank', 'noopener,noreferrer');
  };

  const handleMarkApplied = async () => {
    if (saving || status === 'Applied') return;
    setSaving(true);
    setError(null);
    setApplied(true);
    const result = await updateApplicationStatus(app.id, 'Applied');
    setSaving(false);
    if (!result.success) {
      setApplied(false);
      setError(result.error || 'Could not mark as applied — API unreachable.');
    } else {
      setStatus('Applied');
      onStatusChange?.(app.id, 'Applied');
      window.setTimeout(() => setApplied(false), 2500);
    }
  };

  const handleGenerateCV = async () => {
    setCvState({ loading: true });
    const result = await generateCV({ company: app.company, role: app.role });
    if (!result.success || result.results.length === 0) {
      setCvState({ loading: false, error: 'CV generation failed — check the API server.' });
      return;
    }
    const first = result.results[0];
    if (first.error) {
      setCvState({ loading: false, error: first.error });
      return;
    }
    const href = first.pdf && (first.pdf.startsWith('http') ? first.pdf : `http://localhost:3001${first.pdf}`);
    setCvState({ loading: false, result: href || undefined });
  };

  const handleGenerateCoverLetter = async () => {
    setClState({ loading: true });
    const result = await generateCoverLetter({ company: app.company, role: app.role, jobUrl: app.jobUrl || undefined });
    if (!result.success) {
      setClState({ loading: false, error: result.error || 'Cover letter generation failed — check the API server.' });
      return;
    }
    const href = result.pdf && (result.pdf.startsWith('http') ? result.pdf : `http://localhost:3001${result.pdf}`);
    setClState({ loading: false, result: href || undefined });
  };

  const meta = STATUS_META[status];
  const hasJobUrl = Boolean(app.jobUrl);
  const hasPdf = Boolean(app.pdf) && app.pdf !== '❌';
  const hasReport = Boolean(app.report) && app.report !== 'N/A' && app.report !== '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${app.company} — ${app.role}`}
    >
      {/* Backdrop — click to close */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel — status-colored left edge accent */}
      <div
        className={cn(
          'relative w-full max-w-2xl bg-bg-card border border-border-primary rounded-2xl border-l-2 shadow-panel animate-slide-in max-h-[90vh] overflow-y-auto',
          meta.left
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-bg-card/95 backdrop-blur border-b border-border-primary px-6 py-4 flex items-start justify-between gap-4 rounded-t-2xl">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-bold text-text-primary truncate">{app.company}</h2>
              <StatusBadge status={status} />
            </div>
            <p className="text-sm text-text-secondary truncate mt-0.5">{app.role}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status control strip */}
        <div className="px-6 py-3.5 border-b border-border-primary flex flex-wrap items-center gap-3">
          <div className="relative">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              disabled={saving}
              className={cn(
                'inline-flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-md border text-[11px] font-mono font-semibold tracking-wide transition-all',
                meta.bg,
                meta.text,
                meta.border,
                saving ? 'opacity-60 cursor-wait' : 'hover:brightness-110'
              )}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', meta.dot)} />
              {status}
              {saving ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ChevronDown
                  className={cn('w-3 h-3 transition-transform', menuOpen && 'rotate-180')}
                />
              )}
            </button>

            {menuOpen && (
              <>
                {/* Click-catcher behind the menu */}
                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                <div className="absolute left-0 top-full mt-1.5 z-20 w-48 rounded-lg border border-border-primary bg-bg-card shadow-panel py-1 animate-fade-in">
                  {STATUS_ORDER.map((s) => {
                    const m = STATUS_META[s];
                    return (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        className={cn(
                          'w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] font-mono transition-colors',
                          s === status
                            ? cn(m.bg, m.text)
                            : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                        )}
                      >
                        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', m.dot)} />
                        <span className="truncate">{s}</span>
                        {s === status && <Check className="w-3 h-3 ml-auto shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <PriorityBadge priority={app.priority} />
          <span
            className={cn(
              'inline-flex items-center gap-1.5 font-mono text-xs font-bold tabular-nums',
              matchTone(app.matchScore)
            )}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            {app.matchScore}%
          </span>
          <ScoreBadge score={app.score} />
          <span className="ml-auto font-mono text-[10px] text-text-dim tracking-[0.18em] uppercase">
            ID {app.id}
          </span>
        </div>

        {/* Inline error — status update failed */}
        {error && (
          <div className="mx-6 mt-4 px-3 py-2 rounded-lg border border-loss-border bg-loss-bg flex items-center gap-2 text-[11px] text-loss animate-fade-in">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="min-w-0">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Details grid */}
        <div className="px-6 py-5 grid grid-cols-2 gap-x-6 gap-y-4">
          <DetailItem icon={<MapPin className="w-4 h-4" />} label="Location" value="Berlin, Germany" />
          <DetailItem icon={<Calendar className="w-4 h-4" />} label="Applied" value={app.date} />
          <DetailItem
            icon={<TrendingUp className="w-4 h-4" />}
            label="Match"
            value={`${app.matchScore}%`}
          />
          <DetailItem icon={<Paperclip className="w-4 h-4" />} label="Score" value={app.score} />
        </div>

        {/* Artifacts — job posting, PDF, report */}
        <div className="mx-6 rounded-xl border border-border-primary/60 bg-bg-secondary/40 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border-primary/40 flex items-center gap-2">
            <Paperclip className="w-3.5 h-3.5 text-text-dim" />
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-text-dim">
              Artifacts
            </span>
          </div>
          <div className="p-1.5 flex flex-col">
            {hasJobUrl && app.jobUrl && (
              <ArtifactRow
                href={app.jobUrl}
                icon={<ExternalLink className="w-3.5 h-3.5" />}
                badgeClass="bg-accent-bg text-accent"
                title="Job Posting"
                subtitle={app.jobUrl}
              />
            )}
            {hasPdf && (
              <ArtifactRow
                href={app.pdf}
                icon={<FileText className="w-3.5 h-3.5" />}
                badgeClass="bg-gain-bg text-gain"
                title="Generated PDF"
                subtitle={app.pdf}
              />
            )}
            {hasReport && (
              <ArtifactRow
                href={app.report}
                icon={<FileSearch className="w-3.5 h-3.5" />}
                badgeClass="bg-info-bg text-info"
                title="Evaluation Report"
                subtitle={app.report}
              />
            )}
            {!hasJobUrl && !hasPdf && !hasReport && (
              <div className="px-2.5 py-3 text-[11px] text-text-dim">
                No external links available for this application.
              </div>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-2.5">
            <MessageSquare className="w-3.5 h-3.5 text-text-dim" />
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-text-dim">
              Notes
            </span>
          </div>
          <p className="text-[13px] text-text-secondary leading-relaxed">
            {app.notes || 'No notes added.'}
          </p>
        </div>

        {/* Tags */}
        <div className="px-6 pb-5">
          <div className="flex items-center gap-2 mb-2.5">
            <Tag className="w-3.5 h-3.5 text-text-dim" />
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-text-dim">
              Tags
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {app.tags.length > 0 ? (
              app.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 rounded-md bg-bg-secondary border border-border-primary text-[11px] font-mono text-text-secondary"
                >
                  {tag}
                </span>
              ))
            ) : (
              <span className="text-xs text-text-muted">No tags</span>
            )}
          </div>
        </div>

        {/* Footer — apply flow */}
        <div className="px-6 py-4 border-t border-border-primary space-y-3">
          <div className="flex items-center gap-3">
            {hasJobUrl ? (
              <button
                onClick={handleApplyNow}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors shadow-glow-accent"
              >
                <Send className="w-3.5 h-3.5" />
                Apply Now
              </button>
            ) : (
              <span className="flex-1 text-center font-mono text-[10px] text-text-dim uppercase tracking-[0.18em]">
                No job posting linked
              </span>
            )}
            <button
              onClick={handleMarkApplied}
              disabled={saving || status === 'Applied'}
              className={cn(
                'flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-colors',
                applied
                  ? 'bg-gain-bg text-gain border border-gain-border'
                  : status === 'Applied'
                    ? 'bg-bg-secondary text-text-muted cursor-not-allowed'
                    : 'bg-cyan/15 text-cyan border border-cyan/30 hover:bg-cyan/25'
              )}
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : applied ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <ExternalLink className="w-3.5 h-3.5" />
              )}
              {applied ? 'Marked as Applied ✓' : status === 'Applied' ? 'Applied' : 'Mark as Applied'}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGenerateCV}
              disabled={cvState.loading}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg border border-border-primary text-[11px] text-text-secondary hover:bg-bg-secondary/50 hover:text-text-primary transition-colors"
            >
              {cvState.loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <FileText className="w-3 h-3" />
              )}
              {cvState.loading ? 'Generating CV…' : 'Tailored CV'}
            </button>
            <button
              onClick={handleGenerateCoverLetter}
              disabled={clState.loading}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg border border-border-primary text-[11px] text-text-secondary hover:bg-bg-secondary/50 hover:text-text-primary transition-colors"
            >
              {clState.loading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <MessageSquare className="w-3 h-3" />
              )}
              {clState.loading ? 'Generating…' : 'Cover Letter'}
            </button>
          </div>

          {cvState.error && (
            <p className="text-[10px] text-loss">{cvState.error}</p>
          )}
          {clState.error && (
            <p className="text-[10px] text-loss">{clState.error}</p>
          )}
          {cvState.result && (
            <a
              href={cvState.result}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-gain hover:text-gain/80 font-medium"
            >
              <FileText className="w-3 h-3" />
              CV ready — open PDF
              <ArrowUpRight className="w-3 h-3" />
            </a>
          )}
          {clState.result && (
            <a
              href={clState.result}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-gain hover:text-gain/80 font-medium"
            >
              <FileText className="w-3 h-3" />
              Cover letter ready — open PDF
              <ArrowUpRight className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function ArtifactRow({
  href,
  icon,
  badgeClass,
  title,
  subtitle,
}: {
  href: string;
  icon: ReactNode;
  badgeClass: string;
  title: string;
  subtitle: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-bg-card-hover transition-colors"
    >
      <span className={cn('p-1.5 rounded-md shrink-0', badgeClass)}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-text-primary truncate">{title}</span>
        <span className="block font-mono text-[10px] text-text-dim truncate">{subtitle}</span>
      </span>
      <ArrowUpRight className="w-3.5 h-3.5 text-text-dim ml-auto shrink-0 group-hover:text-accent transition-colors" />
    </a>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-bg-secondary border border-border-primary/60 flex items-center justify-center text-text-dim shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-text-dim">
          {label}
        </p>
        <p className="text-xs text-text-primary font-semibold mt-1 break-words">{value}</p>
      </div>
    </div>
  );
}
