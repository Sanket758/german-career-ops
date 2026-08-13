import { useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  FolderGit,
  Languages,
  Loader2,
} from 'lucide-react';
import { generateCV } from '../../data/api';
import type { CVGenerateResult } from '../../data/api';
import { cn } from '../../utils/cn';
import {
  ActionButton,
  ErrorBar,
  Field,
  Panel,
  PanelHeader,
  Segmented,
  TextInput,
  Toggle,
} from './ui';

type LangOption = 'de' | 'en' | 'both';

const LANG_META: Record<string, { label: string; color: string }> = {
  de: { label: 'DE', color: 'text-cyan' },
  en: { label: 'EN', color: 'text-accent' },
  both: { label: 'DE + EN', color: 'text-violet' },
};

/**
 * Tailored CV generator — one payload, per-language results (de / en / both),
 * each with an inline HTML preview toggle and a PDF download.
 */
export function GenerateCVPanel() {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [lang, setLang] = useState<LangOption>('both');
  const [includeProjects, setIncludeProjects] = useState(true);
  const [maxBullets, setMaxBullets] = useState<string>('');

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [results, setResults] = useState<CVGenerateResult[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const handleGenerate = async () => {
    if (!company.trim() || status === 'loading') return;

    setStatus('loading');
    setErrorMsg(null);
    setResults([]);
    setExpanded(null);

    const bullets = maxBullets.trim() === '' ? undefined : Number(maxBullets);
    const bulletsParsed = bullets !== undefined && !Number.isNaN(bullets) ? bullets : undefined;

    try {
      const response = await generateCV({
        company: company.trim(),
        role: role.trim() || undefined,
        lang,
        includeProjects,
        maxBullets: bulletsParsed,
      });

      if (!response.success) {
        const firstError = response.results.find((r) => r.error)?.error ?? 'Generation failed';
        setErrorMsg(firstError);
        setStatus('error');
        return;
      }

      setResults(response.results);
      setStatus('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate CV');
      setStatus('error');
    }
  };

  const isGenerating = status === 'loading';
  const hasSuccess = status === 'success' && results.length > 0;

  return (
    <Panel className="h-full">
      <PanelHeader
        icon={<FileText className="h-3.5 w-3.5" />}
        title="Generate CV"
        eyebrow="Tailored · ATS-optimized"
        tone="accent"
        right={
          isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
          ) : hasSuccess ? (
            <CheckCircle2 className="h-4 w-4 text-gain animate-slide-in" />
          ) : status === 'error' ? (
            <span className="h-4 w-4 rounded-full border border-loss-border bg-loss-bg" aria-label="Error" />
          ) : undefined
        }
      />

      <div className="flex-1 p-5">
        <div className="space-y-4">
          {/* Company */}
          <Field label="Company">
            <TextInput
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Siemens, SAP, BMW"
              disabled={isGenerating}
              tone="accent"
            />
          </Field>

          {/* Role */}
          <Field label="Role / Title">
            <TextInput
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. ML Engineer, Data Scientist"
              disabled={isGenerating}
              tone="accent"
            />
          </Field>

          {/* Language */}
          <Field label="Language" icon={<Languages className="h-3 w-3" />}>
            <Segmented
              value={lang}
              onChange={setLang}
              disabled={isGenerating}
              options={[
                { value: 'de', label: 'DE' },
                { value: 'en', label: 'EN' },
                { value: 'both', label: 'Both' },
              ]}
            />
          </Field>

          {/* Max bullets */}
          <Field
            label="Max Bullets per Role"
            hint="Optional — leave empty for the default depth"
          >
            <TextInput
              type="number"
              min={1}
              max={20}
              value={maxBullets}
              onChange={(e) => setMaxBullets(e.target.value)}
              placeholder="e.g. 8"
              disabled={isGenerating}
              tone="accent"
              className="w-28"
            />
          </Field>

          {/* Include projects */}
          <div className="rounded-md border border-border-primary/50 bg-bg-secondary/30 px-2 py-1.5">
            <Toggle
              checked={includeProjects}
              onChange={setIncludeProjects}
              disabled={isGenerating}
              label="Include Projects"
              description="Fold portfolio / GitHub projects into the CV"
              icon={<FolderGit className="h-3.5 w-3.5" />}
            />
          </div>

          <ActionButton
            onClick={handleGenerate}
            disabled={!company.trim()}
            loading={isGenerating}
            tone="accent"
          >
            {isGenerating ? 'Generating…' : 'Generate CV'}
          </ActionButton>
        </div>

        {/* Feedback */}
        {status === 'error' && errorMsg && (
          <div className="mt-4 animate-slide-in">
            <ErrorBar message={errorMsg} />
          </div>
        )}
      </div>

      {/* Results — per-language cards */}
      {hasSuccess && (
        <div className="space-y-3 border-t border-border-primary/70 p-5 animate-slide-in">
          {results.map((r, i) => {
            const meta = LANG_META[r.lang] ?? { label: r.lang.toUpperCase(), color: 'text-text-secondary' };
            const open = expanded === i;
            const pdfHref =
              r.pdf && (r.pdf.startsWith('http') ? r.pdf : `http://localhost:3001${r.pdf}`);

            return (
              <div key={i} className="overflow-hidden rounded-md border border-border-primary/70">
                {/* Card header */}
                <div className="flex items-center gap-2 border-b border-border-primary/70 bg-bg-secondary/50 px-3 py-2">
                  <span className={cn('font-mono text-[10px] font-bold tracking-[0.14em]', meta.color)}>
                    {meta.label}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-text-muted">
                    {r.filename ?? `${r.lang.toUpperCase()} CV`}
                  </span>

                  {r.html && (
                    <button
                      onClick={() => setExpanded(open ? null : i)}
                      className="inline-flex items-center gap-1 rounded-md border border-border-secondary/70 px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-text-muted transition-colors hover:border-cyan/40 hover:text-cyan"
                    >
                      {open ? (
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                      {open ? 'Close' : 'HTML'}
                    </button>
                  )}

                  {pdfHref && (
                    <a
                      href={pdfHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-accent-border bg-accent-bg px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-accent transition-colors hover:border-accent/50 hover:bg-accent/15"
                    >
                      <Download className="h-3 w-3" />
                      PDF
                    </a>
                  )}
                </div>

                {/* Error / html preview */}
                {r.error ? (
                  <div className="p-3">
                    <ErrorBar message={r.error} />
                  </div>
                ) : open && r.html ? (
                  <pre className="max-h-72 overflow-auto bg-bg-primary/60 px-4 py-3 font-mono text-[10px] leading-relaxed text-text-secondary">
                    {r.html}
                  </pre>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
