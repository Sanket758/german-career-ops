import { useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Download,
  FilePenLine,
  Link as LinkIcon,
  Loader2,
  MessageSquareText,
  Search,
} from 'lucide-react';
import { generateCoverLetter, researchCompany } from '../../data/api';
import { cn } from '../../utils/cn';
import {
  ActionButton,
  ErrorBar,
  Field,
  Panel,
  PanelHeader,
  Segmented,
  TextArea,
  TextInput,
} from './ui';

type LetterLang = 'de' | 'en';

/**
 * Cover letter generator — German-first (Motivationsschreiben) with an
 * optional company-research pass that feeds scraped facts into the prompt.
 */
export function CoverLetterPanel() {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [motivation, setMotivation] = useState('');
  const [lang, setLang] = useState<LetterLang>('de');

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedMd, setGeneratedMd] = useState<string>('');
  const [generatedPdf, setGeneratedPdf] = useState<string | null>(null);
  const [generatedFilename, setGeneratedFilename] = useState<string | null>(null);

  // Research state
  const [researching, setResearching] = useState(false);
  const [researchFacts, setResearchFacts] = useState<string[] | null>(null);

  const handleResearch = async () => {
    if (!jobUrl.trim() || researching) return;

    setResearching(true);
    setResearchFacts(null);

    try {
      const result = await researchCompany(jobUrl.trim());

      if (!result.success || result.error) {
        setResearchFacts([result.error ?? 'Research failed — using URL as reference only']);
        return;
      }

      const lines = result.text
        .split('\n')
        .map((l) => l.replace(/^[-*•]\s*/, '').trim())
        .filter((l) => l.length > 0)
        .slice(0, 5);

      setResearchFacts(lines);
    } catch (err) {
      setResearchFacts([err instanceof Error ? err.message : 'Research failed']);
    } finally {
      setResearching(false);
    }
  };

  const handleGenerate = async () => {
    if (!company.trim() || status === 'loading') return;

    setStatus('loading');
    setErrorMsg(null);
    setGeneratedMd('');
    setGeneratedPdf(null);

    try {
      const response = await generateCoverLetter({
        company: company.trim(),
        role: role.trim() || undefined,
        jobUrl: jobUrl.trim() || undefined,
        companySnippet: researchFacts?.join('\n'),
        motivation: motivation.trim() || undefined,
        lang,
      });

      if (!response.success || response.error) {
        setErrorMsg(response.error ?? 'Generation failed');
        setStatus('error');
        return;
      }

      setGeneratedMd(response.md);
      setGeneratedPdf(response.pdf);
      setGeneratedFilename(response.filename ?? null);
      setStatus('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate cover letter');
      setStatus('error');
    }
  };

  const isGenerating = status === 'loading';
  const hasSuccess = status === 'success' && generatedMd.length > 0;

  const pdfHref =
    generatedPdf && (generatedPdf.startsWith('http') ? generatedPdf : `http://localhost:3001${generatedPdf}`);

  return (
    <Panel className="h-full">
      <PanelHeader
        icon={<FilePenLine className="h-3.5 w-3.5" />}
        title="Cover Letter"
        eyebrow="Motivationsschreiben"
        tone="cyan"
        right={
          isGenerating ? (
            <Loader2 className="h-4 w-4 animate-spin text-cyan" />
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
          <Field label="Company" icon={<Building2 className="h-3 w-3" />}>
            <TextInput
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g. Bosch, Zalando"
              disabled={isGenerating}
            />
          </Field>

          {/* Role */}
          <Field label="Role / Title">
            <TextInput
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="e.g. Junior Backend Engineer"
              disabled={isGenerating}
            />
          </Field>

          {/* Job URL + research */}
          <Field label="Job Posting URL" icon={<LinkIcon className="h-3 w-3" />}>
            <div className="flex gap-2">
              <TextInput
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
                placeholder="https://jobs.example.com/..."
                disabled={isGenerating || researching}
                className="flex-1"
              />
              <button
                onClick={handleResearch}
                disabled={researching || !jobUrl.trim() || isGenerating}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2',
                  'font-mono text-[9px] font-semibold uppercase tracking-[0.14em] transition-all',
                  researching || !jobUrl.trim() || isGenerating
                    ? 'cursor-wait border-border-primary/40 text-text-dim opacity-60'
                    : 'border-cyan-border bg-cyan-bg text-cyan hover:border-cyan/50 hover:bg-cyan/15'
                )}
              >
                {researching ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Search className="h-3 w-3" />
                )}
                Research
              </button>
            </div>
          </Field>

          {/* Company intelligence */}
          {researchFacts && (
            <div className="rounded-md border-l-2 border-cyan/50 bg-cyan-bg/50 px-3 py-2.5 animate-slide-in">
              <p className="mb-1.5 font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan">
                Company intelligence
              </p>
              <ul className="space-y-1">
                {researchFacts.map((fact, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] leading-relaxed text-text-secondary">
                    <span className="mt-px shrink-0 font-mono text-cyan/70">→</span>
                    <span className="min-w-0">{fact}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Language */}
          <Field label="Letter language">
            <Segmented
              value={lang}
              onChange={setLang}
              disabled={isGenerating}
              options={[
                { value: 'de', label: 'DE' },
                { value: 'en', label: 'EN' },
              ]}
            />
          </Field>

          {/* Motivation */}
          <Field
            label="Personal Motivation"
            icon={<MessageSquareText className="h-3 w-3" />}
            hint="Optional — adds a personal touch to the letter"
          >
            <TextArea
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              placeholder="Brief note on why this role excites you…"
              rows={3}
              disabled={isGenerating}
            />
          </Field>

          <ActionButton
            onClick={handleGenerate}
            disabled={!company.trim()}
            loading={isGenerating}
          >
            {isGenerating ? 'Generating…' : 'Generate Letter'}
          </ActionButton>
        </div>

        {/* Feedback */}
        {status === 'error' && errorMsg && (
          <div className="mt-4 animate-slide-in">
            <ErrorBar message={errorMsg} />
          </div>
        )}
      </div>

      {/* Result — markdown preview + pdf */}
      {hasSuccess && (
        <div className="border-t border-border-primary/70 p-5 animate-slide-in">
          <div className="overflow-hidden rounded-md border border-border-primary/70">
            <div className="flex items-center justify-between gap-2 border-b border-border-primary/70 bg-bg-secondary/60 px-3 py-2">
              <span className="truncate font-mono text-[9px] uppercase tracking-[0.2em] text-text-dim">
                {generatedFilename ?? 'Cover letter'} · Markdown
              </span>
              {pdfHref && (
                <a
                  href={pdfHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-cyan-border bg-cyan-bg px-2 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-cyan transition-colors hover:border-cyan/50 hover:bg-cyan/15"
                >
                  <Download className="h-3 w-3" />
                  PDF
                </a>
              )}
            </div>
            <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words bg-bg-primary/60 px-4 py-3 font-mono text-[11px] leading-relaxed text-text-secondary">
              {generatedMd}
            </pre>
          </div>
        </div>
      )}
    </Panel>
  );
}
