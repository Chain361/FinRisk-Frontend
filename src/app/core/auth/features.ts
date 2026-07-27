import { ASSIGNMENT_ROLES, FEEDBACK_ROLES } from './roles';

export interface FeatureItem {
  code: string;
  label: string;
  /** ไม่ระบุ = ทุก role เห็นเป็นค่าเริ่มต้น */
  roles?: readonly string[];
}

export interface FeatureGroup {
  id: string;
  label: string;
  items: FeatureItem[];
}

/** mirror ของ NAV_GROUPS ใน layout/app-shell.component.ts (เฉพาะเมนูระดับบนสุด) — เพิ่ม/ลบหน้าต้องแก้ทั้งสองที่ */
export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'overview',
    label: 'ภาพรวมความเสี่ยง',
    items: [
      {
        code: 'risk_dashboard',
        label: 'แดชบอร์ดความเสี่ยงโครงการ',
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
      },
      {
        code: 'projects_view',
        label: 'โครงการทั้งหมด',
      },
      {
        code: 'assign_audit_tasks',
        label: 'มอบหมายงาน',
      },
      {
        code: 'team_reports',
        label: 'งานที่ได้รับมอบหมาย',
        roles: ASSIGNMENT_ROLES,
      },
      {
        code: 'audit_feedback',
        label: 'แบบฟอร์มบันทึกความคิดเห็น',
        roles: FEEDBACK_ROLES,
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
        roles: FEEDBACK_ROLES,
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
        roles: ['admin'],
      },
      {
        code: 'risk_engine',
        label: 'นำเข้าข้อมูล & รัน Risk Engine',
        roles: ['admin'],
      },
      {
        code: 'user_management',
        label: 'จัดการผู้ใช้งาน',
        roles: ['admin'],
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
      },
      {
        code: 'contact_report',
        label: 'ติดต่อ / แจ้งข้อมูลไม่ถูกต้อง',
      },
    ],
  },
];

export const ALL_FEATURE_ITEMS = FEATURE_GROUPS.flatMap((g) => g.items);

/** ชุดฟีเจอร์เริ่มต้นของ role หนึ่งๆ (ก่อนถูกปรับแต่งรายคนใน user-management) */
export function defaultFeaturesForRole(role: string): string[] {
  return ALL_FEATURE_ITEMS.filter((item) => !item.roles || item.roles.includes(role)).map(
    (item) => item.code,
  );
}
