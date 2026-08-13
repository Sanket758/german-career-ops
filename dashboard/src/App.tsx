import { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MetricCard } from './components/MetricCard';
import { ActivityFeed } from './components/ActivityFeed';
import { WeeklyTrendChart, StatusBarChart, ResponseDonut } from './components/Charts';
import { PipelineView } from './components/PipelineView';
import { ApplicationTable } from './components/ApplicationTable';
import { ApplicationDetail } from './components/ApplicationDetail';
import { NewApplicationModal } from './components/NewApplicationModal';
import { ProfileCard } from './components/ProfileCard';
import { ActionBar } from './components/ActionBar';
import { BurnListView } from './components/BurnListView';
import { GenerateTab } from './components/panels/GenerateTab';
import { SettingsPanel } from './components/panels/SettingsPanel';
import {
  fetchApplications,
  fetchBurnList,
  fetchSession,
  checkApiHealth,
} from './data/api';
import {
  applications as mockApplications,
  weeklyData,
  statusCounts as mockStatusCounts,
  activityFeed,
  matchScoreHistory,
} from './data/mockData';
import type { TabId, SidebarConfig, Application, ProfileSummary, BurnListEntry, StatusCount } from './types';
import type { RawApplication } from './data/api';
import { cn } from './utils/cn';
import {
  Briefcase,
  Send,
  MessageSquare,
  Gift,
  Target,
  TrendingUp,
  Flame,
  AlertTriangle,
  Wifi,
  WifiOff,
} from 'lucide-react';

/**
 * Extract URL from markdown link format like `[📄](path/to/file.pdf)`
 */
function extractUrl(text: string | undefined | null): string {
  if (!text || text === '❌' || text === 'N/A') return '';
  const match = text.match(/\[.*?\]\((.*?)\)/);
  let url = match ? match[1] : text;
  
  // Clean up any leading emojis or whitespace from raw paths
  if (!match) {
    url = url.replace(/^[^a-zA-Z0-9./-]+/, '').trim();
  }
  
  if (url && !url.startsWith('http')) {
    return `http://localhost:3001/${url}`;
  }
  return url;
}

/**
 * Convert raw API application to the Application type used by components.
 */
function toApplication(raw: RawApplication): Application {
  const numericScore = parseFloat(raw.score) || 0;
  const priority = numericScore >= 4.0 ? 'high' as const :
                   numericScore >= 3.0 ? 'medium' as const : 'low' as const;

  // Extract tags from role name
  const tags: string[] = [];
  const roleLower = raw.role.toLowerCase();
  if (roleLower.includes('ml') || roleLower.includes('machine learning')) tags.push('ML');
  if (roleLower.includes('cv') || roleLower.includes('computer vision')) tags.push('CV');
  if (roleLower.includes('data')) tags.push('Data');
  if (roleLower.includes('robot')) tags.push('Robotics');
  if (roleLower.includes('werkstudent') || roleLower.includes('working student')) tags.push('Werkstudent');
  if (roleLower.includes('full-time') || roleLower.includes('fulltime')) tags.push('Full-time');

  return {
    id: raw.id,
    company: raw.company,
    role: raw.role,
    date: raw.date,
    score: raw.score,
    status: raw.status as Application['status'],
    pdf: extractUrl(raw.pdf),
    report: extractUrl(raw.report),
    jobUrl: raw.job_url || '',
    notes: raw.notes,
    priority,
    matchScore: numericScore * 20, // Convert 5-point to percentage
    tags,
  };
}

