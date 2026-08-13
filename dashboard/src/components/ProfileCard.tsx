import {
  MapPin,
  Briefcase,
  Globe,
  Shield,
  Clock,
  Zap,
} from 'lucide-react';
import type { ProfileSummary } from '../types';
import { cn } from '../utils/cn';

interface ProfileCardProps {
  profile: ProfileSummary | null;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  if (!profile) {
    return (
      <div className="animate-pulse rounded-panel border border-border-primary/60 bg-bg-card/60 p-4">
        <div className="h-4 w-3/4 rounded bg-bg-secondary" />
        <div className="mt-3 h-3 w-1/2 rounded bg-bg-secondary" />
        <div className="mt-2 h-3 w-2/3 rounded bg-bg-secondary" />
      </div>
    );
  }

  const visaCode = profile.visa.match(/(§\s*\d+\s*[a-z]?)/i)?.[1]?.replace(/\s+/g, ' ') ?? 'VISA';

  const germanLevelColor =
    profile.german_level.startsWith('C') ? 'text-gain' :
    profile.german_level.startsWith('B') ? 'text-warn' :
    'text-loss';

  return (
    <div className="relative overflow-hidden rounded-panel border border-border-primary/60 bg-bg-card/60 shadow-card shadow-inset-top backdrop-blur-xl">
      {/* Top gradient hairline */}
      <div className="h-[3px] w-full bg-gradient-to-r from-accent via-cyan to-gain" />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-44 w-44 rounded-full bg-accent/10 blur-3xl" />

      <div className="relative p-4">
        {/* Identity row */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-cyan text-base font-bold text-white shadow-lg shadow-accent/20 ring-1 ring-white/10">
            {profile.name ? profile.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'SG'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[9px] uppercase tracking-widest text-text-dim">Candidate</p>
            <h3 className="truncate text-[15px] font-bold tracking-tight text-text-primary">
              {profile.name || 'Career Seeker'}
            </h3>
          </div>
          <span className="flex shrink-0 items-center gap-1 rounded-md border border-cyan-border bg-cyan-bg px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyan">
            <Shield className="h-3 w-3" />
            {visaCode}
          </span>
        </div>

        {/* CODE RED campaign banner */}
        <div className="mt-3 animate-code-red rounded-lg border border-code-red-border bg-code-red-bg px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-code-red-bright" />
            <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-code-red-bright">
              Code Red · Full-time Campaign
            </span>
          </div>
          <p className="mt-1 font-mono text-[10px] text-code-red/90">
            FULL-TIME · GERMANY-WIDE · €50–65K TARGET
          </p>
        </div>

        {/* Details */}
        <div className="mt-3 space-y-2.5">
          <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={profile.location} />
          <InfoRow
            icon={<Shield className="h-3.5 w-3.5" />}
            label="Visa"
            value={profile.visa}
            valueClass="text-warn"
          />
          <InfoRow
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Hours"
            value={`${profile.hours_per_week}h/week`}
          />
          <InfoRow
            icon={<Globe className="h-3.5 w-3.5" />}
            label="German"
            value={`${profile.german_level} → ${profile.german_target}`}
            valueClass={germanLevelColor}
          />
        </div>

        {/* Target roles */}
        {profile.target_roles.length > 0 && (
          <div className="mt-4 border-t border-border-primary/50 pt-4">
            <div className="mb-2.5 flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-text-dim" />
              <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-text-dim">
                Target Roles
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {profile.target_roles.slice(0, 4).map((role, i) => (
                <span
                  key={i}
                  className="rounded-md border border-accent/20 bg-accent/5 px-2 py-1 text-[10px] font-medium text-accent shadow-sm shadow-black/20"
                >
                  {role.replace(/\s*\(.*?\)\s*/g, '').trim()}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  valueClass = 'text-text-primary',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-text-dim">{icon}</span>
      <span className="w-16 shrink-0 font-mono text-[10px] uppercase tracking-wider text-text-muted">{label}</span>
      <span className={cn('truncate font-medium', valueClass)}>{value}</span>
    </div>
  );
}
