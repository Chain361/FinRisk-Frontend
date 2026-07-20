import { Routes } from '@angular/router';

import { FinancialHealthStatusPageComponent } from './financial-health-status.page';
import { ProjectRiskInsightsPageComponent } from './project-risk-insights.page';
import { ProjectRiskOverviewPageComponent } from './project-risk-overview.page';

/**
 * นำรายการในตัวแปรนี้ไปรวมกับ routes หลักของโปรเจกต์
 * ชื่อ component และ path ตรงกับไฟล์หน้าเพจทั้ง 3 ไฟล์ในโฟลเดอร์นี้
 */
export const PROJECT_RISK_ROUTES: Routes = [
  {
    path: 'project-risk',
    component: ProjectRiskOverviewPageComponent,
  },
  {
    path: 'project-risk/insights',
    component: ProjectRiskInsightsPageComponent,
  },
  {
    path: 'financial-health-status',
    component: FinancialHealthStatusPageComponent,
  },
];
