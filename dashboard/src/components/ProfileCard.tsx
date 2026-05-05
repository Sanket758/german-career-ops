import {
  MapPin,
  Briefcase,
  GraduationCap,
  Globe,
  Shield,
  Clock,
} from 'lucide-react';
import type { ProfileSummary } from '../types';

interface ProfileCardProps {
  profile: ProfileSummary | null;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  if (!profile) {
    return (
      <div className="bg-bg-card border border-border-primary rounded-xl p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-bg-secondary rounded w-3/4" />
          <div className="h-3 bg-bg-secondary rounded w-1/2" />
          <div className="h-3 bg-bg-secondary rounded w-2/3" />
        </div>
      </div>
    );
  }

  const germanLevelColor =
    profile.german_level.startsWith('C') ? 'text-gain' :
    profile.german_level.startsWith('B') ? 'text-warn' :
    'text-loss';

  return (
    <div className="relative bg-bg-card/40 backdrop-blur-xl border border-border-primary/50 rounded-xl overflow-hidden shadow-2xl shadow-black/20 hover:border-accent/30 transition-all duration-300 group">
      {/* Decorative background glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-accent/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      
      {/* Header gradient */}
      <div className="h-1.5 bg-gradient-to-r from-accent via-cyan to-gain relative z-10" />

      <div className="p-4">
        <div className="flex items-center gap-4 mb-5 relative z-10">
          <div className="w-12 h-12 rounded-xl shadow-lg shadow-accent/20 bg-gradient-to-br from-accent to-cyan flex items-center justify-center text-lg font-bold text-white shrink-0 ring-1 ring-white/10 group-hover:scale-105 transition-transform duration-300">
            {profile.name ? profile.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'SG'}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-text-primary truncate tracking-tight">
              {profile.name || 'Career Seeker'}
            </h3>
            <p className="text-[10px] text-text-muted font-mono">CAREER-OPS GERMANY</p>
          </div>
        </div>

        <div className="space-y-2.5">
          <InfoRow icon={<MapPin className="w-3.5 h-3.5" />} label="Location" value={profile.location} />
          <InfoRow
            icon={<Shield className="w-3.5 h-3.5" />}
            label="Visa"
            value={profile.visa}
            valueClass="text-warn"
          />
          <InfoRow
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Hours"
            value={`${profile.hours_per_week}h/week`}
          />
          <InfoRow
            icon={<Globe className="w-3.5 h-3.5" />}
            label="German"
            value={`${profile.german_level} → ${profile.german_target}`}
            valueClass={germanLevelColor}
          />
        </div>

        {/* Target roles */}
        {profile.target_roles.length > 0 && (
          <div className="mt-5 pt-4 border-t border-border-primary/50 relative z-10">
            <div className="flex items-center gap-1.5 mb-3">
              <Briefcase className="w-3.5 h-3.5 text-text-dim" />
              <span className="text-[10px] font-bold text-text-dim uppercase tracking-widest">Target Roles</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {profile.target_roles.slice(0, 4).map((role, i) => (
                <span
                  key={i}
                  className="text-[10px] px-2.5 py-1 rounded-md bg-accent/5 hover:bg-accent/15 text-accent border border-accent/20 transition-colors shadow-sm shadow-black/20"
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
      <span className="text-text-muted w-16 shrink-0">{label}</span>
      <span className={`font-medium truncate ${valueClass}`}>{value}</span>
    </div>
  );
}
