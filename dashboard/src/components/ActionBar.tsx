import { useState } from 'react';
import {
  Mail,
  Radar,
  FileText,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { triggerGmailSync, triggerScan, generateCV } from '../data/api';
import { cn } from '../utils/cn';

interface ActionBarProps {
  onDataRefresh: () => void;
  apiConnected: boolean;
  /** Company to use for the quick Generate CV action (falls back to a default). */
  preferredCompany?: string;
}

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

export function ActionBar({ onDataRefresh, apiConnected, preferredCompany = 'Sanket' }: ActionBarProps) {
  const [gmailStatus, setGmailStatus] = useState<ActionStatus>('idle');
  const [scanStatus, setScanStatus] = useState<ActionStatus>('idle');
  const [cvStatus, setCvStatus] = useState<ActionStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const settle = (setter: (s: ActionStatus) => void, status: ActionStatus) => {
    setTimeout(() => {
      setter(status);
      setMessage(null);
    }, 5000);
  };

  const handleGmailSync = async () => {
    setGmailStatus('loading');
    setMessage(null);
    try {
      const result = await triggerGmailSync();
      setGmailStatus('success');
      setMessage(result.message);
      setTimeout(() => {
        onDataRefresh();
        setGmailStatus('idle');
        setMessage(null);
      }, 3000);
    } catch {
      setGmailStatus('error');
      setMessage('Gmail sync failed — check OAuth credentials');
      settle(setGmailStatus, 'idle');
    }
  };

  const handleScan = async () => {
    setScanStatus('loading');
    setMessage(null);
    try {
      const result = await triggerScan();
      setScanStatus(['info', 'started', 'running'].includes(result.status) ? 'success' : 'error');
      setMessage(result.message);
      setTimeout(() => {
        onDataRefresh();
        setScanStatus('idle');
        setMessage(null);
      }, 5000);
    } catch {
      setScanStatus('error');
      setMessage('Scan failed');
      settle(setScanStatus, 'idle');
    }
  };

  const handleGenerateCV = async () => {
    setCvStatus('loading');
    setMessage(null);
    try {
      const result = await generateCV({ company: preferredCompany, lang: 'both' });
      const okCount = result.results.filter((r) => !r.error).length;
      const ok = result.success && okCount > 0;
      setCvStatus(ok ? 'success' : 'error');
      setMessage(ok
        ? `CV generated — ${okCount} file${okCount > 1 ? 's' : ''} in output/`
        : 'CV generation failed — check the API server');
      setTimeout(() => {
        setCvStatus('idle');
        setMessage(null);
      }, 6000);
    } catch {
      setCvStatus('error');
      setMessage('CV generation failed');
      settle(setCvStatus, 'idle');
    }
  };

  const hasError = gmailStatus === 'error' || scanStatus === 'error' || cvStatus === 'error';

  return (
    <div className="overflow-hidden rounded-panel border border-border-primary/60 bg-bg-card/60 shadow-card shadow-inset-top backdrop-blur-xl transition-all duration-300">
      <div className="flex items-center justify-between border-b border-border-primary/50 bg-bg-card/20 px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-text-primary">Mission Actions</h3>
          <p className="font-mono text-[9px] uppercase tracking-widest text-text-dim">
            Sync · Scan · Generate
          </p>
        </div>
        <div className={cn(
          'h-2 w-2 rounded-full',
          apiConnected ? 'animate-pulse-dot bg-gain shadow-glow-cyan' : 'bg-loss shadow-glow-red'
        )} />
      </div>

      <div className="space-y-2 p-3">
        {/* Gmail Sync */}
        <ActionButton
          icon={<Mail className="h-3.5 w-3.5" />}
          label="Sync Gmail"
          description="Check inbox for status updates"
          status={gmailStatus}
          onClick={handleGmailSync}
          accent="info"
        />

        {/* Portal Scan */}
        <ActionButton
          icon={<Radar className="h-3.5 w-3.5" />}
          label="Scan Portals"
          description="Search German job portals"
          status={scanStatus}
          onClick={handleScan}
          accent="accent"
        />

        {/* Generate CV */}
        <ActionButton
          icon={<FileText className="h-3.5 w-3.5" />}
          label="Generate CV"
          description="Tailored CV — German + English"
          status={cvStatus}
          onClick={handleGenerateCV}
          accent="cyan"
        />

        {/* Reload data */}
        <div className="pt-2">
          <button
            onClick={onDataRefresh}
            className="group flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-text-secondary transition-all duration-300 hover:bg-bg-secondary/50 hover:text-text-primary"
          >
            <RefreshCw className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-180" />
            <span className="font-mono text-[10px] uppercase tracking-wider">Reload Dashboard Data</span>
          </button>
        </div>
      </div>

      {/* Status message */}
      {message && (
        <div className={cn(
          'mx-3 mb-3 animate-slide-in rounded-lg border px-3 py-2 font-mono text-[11px]',
          hasError
            ? 'border-loss-border bg-loss-bg text-loss'
            : 'border-gain-border bg-gain-bg text-gain'
        )}>
          {message}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon,
  label,
  description,
  status,
  onClick,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  status: ActionStatus;
  onClick: () => void;
  accent: string;
}) {
  const isLoading = status === 'loading';

  const stylesMap = {
    info: {
      button: 'hover:border-info/20 hover:bg-info/5',
      iconBg: 'bg-info/10 ring-info/20',
      iconText: 'text-info'
    },
    accent: {
      button: 'hover:border-accent/20 hover:bg-accent/5',
      iconBg: 'bg-accent/10 ring-accent/20',
      iconText: 'text-accent'
    },
    cyan: {
      button: 'hover:border-cyan/20 hover:bg-cyan/5',
      iconBg: 'bg-cyan/10 ring-cyan/20',
      iconText: 'text-cyan'
    }
  };
  const styles = stylesMap[accent as keyof typeof stylesMap] || stylesMap.info;

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={cn(
        'group relative flex w-full items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left transition-all duration-300',
        isLoading
          ? 'cursor-wait bg-bg-secondary/50'
          : cn('border border-transparent hover:shadow-lg', styles.button)
      )}
    >
      <div className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm shadow-black/20 ring-1 transition-transform duration-300 group-hover:scale-110',
        styles.iconBg
      )}>
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-text-muted" />
        ) : status === 'success' ? (
          <CheckCircle className="h-3.5 w-3.5 text-gain" />
        ) : status === 'error' ? (
          <AlertCircle className="h-3.5 w-3.5 text-loss" />
        ) : (
          <span className={styles.iconText}>{icon}</span>
        )}
      </div>
      <div className="min-w-0">
        <span className="block text-xs font-medium text-text-primary">{label}</span>
        <p className="truncate font-mono text-[10px] text-text-dim">{description}</p>
      </div>
    </button>
  );
}
