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
