import { Routes } from '@angular/router';

import { authGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';
import { ASSIGNMENT_ROLES, FEEDBACK_ROLES, PUBLIC_EXPORT_ROLES } from './core/auth/roles';
import { AppShellComponent } from './layout/app-shell.component';
import { exportAccessGuard } from './core/auth/export-access.guard';

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
        // เอกสารประกอบโครงการ + checklist/ผล OCR (issue #35) — เข้าถึงได้ทุก role ที่ login
        // (backend endpoint ไม่มี require_roles จำกัด แค่ scope guard ตามตำบล)
        path: 'document-intelligence/:projectId',
        loadComponent: () =>
          import('./features/document-intelligence/document-intelligence.page').then(
            (m) => m.DocumentIntelligencePageComponent,
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
        // ที่มาของข้อมูลระดับระบบ (data source registry) — เข้าถึงได้ทุก role
        path: 'data-sources',
        loadComponent: () =>
          import('./features/data-sources/data-sources.page').then(
            (m) => m.DataSourcesPageComponent,
          ),
      },
      {
        // ชุดข้อมูลเปิด — backend อนุญาต admin/regional_supervisor/public_user เท่านั้น
        path: 'open-data',
        canActivate: [exportAccessGuard],
        loadComponent: () =>
          import('./features/open-data/open-data.page').then((m) => m.OpenDataPageComponent),
      },
      {
        // ติดต่อ / แจ้งข้อมูลไม่ถูกต้อง — เข้าถึงได้ทุก role
        path: 'contact',
        loadComponent: () =>
          import('./features/contact/contact.page').then((m) => m.ContactPageComponent),
      },
      {
        path: 'privacy-policy',
        loadComponent: () =>
          import('./features/privacy-policy/privacy-policy.page').then(
            (m) => m.PrivacyPolicyPageComponent,
          ),
      },
      {
        // บันทึกการเข้าถึงระบบ — เฉพาะ admin (backend บังคับสิทธิ์ซ้ำด้วย require_roles("admin"))
        path: 'admin/access-log',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('./features/admin/access-log.page').then((m) => m.AccessLogPageComponent),
      },
      {
        // นำเข้าข้อมูลรอบใหม่ + สั่งรัน risk engine ใหม่ — เฉพาะ admin
        path: 'admin/data-upload',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('./features/admin/data-upload.page').then((m) => m.DataUploadPageComponent),
      },
      {
        // เพิ่ม/แก้ไข/จัดการบัญชีผู้ใช้งาน — เฉพาะ admin
        path: 'admin/user-management',
        canActivate: [roleGuard('admin')],
        loadComponent: () =>
          import('./features/user-management/user-management.page').then(
            (m) => m.UserManagementPageComponent,
          ),
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
      {
        // งานที่ได้รับมอบหมาย (Risk Analyst) — เฉพาะ role ที่ backend อนุญาตบน GET /audit/assignments
        path: 'risk-analyst',
        canActivate: [roleGuard(...ASSIGNMENT_ROLES)],
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'my-tasks' },
          {
            path: 'my-tasks',
            loadComponent: () =>
              import('./features/risk-analyst/risk-analyst-my-tasks.page').then(
                (m) => m.RiskAnalystMyTasksPageComponent,
              ),
          },
          {
            path: 'task/:id',
            loadComponent: () =>
              import('./features/risk-analyst/risk-analyst-task-detail.page').then(
                (m) => m.RiskAnalystTaskDetailPageComponent,
              ),
          },
        ],
      },
    ],
  },
  { path: '**', redirectTo: 'project-risk' },
];
