import { useState, useEffect, type FormEvent } from 'react';
import {
  Briefcase,
  Building2,
  Loader2,
  X,
  Check,
  AlertTriangle,
  Tag,
  FileText,
} from 'lucide-react';
import type { ApplicationStatus } from '../types';
import { addApplication } from '../data/api';
import { cn } from '../utils/cn';

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

interface NewApplicationModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function NewApplicationModal({ onClose, onCreated }: NewApplicationModalProps) {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<ApplicationStatus>('Evaluated');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const canSave = company.trim().length > 0 && role.trim().length > 0 && !saving;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);

    const result = await addApplication({
      company: company.trim(),
      role: role.trim(),
      status,
      notes: url.trim() || notes.trim() || undefined,
    });

    setSaving(false);
    if (!result.success) {
      setError(result.error || 'Could not create application — API offline.');
      return;
    }
    onCreated();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="New Application"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-lg bg-bg-card border border-border-primary rounded-2xl border-l-2 border-l-cyan shadow-panel animate-slide-in max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 bg-bg-card/95 backdrop-blur border-b border-border-primary px-6 py-4 flex items-start justify-between gap-4 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent-border bg-accent-bg text-accent">
              <Briefcase className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-text-primary">New Application</h2>
              <p className="font-mono text-[9px] uppercase tracking-widest text-text-dim">
                Add to tracker · applications.md
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="flex items-center gap-1.5 mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-text-dim">
                <Building2 className="h-3 w-3" /> Company *
              </span>
              <input
                type="text"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="e.g. SAP, Siemens"
                autoFocus
                className="w-full rounded-lg border border-border-secondary/70 bg-bg-input/50 px-3 py-2 text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
              />
            </label>
            <label className="block">
              <span className="flex items-center gap-1.5 mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-text-dim">
                <Tag className="h-3 w-3" /> Role *
              </span>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. ML Engineer"
                className="w-full rounded-lg border border-border-secondary/70 bg-bg-input/50 px-3 py-2 text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
              />
            </label>
          </div>

          <label className="block">
            <span className="flex items-center gap-1.5 mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-text-dim">
              <FileText className="h-3 w-3" /> Job URL
            </span>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://jobs.portal.com/…"
              className="w-full rounded-lg border border-border-secondary/70 bg-bg-input/50 px-3 py-2 text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 mb-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-text-dim">
              <Briefcase className="h-3 w-3" /> Initial Status
            </span>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    'rounded-full border px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider transition-colors',
                    s === status
                      ? 'border-accent/50 bg-accent/15 text-accent'
                      : 'border-border-primary/60 bg-bg-card/40 text-text-muted hover:border-accent/40 hover:text-text-secondary'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="flex items-center gap-1.5 mb-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-text-dim">
              Notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional context — stored when no URL is given"
              className="w-full resize-none rounded-lg border border-border-secondary/70 bg-bg-input/50 px-3 py-2 text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20"
            />
          </label>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-loss-border bg-loss-bg px-3 py-2 text-[11px] text-loss animate-fade-in">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border-primary flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-border-primary text-xs text-text-secondary hover:bg-bg-secondary/50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className={cn(
              'flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold transition-colors',
              canSave
                ? 'bg-accent hover:bg-accent/90 text-white shadow-glow-accent'
                : 'bg-bg-secondary text-text-muted cursor-not-allowed'
            )}
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            {saving ? 'Creating…' : 'Create Application'}
          </button>
        </div>
      </form>
    </div>
  );
}
