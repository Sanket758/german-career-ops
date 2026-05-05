import { useState } from 'react';
import {
  FilePenLine,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  Link as LinkIcon,
  Building2,
  Search,
} from 'lucide-react';
import { generateCoverLetter, researchCompany } from '../../data/api';
import { cn } from '../../utils/cn';

export function CoverLetterPanel() {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [motivation, setMotivation] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedPdf, setGeneratedPdf] = useState<string | null>(null);
  const [generatedFilename, setGeneratedFilename] = useState<string | null>(null);

  // Research state
  const [researching, setResearching] = useState(false);
  const [researchFacts, setResearchFacts] = useState<string[] | null>(null);

  const handleResearch = async () => {
    if (!jobUrl.trim()) return;

    setResearching(true);
    setResearchFacts(null);

    try {
      const result = await researchCompany(jobUrl.trim());

      if (!result.success || result.error) {
        setResearchFacts([result.error ?? 'Research failed — using URL as reference only']);
        return;
      }

      // Parse the research text into facts (split by bullet-like patterns)
      const lines = result.text
        .split('\n')
        .map(l => l.replace(/^[-*•]\s*/, '').trim())
        .filter(l => l.length > 0)
        .slice(0, 5);

      setResearchFacts(lines);
    } catch (err) {
      setResearchFacts([err instanceof Error ? err.message : 'Research failed']);
    } finally {
      setResearching(false);
    }
  };

  const handleGenerate = async () => {
    if (!company.trim()) return;

    setStatus('loading');
    setErrorMsg(null);
    setGeneratedPdf(null);

    try {
      const response = await generateCoverLetter({
        company: company.trim(),
        role: role.trim() || undefined,
        jobUrl: jobUrl.trim() || undefined,
        companySnippet: researchFacts?.join('\n'),
        motivation: motivation.trim() || undefined,
      });

      if (!response.success || response.error) {
        setErrorMsg(response.error ?? 'Generation failed');
        setStatus('error');
        return;
      }

      setGeneratedPdf(response.pdf);
      setGeneratedFilename(response.filename ?? null);
      setStatus('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to generate cover letter');
      setStatus('error');
    }
  };

  const isGenerating = status === 'loading';
  const hasSuccess = status === 'success';
  const hasError = status === 'error';

  return (
    <div className="bg-bg-card/40 backdrop-blur-xl border border-border-primary/50 rounded-xl overflow-hidden shadow-xl shadow-black/10 flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border-primary/30 flex items-center justify-between bg-bg-card/20 shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <FilePenLine className="w-4 h-4 text-cyan" />
            Cover Letter
          </h3>
          <p className="text-[10px] text-text-dim font-mono tracking-wider mt-0.5">
            MOTIVATIONSSCHREIBEN
          </p>
        </div>
        {hasSuccess && (
          <CheckCircle className="w-4 h-4 text-gain animate-slide-in" />
        )}
        {hasError && (
          <AlertCircle className="w-4 h-4 text-loss" />
        )}
      </div>

      {/* Form */}
      <div className="p-5 space-y-4 flex-1 overflow-y-auto">
        {/* Company */}
        <div>
          <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Building2 className="w-3 h-3" />
            Company Name
          </label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Bosch, Zalando"
            disabled={isGenerating}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg bg-bg-input/50 border text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:ring-1 transition-all shadow-inner shadow-black/20',
              isGenerating
                ? 'border-border-primary/30 cursor-wait opacity-60'
                : 'border-border-primary/50 focus:border-cyan/50 focus:ring-cyan/50'
            )}
          />
        </div>

        {/* Role */}
        <div>
          <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-widest mb-1.5">
            Role / Title
          </label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Senior Backend Engineer"
            disabled={isGenerating}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg bg-bg-input/50 border text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:ring-1 transition-all shadow-inner shadow-black/20',
              isGenerating
                ? 'border-border-primary/30 cursor-wait opacity-60'
                : 'border-border-primary/50 focus:border-cyan/50 focus:ring-cyan/50'
            )}
          />
        </div>

        {/* Job URL + Research */}
        <div>
          <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <LinkIcon className="w-3 h-3" />
            Job Posting URL
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
              placeholder="https://..."
              disabled={isGenerating}
              className={cn(
                'flex-1 px-3 py-2.5 rounded-lg bg-bg-input/50 border text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:ring-1 transition-all shadow-inner shadow-black/20',
                isGenerating
                  ? 'border-border-primary/30 cursor-wait opacity-60'
                  : 'border-border-primary/50 focus:border-cyan/50 focus:ring-cyan/50'
              )}
            />
            <button
              onClick={handleResearch}
              disabled={researching || !jobUrl.trim()}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shrink-0',
                researching || !jobUrl.trim()
                  ? 'bg-bg-secondary/50 text-text-dim cursor-wait border border-border-primary/30'
                  : 'bg-cyan/10 text-cyan hover:bg-cyan/20 border border-cyan/20'
              )}
            >
              {researching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              Research
            </button>
          </div>
        </div>

        {/* Research Results */}
        {researchFacts && (
          <div className="animate-slide-in px-3 py-3 rounded-lg bg-bg-secondary/40 border border-border-primary/30">
            <p className="text-[10px] font-semibold text-text-dim uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Building2 className="w-3 h-3" />
              Company Intelligence
            </p>
            <ul className="space-y-1.5">
              {researchFacts.map((fact, i) => (
                <li key={i} className="flex items-start gap-2 text-[11px] text-text-secondary">
                  <span className="text-cyan mt-0.5 shrink-0">→</span>
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Motivation */}
        <div>
          <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-widest mb-1.5">
            Personal Motivation
          </label>
          <textarea
            value={motivation}
            onChange={(e) => setMotivation(e.target.value)}
            placeholder="Brief snippet about why this role excites you..."
            rows={3}
            disabled={isGenerating}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg bg-bg-input/50 border text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:ring-1 transition-all shadow-inner shadow-black/20 resize-none',
              isGenerating
                ? 'border-border-primary/30 cursor-wait opacity-60'
                : 'border-border-primary/50 focus:border-cyan/50 focus:ring-cyan/50'
            )}
          />
          <p className="text-[10px] text-text-dim mt-1">
            Optional — adds a personal touch to the letter
          </p>
        </div>
      </div>

      {/* Action */}
      <div className="px-5 pb-5 shrink-0">
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !company.trim()}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all',
            isGenerating || !company.trim()
              ? 'bg-bg-secondary/50 text-text-dim cursor-wait border border-border-primary/30'
              : 'bg-gradient-to-r from-cyan to-cyan/90 hover:from-cyan/90 hover:to-cyan text-white shadow-lg shadow-cyan/25 hover:shadow-cyan/40 hover:-translate-y-0.5 active:translate-y-0'
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FilePenLine className="w-4 h-4" />
              Generate Cover Letter
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {(hasSuccess || hasError) && (
        <div className="px-5 pb-5 animate-slide-in shrink-0">
          {hasError && errorMsg && (
            <div className="px-3 py-2 rounded-lg text-[11px] bg-loss-bg text-loss border border-loss-border">
              {errorMsg}
            </div>
          )}

          {hasSuccess && generatedPdf && (
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gain-bg border border-gain-border">
              <CheckCircle className="w-3.5 h-3.5 text-gain shrink-0" />
              <span className="text-xs text-text-primary flex-1 truncate">
                {generatedFilename ?? 'Cover letter'}
              </span>
              <a
                href={generatedPdf.startsWith('http') ? generatedPdf : `http://localhost:3001${generatedPdf}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-[10px] font-bold uppercase tracking-wider"
              >
                <Download className="w-3 h-3" />
                Download
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
