import { AuthService } from '../core/auth/auth.service';
import { ASSIGNMENT_ROLES } from '../core/auth/roles';

export interface NavItem {
  code: string;
  label: string;
  path: string;
  children?: NavItem[];
  exact?: boolean;
  /** จำกัดเมนูเฉพาะบาง role (ตาม roles.md) — ไม่ระบุ = ทุก role เห็น */
  roles?: string[];
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    label: 'ภาพรวมความเสี่ยง',
    items: [
      {
        code: 'risk_dashboard',
        label: 'แดชบอร์ดความเสี่ยงโครงการ',
        path: '/project-risk',
        children: [
          {
            code: 'F1.1',
            label: 'ภาพรวมสุขภาพความเสี่ยงโครงการ',
            path: '/project-risk/overview',
          },
          {
            code: 'F1.2',
            label: 'วิเคราะห์ข้อมูลโครงการเชิงลึก',
            path: '/project-risk/insights',
          },
        ],
      },
    ],
  },
  {
    id: 'finance',
    label: 'การเงินและปัจจัยเสี่ยง',
    items: [
      {
        code: 'fiscal_dashboard',
        label: 'สถานะและสุขภาพการคลัง',
        path: '/financial-health',
        children: [
          {
            code: 'F2.1',
            label: 'ภาพรวมสุขภาพการคลัง',
            path: '/financial-health/overview',
          },
          {
            code: 'F2.2',
            label: 'เปรียบเทียบสถานะการคลัง',
            path: '/financial-health/benchmarking',
          },
          {
            code: 'F2.3',
            label: 'แนวโน้มการลงทุนและการจัดซื้อจัดจ้าง',
            path: '/financial-health/investment-trends',
          },
          {
            code: 'F2.4',
            label: 'ตัวชี้วัดความเสี่ยงทางการคลัง',
            path: '/financial-health/risk-indicators',
          },
        ],
      },
      {
        code: 'projects_view',
        label: 'โครงการทั้งหมด',
        path: '/risk-factors',
        children: [
          {
            code: 'F3.1',
            label: 'รายละเอียดโครงการ',
            path: '/risk-factors',
            exact: true,
          },
          {
            code: 'F3.2',
            label: 'สถานะโครงการ',
            path: '/risk-factors/status',
          },
        ],
      },
      {
        code: 'assign_audit_tasks',
        label: 'มอบหมายงาน',
        path: '/assignment-project-auditor',
        children: [
          {
            code: 'F4.1',
            label: 'มอบหมายงานหลัก',
            path: '/assignment-project-auditor',
            exact: true,
          },
          {
            code: 'F4.2',
            label: 'ประวัติการมอบหมายงาน',
            path: '/assignment-project-auditor/history',
          },
          {
            code: 'F4.3',
            label: 'ตรวจทานงานที่ส่งกลับมา',
            path: '/assignment-project-auditor/review',
          },
        ],
      },
      {
        code: 'team_reports',
        label: 'งานที่ได้รับมอบหมาย',
        path: '/risk-analyst/my-tasks',
        roles: [...ASSIGNMENT_ROLES],
      },
      {
        code: 'audit_feedback',
        label: 'แบบฟอร์มบันทึกความคิดเห็น',
        path: '/risk-analyst-feedback',
        roles: [
          'admin',
          'regional_supervisor',
          'local_executive',
          'project_auditor',
          'risk_analyst',
        ],
      },
    ],
  },
  {
    id: 'audit',
    label: 'งานตรวจสอบ',
    items: [
      {
        code: 'auditor_feedback',
        label: 'ความเห็นผู้ตรวจสอบ',
        path: '/auditor-feedback',
        // mirror FEEDBACK_ROLES (core/auth/roles.ts) — ซ่อนจาก public_user
        roles: [
          'admin',
          'regional_supervisor',
          'local_executive',
          'project_auditor',
          'risk_analyst',
        ],
      },
    ],
  },
  {
    id: 'admin',
    label: 'ผู้ดูแลระบบ',
    items: [
      {
        code: 'access_logs',
        label: 'บันทึกการเข้าถึงระบบ',
        path: '/admin/access-log',
        roles: ['admin'], // เห็นเฉพาะ admin — ตรงกับ roleGuard('admin') ที่ route
      },
      {
        code: 'risk_engine',
        label: 'นำเข้าข้อมูล & รัน Risk Engine',
        path: '/admin/data-upload',
        roles: ['admin'], // เห็นเฉพาะ admin — ตรงกับ roleGuard('admin') ที่ route
      },
      {
        code: 'user_management',
        label: 'จัดการผู้ใช้งาน',
        path: '/admin/user-management',
        roles: ['admin'], // เห็นเฉพาะ admin — ตรงกับ roleGuard('admin') ที่ route
      },
    ],
  },
  {
    id: 'transparency',
    label: 'ความโปร่งใส & ติดต่อ',
    items: [
      {
        code: 'public_audit_info',
        label: 'ที่มาของข้อมูล',
        path: '/data-sources',
      },
      {
        code: 'contact_report',
        label: 'ติดต่อ / แจ้งข้อมูลไม่ถูกต้อง',
        path: '/contact',
      },
    ],
  },
];

/** เมนูแรกตามลำดับ NAV_GROUPS ที่ผู้ใช้คนนี้เข้าถึงได้ — ใช้เป็นหน้าแรกหลัง login แทนเส้นทางตายตัว */
export function firstAccessibleNavPath(auth: AuthService): string {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      const canSeeByRole = !item.roles || auth.hasRole(...item.roles);
      if (canSeeByRole && auth.canAccessFeature(item.code)) {
        return item.path;
      }
    }
  }
  return '/project-risk';
}
