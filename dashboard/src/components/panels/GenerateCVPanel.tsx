import { useState } from 'react';
import {
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  Download,
  Languages,
  FolderGit,
} from 'lucide-react';
import { generateCV } from '../../data/api';
import type { CVGenerateResult } from '../../data/api';
import { cn } from '../../utils/cn';

type LangOption = 'de' | 'en' | 'both';

export function GenerateCVPanel() {
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [lang, setLang] = useState<LangOption>('both');
  const [includeProjects, setIncludeProjects] = useState(true);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [results, setResults] = useState<CVGenerateResult[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!company.trim()) return;

    setStatus('loading');
    setErrorMsg(null);
    setResults([]);

    try {
      const response = await generateCV({
        company: company.trim(),
        role: role.trim() || undefined,
        lang,
        includeProjects,
      });

      if (!response.success) {
        const firstError = response.results.find(r => r.error)?.error ?? 'Generation failed';
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
  const hasError = status === 'error';

  return (
    <div className="bg-bg-card/40 backdrop-blur-xl border border-border-primary/50 rounded-xl overflow-hidden shadow-xl shadow-black/10 flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border-primary/30 flex items-center justify-between bg-bg-card/20 shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <FileText className="w-4 h-4 text-accent" />
            Generate CV
          </h3>
          <p className="text-[10px] text-text-dim font-mono tracking-wider mt-0.5">
            TAILORED PDF OUTPUT
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
      <div className="p-5 space-y-4 flex-1">
        {/* Company */}
        <div>
          <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-widest mb-1.5">
            Company Name
          </label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Siemens, SAP, BMW"
            disabled={isGenerating}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg bg-bg-input/50 border text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:ring-1 transition-all shadow-inner shadow-black/20',
              isGenerating
                ? 'border-border-primary/30 cursor-wait opacity-60'
                : 'border-border-primary/50 focus:border-accent/50 focus:ring-accent/50'
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
            placeholder="e.g. ML Engineer, Data Scientist"
            disabled={isGenerating}
            className={cn(
              'w-full px-3 py-2.5 rounded-lg bg-bg-input/50 border text-xs text-text-primary placeholder:text-text-dim focus:outline-none focus:ring-1 transition-all shadow-inner shadow-black/20',
              isGenerating
                ? 'border-border-primary/30 cursor-wait opacity-60'
                : 'border-border-primary/50 focus:border-accent/50 focus:ring-accent/50'
            )}
          />
        </div>

        {/* Language Toggle */}
        <div>
          <label className="block text-[10px] font-semibold text-text-dim uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
            <Languages className="w-3 h-3" />
            Language
          </label>
          <div className="flex gap-1 bg-bg-secondary/50 backdrop-blur-sm rounded-lg p-1 border border-border-primary/20 shadow-inner shadow-black/10">
            {(['de', 'en', 'both'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setLang(opt)}
                disabled={isGenerating}
                className={cn(
                  'flex-1 py-1.5 rounded-md text-xs font-bold transition-all uppercase tracking-wider',
                  isGenerating ? 'opacity-60 cursor-wait' : '',
                  lang === opt
                    ? 'bg-bg-card text-text-primary shadow-md shadow-black/20 ring-1 ring-white/5'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-card/30'
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Include Projects */}
        <label className="flex items-center gap-3 cursor-pointer group">
          <div
            onClick={() => !isGenerating && setIncludeProjects(!includeProjects)}
            className={cn(
              'w-4 h-4 rounded border-2 flex items-center justify-center transition-all shrink-0',
              isGenerating ? 'opacity-60 cursor-wait' : '',
              includeProjects
                ? 'bg-accent border-accent shadow-sm shadow-accent/30'
                : 'border-border-accent group-hover:border-accent/50'
            )}
          >
            {includeProjects && <CheckCircle className="w-3 h-3 text-white" />}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-secondary group-hover:text-text-primary transition-colors">
            <FolderGit className="w-3.5 h-3.5" />
            Include Projects
          </div>
        </label>
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
              : 'bg-gradient-to-r from-accent to-accent/90 hover:from-accent/90 hover:to-accent text-white shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:-translate-y-0.5 active:translate-y-0'
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              Generate CV
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

          {hasSuccess && results.length > 0 && (
            <div className="space-y-2">
              {results.map((r, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gain-bg border border-gain-border"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-gain shrink-0" />
                  <span className="text-xs text-text-primary flex-1 truncate">
                    {r.filename || r.lang.toUpperCase()} CV
                  </span>
                  {r.pdf && (
                    <a
                      href={r.pdf.startsWith('http') ? r.pdf : `http://localhost:3001${r.pdf}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-[10px] font-bold uppercase tracking-wider"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
