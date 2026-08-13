import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

/**
 * Shared panel primitives — "Mission Control" visual language.
 *
 * All colors/spacing come from the @theme tokens in src/index.css.
 * Components are intentionally small and focused so every panel in
 * panels/ renders with the same rhythm: hairline borders, mono eyebrows,
 * cyan/indigo action accents, JetBrains Mono numerals.
 */

/* ── Tones ─────────────────────────────────────────────────────────── */

export const TONES = {
  cyan: {
    chip: 'border-cyan-border bg-cyan-bg text-cyan',
    dot: 'bg-cyan',
    text: 'text-cyan',
  },
  accent: {
    chip: 'border-accent-border bg-accent-bg text-accent',
    dot: 'bg-accent',
    text: 'text-accent',
  },
  violet: {
    chip: 'border-violet-border bg-violet-bg text-violet',
    dot: 'bg-violet',
    text: 'text-violet',
  },
  gain: {
    chip: 'border-gain-border bg-gain-bg text-gain',
    dot: 'bg-gain',
    text: 'text-gain',
  },
  loss: {
    chip: 'border-loss-border bg-loss-bg text-loss',
    dot: 'bg-loss',
    text: 'text-loss',
  },
  warn: {
    chip: 'border-warn-border bg-warn-bg text-warn',
    dot: 'bg-warn',
    text: 'text-warn',
  },
  info: {
    chip: 'border-info-border bg-info-bg text-info',
    dot: 'bg-info',
    text: 'text-info',
  },
} as const;

export type Tone = keyof typeof TONES;

/* ── Shells ────────────────────────────────────────────────────────── */

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`relative flex flex-col overflow-hidden rounded-panel border border-border-primary/70 bg-bg-card/60 shadow-panel shadow-black/20 backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-4 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent ${
        className ?? ''
      }`}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  icon,
  title,
  eyebrow,
  tone = 'cyan',
  right,
}: {
  icon: ReactNode;
  title: string;
  eyebrow: string;
  tone?: Tone;
  right?: ReactNode;
}) {
  const chip = TONES[tone].chip;
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border-primary/70 px-5 py-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
            chip
          )}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold leading-tight tracking-tight text-text-primary">
            {title}
          </h3>
          <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-[0.2em] text-text-dim">
            {eyebrow}
          </p>
        </div>
      </div>
      {right}
    </header>
  );
}

/** Hairline-separated body region. */
export function PanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn('flex-1 p-5', className)}>{children}</div>;
}

/** Mono section label used to group settings / stats. */
export function SectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'font-mono text-[9px] font-semibold uppercase tracking-[0.22em] text-text-dim',
        className
      )}
    >
      {children}
    </p>
  );
}

/* ── Form primitives ───────────────────────────────────────────────── */

function inputClass(disabled: boolean, tone: 'cyan' | 'accent'): string {
  return cn(
    'w-full rounded-md border bg-bg-input/60 px-3 py-2 text-xs text-text-primary',
    'placeholder:text-text-dim shadow-inner shadow-black/20 transition-colors',
    'focus:outline-none focus:ring-1',
    disabled
      ? 'cursor-wait border-border-primary/40 opacity-50'
      : tone === 'cyan'
        ? 'border-border-secondary/70 hover:border-border-accent focus:border-cyan/60 focus:ring-cyan/30'
        : 'border-border-secondary/70 hover:border-border-accent focus:border-accent/60 focus:ring-accent/30'
  );
}

export function TextInput({
  className,
  disabled,
  tone = 'cyan',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { tone?: 'cyan' | 'accent' }) {
  return (
    <input
      {...rest}
      disabled={disabled}
      className={cn(inputClass(Boolean(disabled), tone), className)}
    />
  );
}

export function TextArea({
  className,
  disabled,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...rest}
      disabled={disabled}
      className={cn(
        'w-full resize-none rounded-md border bg-bg-input/60 px-3 py-2 text-xs text-text-primary',
        'placeholder:text-text-dim shadow-inner shadow-black/20 transition-colors',
        'focus:outline-none focus:ring-1',
        disabled
          ? 'cursor-wait border-border-primary/40 opacity-50'
          : 'border-border-secondary/70 hover:border-border-accent focus:border-cyan/60 focus:ring-cyan/30',
        className
      )}
    />
  );
}

