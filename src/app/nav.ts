import { Landmark, LayoutDashboard, Users, Scale, CalendarDays, FileText, IndianRupee, ListChecks, BarChart3, Settings } from 'lucide-react';
import type { MessageKey } from '@/i18n/messages';

export const NAV = [
  { to: '/', label: 'nav.dashboard', icon: LayoutDashboard, stage: 'Stage 4', mobile: true },
  { to: '/clients', label: 'nav.clients', icon: Users, stage: 'Stage 4', mobile: true },
  { to: '/cases', label: 'nav.cases', icon: Scale, stage: 'Stage 5', mobile: true },
  { to: '/courts', label: 'nav.courts', icon: Landmark, stage: 'Stage 5', mobile: false },
  { to: '/diary', label: 'nav.diary', icon: CalendarDays, stage: 'Stage 6', mobile: true },
  { to: '/documents', label: 'nav.documents', icon: FileText, stage: 'Stage 7', mobile: false },
  { to: '/fees', label: 'nav.fees', icon: IndianRupee, stage: 'Stage 8', mobile: true },
  { to: '/tasks', label: 'nav.tasks', icon: ListChecks, stage: 'Stage 6', mobile: false },
  { to: '/reports', label: 'nav.reports', icon: BarChart3, stage: 'Stage 8', mobile: false },
  { to: '/settings', label: 'nav.settings', icon: Settings, stage: 'Stage 9', mobile: false },
] as const satisfies readonly { to: string; label: MessageKey; icon: unknown; stage: string; mobile: boolean }[];
