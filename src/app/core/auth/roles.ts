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

// ชื่อบทบาทสำหรับแสดงผลย้ายไป dictionary i18n แล้ว (key `role.*`) — ดู core/i18n