export function Select({
  className,
  disabled,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...rest}
        disabled={disabled}
        className={cn(
          'w-full appearance-none rounded-md border bg-bg-input/60 py-2 pl-3 pr-8 text-xs text-text-primary',
          'shadow-inner shadow-black/20 transition-colors',
          'focus:outline-none focus:ring-1',
          disabled
            ? 'cursor-wait border-border-primary/40 opacity-50'
            : 'border-border-secondary/70 hover:border-border-accent focus:border-cyan/60 focus:ring-cyan/30',
          className
        )}
      >
        {children}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[9px] text-text-dim"
      >
        ▼
      </span>
    </div>
  );
}

export function Field({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon?: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <span className="mb-1.5 flex items-center gap-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-text-dim">
        {icon}
        {label}
      </span>
      {children}
      {hint && <p className="mt-1 text-[10px] text-text-dim">{hint}</p>}
    </div>
  );
}

/* ── Controls ──────────────────────────────────────────────────────── */

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
  description,
  icon,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'group flex w-full items-center gap-3 rounded-md border border-transparent px-2.5 py-2 text-left',
        'transition-colors hover:border-border-secondary/70 hover:bg-bg-input/40',
        disabled && 'cursor-wait opacity-50'
      )}
    >
      {icon && (
        <span
          className={cn(
            'shrink-0 transition-colors',
            checked ? 'text-cyan' : 'text-text-dim'
          )}
        >
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-text-secondary transition-colors group-hover:text-text-primary">
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-[10px] leading-snug text-text-dim">
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden
        className={cn(
          'relative h-[18px] w-8 shrink-0 rounded-full border transition-colors',
          checked
            ? 'border-cyan/40 bg-cyan/25'
            : 'border-border-accent/60 bg-bg-secondary'
        )}
      >
        <span
          className={cn(
            'absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full transition-all',
            checked
              ? 'left-[17px] bg-cyan shadow-[0_0_8px_rgba(6,182,212,0.55)]'
              : 'left-[2px] bg-text-dim'
          )}
        />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex w-full gap-px rounded-md border border-border-secondary/60 bg-bg-secondary/80 p-0.5">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={cn(
              'flex-1 rounded-[5px] px-2 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] transition-all',
              disabled && 'cursor-wait opacity-50',
              active
                ? 'bg-bg-card text-cyan shadow-sm shadow-black/30 ring-1 ring-cyan/20'
                : 'text-text-dim hover:text-text-secondary'
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ── Feedback ──────────────────────────────────────────────────────── */

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
      <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan" />
      {label}
    </span>
  );
}

export function ErrorBar({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-loss-border bg-loss-bg px-3 py-2 text-[11px] leading-snug text-loss"
    >
      <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function SuccessBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-gain-border bg-gain-bg px-3 py-2 text-[11px] leading-snug text-gain">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Primary action button — cyan (Linear-style solid) or accent. */
export function ActionButton({
  children,
  disabled,
  loading,
  onClick,
  tone = 'cyan',
  className,
  type = 'button',
}: {
  children: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  tone?: 'cyan' | 'accent' | 'violet';
  className?: string;
  type?: 'button' | 'submit';
}) {
  const toneClasses =
    tone === 'cyan'
      ? 'border-cyan/40 bg-cyan text-bg-primary shadow-[0_4px_16px_-4px_rgba(6,182,212,0.45)] hover:border-cyan hover:bg-cyan/90 hover:shadow-[0_6px_20px_-4px_rgba(6,182,212,0.55)]'
      : tone === 'accent'
        ? 'border-accent/40 bg-accent text-bg-primary shadow-[0_4px_16px_-4px_rgba(99,102,241,0.45)] hover:border-accent hover:bg-accent/90 hover:shadow-[0_6px_20px_-4px_rgba(99,102,241,0.55)]'
        : 'border-violet/40 bg-violet text-bg-primary shadow-[0_4px_16px_-4px_rgba(139,92,246,0.45)] hover:border-violet hover:bg-violet/90 hover:shadow-[0_6px_20px_-4px_rgba(139,92,246,0.55)]';

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'flex w-full items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] transition-all',
        disabled || loading
          ? 'cursor-wait border-border-primary/40 bg-bg-secondary/60 text-text-dim'
          : toneClasses,
        className
      )}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {children}
    </button>
  );
}

/** Ghost/secondary button used for chip actions (refresh, preview, get). */
export function GhostButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-transparent px-2 py-1',
        'font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted',
        'transition-colors hover:border-border-secondary/70 hover:bg-bg-input/40 hover:text-text-primary',
        disabled && 'cursor-wait opacity-50',
        className
      )}
    >
      {children}
    </button>
  );
}
