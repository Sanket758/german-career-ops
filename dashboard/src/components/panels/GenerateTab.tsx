import { GenerateCVPanel } from './GenerateCVPanel';
import { CoverLetterPanel } from './CoverLetterPanel';
import { OutputFileList } from './OutputFileList';
import { ScanPanel } from './ScanPanel';

/**
 * Generate tab — two-column generator layout on desktop, single column on
 * mobile. Generators on top, generated artifacts below, portal scanner last.
 */
export function GenerateTab() {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Two-column generator layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <GenerateCVPanel />
        <CoverLetterPanel />
      </div>

      {/* File list spanning full width */}
      <OutputFileList />

      {/* Portal scan + pipeline */}
      <ScanPanel />
    </div>
  );
}
