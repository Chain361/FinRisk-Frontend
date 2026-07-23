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

/** ชื่อบทบาทภาษาไทย (ตาม seed ROLES ใน seed_database.py) */
export const ROLE_LABELS: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  regional_supervisor: 'ผู้กำกับดูแลอำเภอ/จังหวัด',
  local_executive: 'ผู้บริหารตำบล (นายก/ปลัด)',
  project_auditor: 'ผู้ตรวจสอบโครงการ',
  risk_analyst: 'นักวิเคราะห์/ตรวจสอบภายใน',
  public_user: 'ประชาชนทั่วไป',
};

/** role ที่เห็น/เขียนความเห็นผู้ตรวจสอบได้ — mirror ของ FEEDBACK_ROLES ใน FinRisk-Backend/src/routers/audit.py */
export const FEEDBACK_ROLES = [
  'admin',
  'regional_supervisor',
  'local_executive',
  'project_auditor',
  'risk_analyst',
] as const;

/** role ที่ปิดเรื่อง (resolve) และจัดการความเห็นของคนอื่นได้ — mirror ของ RESOLVE_ROLES ฝั่ง backend */
export const RESOLVE_ROLES = ['admin', 'project_auditor'] as const;
