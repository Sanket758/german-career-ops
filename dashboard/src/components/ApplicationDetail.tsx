import type { Application } from '../types';
import { StatusBadge, PriorityBadge, ScoreBadge } from './StatusBadge';
import { cn } from '../utils/cn';
import {
  X,
  MapPin,
  DollarSign,
  Calendar,
  ArrowRight,
  Tag,
  MessageSquare,
  ExternalLink,
  TrendingUp,
  Clock,
} from 'lucide-react';

interface ApplicationDetailProps {
  application: Application;
  onClose: () => void;
}

export function ApplicationDetail({ application: app, onClose }: ApplicationDetailProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl bg-bg-card border border-border-primary rounded-2xl shadow-2xl shadow-black/40 animate-slide-in max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-bg-card border-b border-border-primary px-6 py-4 flex items-start justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🏢</span>
            <div>
              <h2 className="text-lg font-bold text-text-primary">{app.company}</h2>
              <p className="text-sm text-text-secondary">{app.role}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status Bar */}
        <div className="px-6 py-3 border-b border-border-primary flex items-center gap-4 flex-wrap">
          <StatusBadge status={app.status} />
          <PriorityBadge priority={app.priority} />
          <div className="flex items-center gap-1 text-xs text-text-muted">
            <TrendingUp className="w-3.5 h-3.5" />
            Match: <ScoreBadge score={app.score} />
          </div>
          <div className="ml-auto text-[10px] text-text-dim font-mono">
            ID: {app.id}
          </div>
        </div>

        {/* Details Grid */}
        <div className="px-6 py-4 grid grid-cols-2 gap-4">
          <DetailItem icon={<MapPin className="w-4 h-4" />} label="Location" value="Germany" />
          <DetailItem icon={<DollarSign className="w-4 h-4" />} label="Salary Range" value="TBD" />
          <DetailItem icon={<Calendar className="w-4 h-4" />} label="Applied Date" value={app.date} />
          <DetailItem icon={<Clock className="w-4 h-4" />} label="Status" value={app.status} />
        </div>

        {/* Links */}
        <div className="mx-6 p-4 rounded-xl bg-accent-bg border border-accent-border">
          <div className="flex items-center gap-2 mb-1">
            <ArrowRight className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-accent uppercase tracking-wider">Artifacts</span>
          </div>
          <div className="text-sm text-text-primary flex flex-col gap-1 mt-2">
            {app.pdf && <a href={app.pdf} target="_blank" className="text-accent hover:underline">View Generated PDF</a>}
            {app.report && <a href={app.report} target="_blank" className="text-accent hover:underline">View Evaluation Report</a>}
            {!app.pdf && !app.report && <span className="text-text-muted">No artifacts generated.</span>}
          </div>
        </div>

        {/* Notes */}
        <div className="px-6 py-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-text-dim" />
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Notes</span>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">{app.notes || 'No notes added.'}</p>
        </div>

        {/* Tags */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <Tag className="w-4 h-4 text-text-dim" />
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Tags</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {app.tags.length > 0 ? app.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-lg bg-bg-secondary border border-border-primary text-[11px] text-text-secondary font-medium"
              >
                {tag}
              </span>
            )) : <span className="text-xs text-text-muted">No tags</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-border-primary flex items-center gap-3">
          <a
            href={app.jobUrl || app.report || '#'}
            target={app.jobUrl || app.report ? '_blank' : undefined}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium transition-colors',
              app.jobUrl || app.report
                ? 'bg-accent hover:bg-accent/90 text-white'
                : 'bg-bg-secondary text-text-dim cursor-not-allowed'
            )}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {app.jobUrl ? 'View Job Posting' : 'View Report'}
          </a>
          <button className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-bg-secondary border border-border-primary text-text-secondary text-xs font-medium hover:text-text-primary hover:border-border-secondary transition-colors">
            <MessageSquare className="w-3.5 h-3.5" />
            Add Note
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-8 h-8 rounded-lg bg-bg-secondary flex items-center justify-center text-text-dim shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-text-dim uppercase tracking-wider">{label}</p>
        <p className="text-xs text-text-primary font-medium mt-0.5">{value}</p>
      </div>
    </div>
  );
}
