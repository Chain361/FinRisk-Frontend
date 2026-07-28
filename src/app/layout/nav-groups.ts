import { AuthService } from '../core/auth/auth.service';
import { FEATURE_GROUPS } from '../core/auth/features';
import { PUBLIC_EXPORT_ROLES } from '../core/auth/roles';

export interface NavItem {
  code: string;
  label: string;
  path: string;
  children?: NavItem[];
  exact?: boolean;
  /** จำกัดเมนูเฉพาะบาง role (ตาม roles.md) — ไม่ระบุ = ทุก role เห็น */
  roles?: readonly string[];
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

interface NavRoute {
  path: string;
  exact?: boolean;
  children?: Array<{ code: string; label: string; path: string; exact?: boolean }>;
}

/**
 * เส้นทาง/หน้าย่อยของแต่ละฟีเจอร์ — คีย์ตาม FeatureItem.code ใน core/auth/features.ts
 * id/label กลุ่ม + code/label/roles ของฟีเจอร์ใช้จาก FEATURE_GROUPS ที่เดียว (ไม่ duplicate ที่นี่)
 * เพิ่ม/ลบหน้าเมนู: แก้ FEATURE_GROUPS ก่อน แล้วเพิ่ม route ที่นี่ให้ตรง code
 */
const NAV_ROUTES: Record<string, NavRoute> = {
  risk_dashboard: {
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
  fiscal_dashboard: {
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
  projects_view: {
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
  assign_audit_tasks: {
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
  team_reports: {
    path: '/risk-analyst/my-tasks',
  },
  audit_feedback: {
    path: '/risk-analyst-feedback',
  },
  auditor_feedback: {
    path: '/auditor-feedback',
  },
  access_logs: {
    path: '/admin/access-log', // เห็นเฉพาะ admin — ตรงกับ roleGuard('admin') ที่ route
  },
  risk_engine: {
    path: '/admin/data-upload', // เห็นเฉพาะ admin — ตรงกับ roleGuard('admin') ที่ route
  },
  user_management: {
    path: '/admin/user-management', // เห็นเฉพาะ admin — ตรงกับ roleGuard('admin') ที่ route
  },
  public_audit_info: {
    path: '/data-sources',
  },
  public_projects_export: {
  path: '/open-data',
  },
  contact_report: {
    path: '/contact',
  },
};

export const NAV_GROUPS: NavGroup[] = FEATURE_GROUPS.map((group) => ({
  id: group.id,
  label: group.label,
  items: group.items.map((item): NavItem => {
    const route = NAV_ROUTES[item.code];
    if (!route) {
      throw new Error(`nav-groups: missing route mapping for feature "${item.code}"`);
    }
    return {
      code: item.code,
      label: item.label,
      path: route.path,
      exact: route.exact,
      children: route.children,
      roles: item.roles,
    };
  }),
}));

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
