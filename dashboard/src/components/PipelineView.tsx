import type { Application, ApplicationStatus } from '../types';
import { PriorityBadge, ScoreBadge } from './StatusBadge';
import { cn } from '../utils/cn';
import {
  Calendar,
  MapPin,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';

interface PipelineViewProps {
  applications: Application[];
  onSelectApp: (app: Application) => void;
}

const pipelineStages: { status: ApplicationStatus; label: string; color: string }[] = [
  { status: 'Evaluated', label: 'Evaluated', color: 'border-t-gray-500' },
  { status: 'Applied', label: 'Applied', color: 'border-t-blue-500' },
  { status: 'Responded', label: 'Responded', color: 'border-t-cyan-500' },
  { status: 'Interview', label: 'Interview', color: 'border-t-indigo-500' },
  { status: 'Offer', label: 'Offer', color: 'border-t-green-500' },
];

export function PipelineView({ applications, onSelectApp }: PipelineViewProps) {
  return (
    <div>
      {/* Pipeline Flow Header */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        {pipelineStages.map((stage, idx) => {
          const count = applications.filter((a) => a.status === stage.status).length;
          return (
            <div key={stage.status} className="flex items-center gap-2">
              <div className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl bg-bg-card/60 backdrop-blur-md border border-border-primary/50 shadow-sm shadow-black/10',
                'min-w-[120px]'
              )}>
                <span className="text-xs font-semibold text-text-secondary">{stage.label}</span>
                <span className="text-xs font-bold font-mono text-text-primary bg-bg-secondary/80 px-1.5 py-0.5 rounded shadow-inner">
                  {count}
                </span>
              </div>
              {idx < pipelineStages.length - 1 && (
                <ArrowRight className="w-4 h-4 text-text-dim/50 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {pipelineStages.map((stage) => {
          const stageApps = applications.filter((a) => a.status === stage.status);
          return (
            <div key={stage.status} className="space-y-3">
              <div className={cn(
                'bg-bg-card/60 backdrop-blur-md rounded-xl border border-border-primary/50 border-t-2 p-3 shadow-md shadow-black/10',
                stage.color
              )}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-text-primary uppercase tracking-wider">{stage.label}</span>
                  <span className="text-[10px] font-bold font-mono text-text-dim bg-bg-secondary px-2 py-0.5 rounded shadow-inner">
                    {stageApps.length}
                  </span>
                </div>
              </div>

              {stageApps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => onSelectApp(app)}
                  className="w-full text-left bg-bg-card/40 backdrop-blur-sm border border-border-primary/50 rounded-xl p-3.5 shadow-sm shadow-black/10 hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 hover:-translate-y-0.5 hover:bg-bg-card/80 transition-all duration-300 group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-lg">🏢</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-text-primary truncate">{app.company}</p>
                      <p className="text-[10px] text-text-muted truncate">{app.role}</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1 text-[10px] text-text-dim">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">Germany</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <PriorityBadge priority={app.priority} />
                      <ScoreBadge score={app.score} />
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-text-dim">
                      <Calendar className="w-3 h-3" />
                      <span>{app.date}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-border-primary/30 flex items-center justify-between">
                    <span className="text-[10px] text-text-dim font-mono tracking-wider group-hover:text-text-muted transition-colors">TBD</span>
                    <ChevronRight className="w-3.5 h-3.5 text-text-dim opacity-0 -translate-x-2 group-hover:translate-x-0 group-hover:opacity-100 group-hover:text-accent transition-all duration-300" />
                  </div>
                </button>
              ))}

              {stageApps.length === 0 && (
                <div className="bg-bg-card/50 border border-dashed border-border-primary rounded-xl p-4 text-center">
                  <p className="text-[10px] text-text-dim">No applications</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
