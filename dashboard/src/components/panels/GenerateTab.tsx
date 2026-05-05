import { GenerateCVPanel } from './GenerateCVPanel';
import { CoverLetterPanel } from './CoverLetterPanel';
import { OutputFileList } from './OutputFileList';

/**
 * Generate tab — two-column layout on desktop, single column on mobile.
 * Wraps GenerateCVPanel, CoverLetterPanel, and OutputFileList.
 */
export function GenerateTab() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Two-column generator layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GenerateCVPanel />
        <CoverLetterPanel />
      </div>

      {/* File list spanning full width */}
      <OutputFileList />
    </div>
  );
}
