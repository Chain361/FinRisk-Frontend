import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
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
          import('./features/project-risk/project-risk.page').then((m) => m.ProjectRiskPageComponent),
      },
      {
        path: 'financial-health',
        loadComponent: () =>
          import('./features/financial-health/financial-health.page').then((m) => m.FinancialHealthPageComponent),
      },
      {
        path: 'risk-factors',
        loadComponent: () => import('./features/risk-factors/risk-factors.page').then((m) => m.RiskFactorsPageComponent),
      },
      {
        path: 'trends',
        loadComponent: () => import('./features/trends/trends.page').then((m) => m.TrendsPageComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'project-risk' },
];
