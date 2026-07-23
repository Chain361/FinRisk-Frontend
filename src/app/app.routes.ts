import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { FEEDBACK_ROLES } from './core/auth/roles';
import { AppShellComponent } from './layout/app-shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'project-risk' },
      {
        path: 'project-risk',
        children: [
          {
            path: 'overview',
            loadComponent: () =>
              import('./features/project-risk/overview/overview.page').then(
                (m) => m.OverviewPageComponent,
              ),
          },
          {
            path: 'insights',
            loadComponent: () =>
              import('./features/project-risk/insights/insights.page').then(
                (m) => m.InsightsPageComponent,
              ),
          },
          {
            path: '',
            redirectTo: 'overview',
            pathMatch: 'full',
          },
        ],
      },
      {
        path: 'financial-health',
        children: [
          {
            path: 'overview',
            loadComponent: () =>
              import('./features/financial-health/overview/overview.page').then(
                (m) => m.OverviewPageComponent,
              ),
          },
          {
            path: 'benchmarking',
            loadComponent: () =>
              import('./features/financial-health/benchmarking/benchmarking.page').then(
                (m) => m.BenchmarkingPageComponent,
              ),
          },
          {
            path: 'investment-trends',
            loadComponent: () =>
              import('./features/financial-health/investment-trends/investment-trends.page').then(
                (m) => m.InvestmentTrendsPageComponent,
              ),
          },
          {
            path: 'risk-indicators',
            loadComponent: () =>
              import('./features/financial-health/risk-indicators/risk-indicators.page').then(
                (m) => m.RiskIndicatorsPageComponent,
              ),
          },
          {
            path: '',
            redirectTo: 'overview',
            pathMatch: 'full',
          },
        ],
      },
      {
        path: 'risk-factors/status',
        loadComponent: () =>
          import('./features/assignment-project-auditor/assignment-project-auditor-status.page').then(
            (m) => m.AssignmentProjectAuditorStatusPageComponent,
          ),
      },
      {
        path: 'risk-factors',
        loadComponent: () =>
          import('./features/risk-factors/risk-factors.page').then(
            (m) => m.RiskFactorsPageComponent,
          ),
      },
      {
        path: 'assignment-project-auditor',
        children: [
          {
            path: '',
            loadComponent: () =>
              import('./features/assignment-project-auditor/assignment-project-auditor.page').then(
                (m) => m.AssignmentProjectAuditorPageComponent,
              ),
          },
          {
            path: 'history',
            loadComponent: () =>
              import('./features/assignment-project-auditor/assignment-project-auditor-history.page').then(
                (m) => m.AssignmentProjectAuditorHistoryPageComponent,
              ),
          },
        ],
      },
      {
        path: 'trends',
        loadComponent: () =>
          import('./features/trends/trends.page').then((m) => m.TrendsPageComponent),
      },
      {
        // บันทึกการเข้าถึงระบบ — เฉพาะ admin (backend บังคับสิทธิ์ซ้ำด้วย require_roles("admin"))
        path: 'admin/access-log',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('./features/admin/access-log.page').then((m) => m.AccessLogPageComponent),
      },
      {
        path: 'risk-analyst-feedback',
        canActivate: [roleGuard(...FEEDBACK_ROLES)],
        loadComponent: () =>
          import('./features/risk-analyst-feedback/risk-analyst-feedback.page').then(
            (m) => m.RiskAnalystFeedbackPageComponent,
          ),
      },
      {
        path: 'auditor-feedback',
        canActivate: [roleGuard(...FEEDBACK_ROLES)],
        loadComponent: () =>
          import('./features/auditor-feedback/auditor-feedback.page').then(
            (m) => m.AuditorFeedbackPageComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'project-risk' },
];
