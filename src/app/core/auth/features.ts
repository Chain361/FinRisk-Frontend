import { ASSIGNMENT_ROLES, FEEDBACK_ROLES, PUBLIC_EXPORT_ROLES } from './roles';

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

/** แหล่งความจริงเดียวของ id/label/roles ระดับฟีเจอร์ — layout/nav-groups.ts ดึงจากที่นี่แล้วเติม path/children เอง
 * เพิ่ม/ลบฟีเจอร์ใหม่: เพิ่มที่นี่ก่อน แล้วเพิ่ม route ให้ตรง code ใน layout/nav-groups.ts (NAV_ROUTES) */
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
        label: 'ความเห็นนักวิเคราะห์ความเสี่ยง',
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
        code: 'public_projects_export',
        label: 'อัปโหลดข้อมูลสาธารณะ',
        roles: PUBLIC_EXPORT_ROLES,
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

/**
 * เลือกสิทธิ์ฟีเจอร์ที่ใช้จริงจาก response ของ backend
 * - `undefined` (field ไม่ถูกส่งมาเลย, backward-compat กับ response เก่า) → ยังไม่เคยตั้งค่า ใช้ default ของ role
 * - `[]` (ส่งมาเป็น array ว่างตรงๆ) → แอดมินตั้งใจเพิกถอนสิทธิ์ทั้งหมด ต้องเก็บไว้ตามนั้น ห้าม fallback
 */
export function resolveAllowedFeatures(features: string[] | undefined, role: string): string[] {
  return features === undefined ? defaultFeaturesForRole(role) : features;
}

/** ฟีเจอร์ที่ admin เข้าถึงได้เสมอไม่ว่า allowed_features จะตั้งไว้ยังไง — กันแอดมินล็อกตัวเองออกจากระบบ */
const ADMIN_ALWAYS_ALLOWED: readonly string[] = ['user_management'];

/** true เมื่อ role/allowedFeatures นี้เข้าถึงฟีเจอร์รหัส code ได้ */
export function canAccessFeature(
  code: string,
  role: string,
  allowedFeatures: readonly string[],
): boolean {
  if (role === 'admin' && ADMIN_ALWAYS_ALLOWED.includes(code)) {
    return true;
  }
  return allowedFeatures.includes(code);
}
