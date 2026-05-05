// Career-Ops Germany canonical application statuses
export type ApplicationStatus =
  | 'Evaluated'
  | 'Applied'
  | 'Responded'
  | 'Interview'
  | 'Offer'
  | 'Rejected'
  | 'Discarded'
  | 'SKIP';

export type Priority = 'high' | 'medium' | 'low';

export interface Application {
  id: string;
  company: string;
  role: string;
  date: string;
  score: string;
  status: ApplicationStatus;
  pdf: string;
  report: string;
  jobUrl?: string;
  notes: string;
  // Computed/UI fields
  priority: Priority;
  matchScore: number;
  tags: string[];
}

export interface WeeklyData {
  week: string;
  applied: number;
  interviews: number;
  offers: number;
  rejected: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface ActivityItem {
  id: string;
  type: 'applied' | 'interview' | 'offer' | 'rejected' | 'update' | 'reminder' | 'scan' | 'sync';
  company: string;
  message: string;
  time: string;
  isNew: boolean;
}

export interface SidebarConfig {
  showRejected: boolean;
  showDiscarded: boolean;
  showSkipped: boolean;
  sortBy: 'date' | 'priority' | 'match' | 'company' | 'status';
  viewMode: 'table' | 'kanban';
  autoRefresh: boolean;
  notifications: boolean;
  darkCharts: boolean;
  compactMode: boolean;
}

export type TabId = 'overview' | 'pipeline' | 'applications' | 'burn-list' | 'generate' | 'settings';

export interface BurnListEntry {
  company: string;
  rejection_date: string;
  role: string;
  reason: string;
  earliest_reapply: string;
}

export interface ProfileSummary {
  name: string;
  location: string;
  visa: string;
  hours_per_week: number;
  german_level: string;
  german_target: string;
  target_roles: string[];
}
