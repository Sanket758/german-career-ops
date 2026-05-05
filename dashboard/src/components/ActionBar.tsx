import { useState } from 'react';
import {
  Mail,
  Scan,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  Terminal,
} from 'lucide-react';
import { triggerGmailSync, triggerScan, initSession } from '../data/api';
import { cn } from '../utils/cn';

interface ActionBarProps {
  onDataRefresh: () => void;
  apiConnected: boolean;
}

type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

export function ActionBar({ onDataRefresh, apiConnected }: ActionBarProps) {
  const [gmailStatus, setGmailStatus] = useState<ActionStatus>('idle');
  const [scanStatus, setScanStatus] = useState<ActionStatus>('idle');
  const [sessionStatus, setSessionStatus] = useState<ActionStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const handleGmailSync = async () => {
    setGmailStatus('loading');
    setMessage(null);
    try {
      const result = await triggerGmailSync();
      setGmailStatus('success');
      setMessage(result.message);
      // Refresh data after sync
      setTimeout(() => {
        onDataRefresh();
        setGmailStatus('idle');
        setMessage(null);
      }, 3000);
    } catch (err) {
      setGmailStatus('error');
      setMessage('Gmail sync failed — check OAuth credentials');
      setTimeout(() => { setGmailStatus('idle'); setMessage(null); }, 5000);
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
    } catch (err) {
      setScanStatus('error');
      setMessage('Scan failed');
      setTimeout(() => { setScanStatus('idle'); setMessage(null); }, 5000);
    }
  };

  const handleSessionInit = async () => {
    setSessionStatus('loading');
    try {
      await initSession();
      setSessionStatus('success');
      setMessage('Session state refreshed');
      setTimeout(() => {
        onDataRefresh();
        setSessionStatus('idle');
        setMessage(null);
      }, 2000);
    } catch {
      setSessionStatus('error');
      setMessage('Session init failed');
      setTimeout(() => { setSessionStatus('idle'); setMessage(null); }, 5000);
    }
  };

  return (
    <div className="bg-bg-card/40 backdrop-blur-xl border border-border-primary/50 rounded-xl overflow-hidden shadow-xl shadow-black/10 transition-all duration-300">
      <div className="px-5 py-4 border-b border-border-primary/30 flex items-center justify-between bg-bg-card/20">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Quick Actions</h3>
          <p className="text-[10px] text-text-dim font-mono">
            SYNC • SCAN • REFRESH
          </p>
        </div>
        <div className={cn(
          'w-2 h-2 rounded-full',
          apiConnected ? 'bg-gain animate-pulse-dot' : 'bg-loss'
        )} />
      </div>

      <div className="p-3 space-y-2">
        {/* Gmail Sync Button */}
        <ActionButton
          icon={<Mail className="w-3.5 h-3.5" />}
          label="Gmail Sync"
          description="Check inbox for status updates"
          status={gmailStatus}
          onClick={handleGmailSync}
          accent="info"
        />

        {/* Portal Scan Button */}
        <ActionButton
          icon={<Scan className="w-3.5 h-3.5" />}
          label="Portal Scan"
          description="Search German job portals"
          status={scanStatus}
          onClick={handleScan}
          accent="accent"
        />

        {/* Refresh Session */}
        <ActionButton
          icon={<Terminal className="w-3.5 h-3.5" />}
          label="Refresh Session"
          description="Rebuild session state from files"
          status={sessionStatus}
          onClick={handleSessionInit}
          accent="cyan"
        />

        {/* Refresh Data */}
        <div className="pt-2">
          <button
            onClick={onDataRefresh}
            className="group flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-text-secondary hover:text-text-primary hover:bg-bg-secondary/50 transition-all duration-300"
          >
            <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
            <span>Reload Dashboard Data</span>
          </button>
        </div>
      </div>

      {/* Status message */}
      {message && (
        <div className={cn(
          'mx-3 mb-3 px-3 py-2 rounded-lg text-[11px] animate-slide-in',
          gmailStatus === 'error' || scanStatus === 'error' || sessionStatus === 'error'
            ? 'bg-loss-bg text-loss border border-loss-border'
            : 'bg-gain-bg text-gain border border-gain-border'
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
      button: 'hover:bg-info/5 hover:border-info/20 hover:shadow-info/5',
      iconBg: 'bg-info/10 ring-info/20',
      iconText: 'text-info'
    },
    accent: {
      button: 'hover:bg-accent/5 hover:border-accent/20 hover:shadow-accent/5',
      iconBg: 'bg-accent/10 ring-accent/20',
      iconText: 'text-accent'
    },
    cyan: {
      button: 'hover:bg-cyan/5 hover:border-cyan/20 hover:shadow-cyan/5',
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
        'group flex items-center gap-3 w-full px-4 py-3 rounded-xl transition-all duration-300 text-left relative overflow-hidden',
        isLoading
          ? 'bg-bg-secondary/50 cursor-wait'
          : `border border-transparent hover:shadow-lg ${styles.button}`
      )}
    >
      <div className={cn(
        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-110 shadow-sm shadow-black/20',
        `ring-1 ${styles.iconBg}`
      )}>
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 text-text-muted animate-spin" />
        ) : status === 'success' ? (
          <CheckCircle className="w-3.5 h-3.5 text-gain" />
        ) : status === 'error' ? (
          <AlertCircle className="w-3.5 h-3.5 text-loss" />
        ) : (
          <span className={styles.iconText}>{icon}</span>
        )}
      </div>
      <div className="min-w-0">
        <span className="text-xs font-medium text-text-primary">{label}</span>
        <p className="text-[10px] text-text-dim truncate">{description}</p>
      </div>
    </button>
  );
}
