/**
 * Role constants — mirror ของ backend (`FinRisk-Backend/src/auth.py` + `roles.md`)
 * แก้ที่นี่ต้องแก้ backend ให้ตรงกันเสมอ
 */

/** role ที่เห็นข้อมูลเฉพาะตำบลของตนเอง (backend บังคับ scope ผ่าน scope_subdistrict_ids) */
export const SCOPED_ROLES = ['local_executive', 'project_auditor', 'risk_analyst'] as const;

export type RoleCode =
  | 'admin'
  | 'regional_supervisor'
  | 'local_executive'
  | 'project_auditor'
  | 'risk_analyst'
  | 'public_user';

// ชื่อบทบาทสำหรับแสดงผล — ดู ROLE_LABELS ใน core/auth/auth.service.ts

/** role ที่เห็น/เขียนความเห็นผู้ตรวจสอบได้ — mirror ของ FEEDBACK_ROLES ใน FinRisk-Backend/src/routers/audit.py */
export const FEEDBACK_ROLES = [
  'admin',
  'regional_supervisor',
  'local_executive',
  'project_auditor',
  'risk_analyst',
] as const;

/** role ที่อนุมัติ (resolve) และจัดการความเห็นของคนอื่นได้ — mirror ของ RESOLVE_ROLES ฝั่ง backend */
export const RESOLVE_ROLES = ['admin', 'project_auditor'] as const;

/** ผู้ที่เห็นกระดิ่งแจ้งเตือนได้ — mirror ของ NOTIFICATION_ROLES ฝั่ง backend */
export const NOTIFICATION_ROLES = ['project_auditor', 'risk_analyst'] as const;

export const ROLE_LABELS: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  regional_supervisor: 'ผู้กำกับดูแลระดับภูมิภาค',
  local_executive: 'ผู้บริหารท้องถิ่น',
  project_auditor: 'ผู้ตรวจสอบโครงการ',
  risk_analyst: 'นักวิเคราะห์ความเสี่ยง',
  public_user: 'ผู้ใช้ทั่วไป',
};

/** role ที่ดู audit assignment ได้ — mirror ของ require_roles บน GET /audit/assignments (audit.py) */
export const ASSIGNMENT_ROLES = [
  'admin',
  'regional_supervisor',
  'project_auditor',
  'risk_analyst',
] as const;

/** role ที่ดาวน์โหลดชุดข้อมูลเปิดโครงการได้ — mirror EXPORT_ROLES ใน routers/public.py */
export const PUBLIC_EXPORT_ROLES = ['admin', 'regional_supervisor', 'public_user'] as const;

/** role ที่ใช้ chatbot ได้ — mirror ของ require_roles บน POST /chatbot (routers/chatbot.py) */
export const CHATBOT_ROLES = ['admin', 'project_auditor', 'risk_analyst'] as const;
