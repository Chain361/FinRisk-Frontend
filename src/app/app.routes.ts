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
        loadComponent: () =>
          import('./features/project-risk/project-risk.page').then(
            (m) => m.ProjectRiskOverviewPageComponent,
          ),
      },
      {
        path: 'project-risk/analysis',
        loadComponent: () =>
          import('./features/project-risk/project-risk.page.analysis').then(
            (m) => m.ProjectRiskAnalysisPageComponent,
          ),
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
        path: 'risk-factors',
        loadComponent: () =>
          import('./features/risk-factors/risk-factors.page').then(
            (m) => m.RiskFactorsPageComponent,
          ),
      },
      {
        path: 'trends',
        loadComponent: () =>
          import('./features/trends/trends.page').then((m) => m.TrendsPageComponent),
      },
      {
        path: 'risk-analyst-feedback',
        loadComponent: () =>
          import('./features/risk-analyst-feedback/risk-analyst-feedback.page').then(
            (m) => m.RiskAnalystFeedbackPageComponent,
          ),
      },
      {
        // F6 — จำกัดตาม FEEDBACK_ROLES (public_user เข้าไม่ได้; backend บังคับซ้ำอีกชั้น)
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