export default function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewApplication, setShowNewApplication] = useState(false);
  const [config, setConfig] = useState<SidebarConfig>({
    showRejected: true,
    showDiscarded: true,
    showSkipped: false,
    sortBy: 'date',
    viewMode: 'table',
    autoRefresh: false,
    notifications: true,
    darkCharts: true,
    compactMode: false,
  });

  // API state
  const [apiConnected, setApiConnected] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [burnList, setBurnList] = useState<BurnListEntry[]>([]);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  // Auto-collapse the sidebar on small screens — the expanded 288px rail
  // squeezes the header nav to zero width on mobile. Desktop keeps the
  // user's manual collapsed/expanded choice.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const apply = () => {
      if (mq.matches) setSidebarCollapsed(true);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Check API health and load data
  const loadData = useCallback(async () => {
    const healthy = await checkApiHealth();
    setApiConnected(healthy);

    if (healthy) {
      try {
        const [rawApps, burnEntries, session] = await Promise.all([
          fetchApplications(),
          fetchBurnList(),
          fetchSession(),
        ]);

        setApplications(rawApps.map(toApplication));
        setBurnList(burnEntries);

        if (session.initialized && session.user) {
          setProfile({
            name: session.user.name,
            location: session.user.location,
            visa: session.user.visa,
            hours_per_week: session.user.hours_per_week,
            german_level: session.user.german_level,
            german_target: session.user.german_target,
            target_roles: session.user.target_roles,
          });
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        // Fall back to mock data
        setApplications(mockApplications.map(a => ({
          ...a,
          date: a.appliedDate,
          score: `${(a.matchScore / 20).toFixed(1)}/5`,
          status: a.status === 'bookmarked' ? 'Evaluated' :
                  a.status === 'screening' ? 'Responded' :
                  a.status === 'accepted' ? 'Offer' :
                  a.status === 'withdrawn' ? 'Discarded' :
                  (a.status.charAt(0).toUpperCase() + a.status.slice(1)) as Application['status'],
          pdf: '',
          report: '',
        })));
      }
    } else {
      // Use mock data when API is not available
      setApplications(mockApplications.map(a => ({
        ...a,
        date: a.appliedDate,
        score: `${(a.matchScore / 20).toFixed(1)}/5`,
        status: a.status === 'bookmarked' ? 'Evaluated' :
                a.status === 'screening' ? 'Responded' :
                a.status === 'accepted' ? 'Offer' :
                a.status === 'withdrawn' ? 'Discarded' :
                (a.status.charAt(0).toUpperCase() + a.status.slice(1)) as Application['status'],
        pdf: '',
        report: '',
      })));
    }

    setDataLoaded(true);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh
  useEffect(() => {
    if (!config.autoRefresh) return;
    const interval = setInterval(loadData, 30000); // 30s
    return () => clearInterval(interval);
  }, [config.autoRefresh, loadData]);

  // Computed metrics
  const metrics = useMemo(() => {
    const total = applications.length;
    const active = applications.filter(
      a => !['Rejected', 'Discarded', 'SKIP'].includes(a.status)
    ).length;
    const interviewing = applications.filter(a => a.status === 'Interview').length;
    const offers = applications.filter(a => a.status === 'Offer').length;
    const applied = applications.filter(a => a.status === 'Applied').length;
    const evaluated = applications.filter(a => a.status === 'Evaluated').length;
    const responded = applications.filter(a => a.status === 'Responded').length;
    const rejected = applications.filter(a => a.status === 'Rejected').length;
    const avgScore = total > 0
      ? (applications.reduce((s, a) => s + (parseFloat(a.score) || 0), 0) / total).toFixed(1)
      : '0.0';
    const responseRate = total > 0
      ? Math.round(
          (applications.filter(a => ['Responded', 'Interview', 'Offer'].includes(a.status)).length / total) * 100
        )
      : 0;

    return { total, active, interviewing, offers, applied, evaluated, responded, rejected, avgScore, responseRate };
  }, [applications]);

  // Generate status counts for chart
  const currentStatusCounts: StatusCount[] = useMemo(() => {
    if (!dataLoaded) return mockStatusCounts;

    const statusMap: Record<string, number> = {};
    for (const app of applications) {
      statusMap[app.status] = (statusMap[app.status] || 0) + 1;
    }

    return Object.entries(statusMap).map(([status, count]) => ({
      status,
      count,
    }));
  }, [applications, dataLoaded]);

  const handleNewApplication = () => {
    setShowNewApplication(true);
  };

  const handleCreated = () => {
    setShowNewApplication(false);
    loadData();
  };

  const handleStatusChange = (id: string, status: Application['status']) => {
    setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary selection:bg-accent/30 selection:text-white relative overflow-hidden">
      {/* Ambient background effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-accent/5 rounded-full blur-[120px] mix-blend-screen transform translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-cyan/5 rounded-full blur-[100px] mix-blend-screen transform -translate-x-1/3 translate-y-1/3" />
      </div>

      {/* API connection banner — below header chrome so it never covers the CODE RED strip */}
      {dataLoaded && !apiConnected && (
        <div className="fixed top-16 left-0 right-0 z-50 bg-warn-bg border-b border-warn-border px-4 py-2 flex items-center justify-center gap-2 text-xs text-warn">
          <WifiOff className="w-3.5 h-3.5" />
          <span>API server offline — showing demo data. Start with: <code className="font-mono bg-bg-primary px-1.5 py-0.5 rounded">node dashboard/server/api.mjs</code></span>
        </div>
      )}

      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        config={config}
        onConfigChange={setConfig}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sidebarCollapsed={sidebarCollapsed}
        onNewApplication={handleNewApplication}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        apiConnected={apiConnected}
        metrics={metrics}
      />

      {/* Main Content */}
      <main
        className={cn(
          'transition-all duration-300 min-h-screen relative z-10',
          sidebarCollapsed ? 'ml-16' : 'ml-72',
          dataLoaded && !apiConnected ? 'pt-[6.5rem]' : 'pt-16'
        )}
      >
        <div className="p-6">
          {/* Page Title */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-xl font-bold text-text-primary">
                {activeTab === 'overview' && 'Dashboard Overview'}
                {activeTab === 'pipeline' && 'Application Pipeline'}
                {activeTab === 'applications' && 'All Applications'}
                {activeTab === 'burn-list' && 'Burn List'}
                {activeTab === 'generate' && 'Generate Documents'}
                {activeTab === 'settings' && 'Settings'}
              </h2>
              <span className="text-[10px] font-mono text-text-dim bg-bg-card border border-border-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                {apiConnected ? (
                  <>
                    <Wifi className="w-2.5 h-2.5 text-gain" />
                    LIVE
                  </>
                ) : (
                  <>
                    <WifiOff className="w-2.5 h-2.5 text-warn" />
                    DEMO
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-text-muted">
                {activeTab === 'overview' && 'Your German job search at a glance — metrics, trends, and quick actions.'}
                {activeTab === 'pipeline' && 'Visualize applications flowing through each career-ops stage.'}
                {activeTab === 'applications' && 'Detailed view of all tracked applications with filtering and sorting.'}
                {activeTab === 'burn-list' && 'Companies with rejection cooldown — auto-populated from Gmail sync.'}
                {activeTab === 'generate' && 'Generate tailored CVs and cover letters for any German company.'}
                {activeTab === 'settings' && 'Dashboard configuration and system status.'}
            </p>
          </div>

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              {/* Metrics Row */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                <MetricCard
                  title="Total"
                  value={metrics.total}
                  change={0}
                  changeLabel="all"
                  icon={<Briefcase className="w-4 h-4" />}
                  sparkline={[]}
                  accentColor="info"
                  subtitle="All applications"
                />
                <MetricCard
                  title="Active"
                  value={metrics.active}
                  change={0}
                  changeLabel=""
                  icon={<Target className="w-4 h-4" />}
                  sparkline={[]}
                  accentColor="accent"
                  subtitle="In pipeline"
                />
                <MetricCard
                  title="Applied"
                  value={metrics.applied}
                  change={0}
                  changeLabel=""
                  icon={<Send className="w-4 h-4" />}
                  sparkline={[]}
                  accentColor="info"
                  subtitle="Awaiting response"
                />
                <MetricCard
                  title="Interviews"
                  value={metrics.interviewing}
                  change={0}
                  changeLabel=""
                  icon={<MessageSquare className="w-4 h-4" />}
                  sparkline={[]}
                  accentColor="cyan"
                  subtitle="In progress"
                />
                <MetricCard
                  title="Offers"
                  value={metrics.offers}
                  change={0}
                  changeLabel=""
                  icon={<Gift className="w-4 h-4" />}
                  sparkline={[]}
                  accentColor="gain"
                  subtitle="Pending decision"
                />
                <MetricCard
                  title="Avg Score"
                  value={`${metrics.avgScore}/5`}
                  change={0}
                  changeLabel=""
                  icon={<TrendingUp className="w-4 h-4" />}
                  sparkline={matchScoreHistory}
                  accentColor="warn"
                  subtitle="Evaluation avg"
                />
              </div>

              {/* Main content grid */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                {/* Left: Charts */}
                <div className="lg:col-span-3 space-y-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    <div className="lg:col-span-2">
                      <WeeklyTrendChart data={weeklyData} />
                    </div>
                    <ResponseDonut rate={metrics.responseRate} />
                  </div>
                  <StatusBarChart data={currentStatusCounts} />
                </div>

                {/* Right: Profile + Actions + Activity */}
                <div className="space-y-4">
                  <ProfileCard profile={profile} />
                  <ActionBar onDataRefresh={loadData} apiConnected={apiConnected} preferredCompany={profile?.name} />
                  <ActivityFeed activities={activityFeed} showUnread={config.notifications} />
                </div>
              </div>

              {/* Burn list preview */}
              {burnList.length > 0 && (
                <div className="bg-bg-card/40 backdrop-blur-xl border border-border-primary/50 rounded-xl overflow-hidden shadow-xl shadow-black/10">
                  <div className="px-5 py-4 border-b border-border-primary/30 flex items-center justify-between bg-bg-card/20">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-loss/10 shadow-inner">
                        <Flame className="w-4 h-4 text-loss" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary">Burn List</h3>
                        <p className="text-[10px] text-text-dim font-mono tracking-wider mt-0.5">{burnList.length} COMPANIES BLOCKED</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('burn-list')}
                      className="text-[10px] text-accent hover:text-accent/80 font-bold uppercase tracking-wider transition-colors"
                    >
                      View All →
                    </button>
                  </div>
                  <div className="divide-y divide-border-primary/30">
                    {burnList.slice(0, 3).map((entry, i) => (
                      <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-bg-card-hover/50 transition-colors">
                        <AlertTriangle className="w-3.5 h-3.5 text-warn shrink-0" />
                        <span className="text-xs font-semibold text-text-primary">{entry.company}</span>
                        <span className="text-[10px] text-text-muted ml-auto font-mono">{entry.role}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* PIPELINE TAB */}
          {activeTab === 'pipeline' && (
            <div className="animate-fade-in">
              <PipelineView
                applications={applications}
                onSelectApp={setSelectedApp}
              />
            </div>
          )}

          {/* APPLICATIONS TAB */}
          {activeTab === 'applications' && (
            <div className="animate-fade-in">
              <ApplicationTable
                applications={applications}
                config={config}
                onSelectApp={setSelectedApp}
                searchQuery={searchQuery}
              />
            </div>
          )}

          {/* BURN LIST TAB */}
          {activeTab === 'burn-list' && (
            <BurnListView entries={burnList} />
          )}

          {/* GENERATE TAB */}
          {activeTab === 'generate' && (
            <GenerateTab />
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <SettingsPanel config={config} onConfigChange={setConfig} />
          )}
        </div>
      </main>

      {/* Application Detail Modal */}
      {selectedApp && (
        <ApplicationDetail
          application={selectedApp}
          onClose={() => setSelectedApp(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* New Application Modal */}
      {showNewApplication && (
        <NewApplicationModal
          onClose={() => setShowNewApplication(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
