import { RoleCode } from '../auth/roles';

export type RiskLevel = 'low' | 'medium' | 'high' | string;

/** ระดับตามกรอบ 5×5 (โอกาส × ผลกระทบ) — ภาษาไทยตามมาตรฐานราชการ */
export type RiskBand = 'ต่ำ' | 'ปานกลาง' | 'สูง' | 'สูงมาก' | string;

export interface AppUser {
  user_id: number;
  username: string;
  role: string;
  subdistrict_id?: number | null;
  display_name?: string | null;
  full_name?: string | null;
  name?: string | null;
  /** สิทธิ์ฟีเจอร์ของผู้ใช้คนนี้เอง — /auth/login และ /auth/me ส่งมาให้ตรงๆ ไม่ต้องพึ่ง GET /users (admin เท่านั้น) */
  allowed_features?: string[];
}

export type UserStatus = 'active' | 'disabled';

/** ผู้ใช้ตามที่หน้าจัดการผู้ใช้งาน (admin) เห็น — มาจาก GET /users ฝั่ง backend */
export interface ManagedUser {
  user_id: number;
  /** ใช้จับคู่กับ AppUser.username ตอน login เพื่อดึงสิทธิ์ฟีเจอร์ — ไม่แสดงผลใน UI */
  username: string;
  display_name: string;
  role: RoleCode;
  subdistrict_id: number | null;
  status: UserStatus;
  /** หน้า/ฟีเจอร์ที่ผู้ใช้คนนี้เข้าถึงได้ — ค่าเริ่มต้นมาจาก role แต่ปรับเพิ่ม/ลดรายคนได้ */
  allowed_features: string[];
}

/** body ของ PUT /users/{user_id} */
export type ManagedUserPatch = Pick<
  ManagedUser,
  'display_name' | 'role' | 'subdistrict_id' | 'status' | 'allowed_features'
>;

/** body ของ POST /users — เหมือน ManagedUserPatch แต่เพิ่ม username/password (ตั้งได้แค่ตอนสร้าง) */
export type ManagedUserCreate = ManagedUserPatch & { username: string; password: string };

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AppUser;
}

export interface Subdistrict {
  subdistrict_id: number;
  name_th?: string | null;
  name_en?: string | null;
  subdistrict_name?: string | null;
  district_name?: string | null;
  province_name?: string | null;
}

export interface Project {
  project_id: number | string;
  project_name: string;
  budget_year: number;
  subdistrict_id: number;
  project_type?: string | null;
  dept_name?: string | null;
  dept_sub_name?: string | null;
  purchase_method_group?: string | null;
  purchase_method?: string | null;
  project_status?: string | null;
  status?: string | null;
  budget_amount?: number | null;
  reference_price?: number | null;
  contract_value?: number | null;
  contract_price?: number | null;
  contract_amount?: number | null;
  winning_price?: number | null;
  contract_no?: string | null;
  contract_status?: string | null;
  contract_date?: string | null;
  contract_finish_date?: string | null;
  contract_duration_days?: number | null;
  data_quality_note?: string | null;
  source_file?: string | null;
  vendor_id?: number | string | null;
  price_ratio?: number | null;
  risk_score?: number | null;
  risk_level?: RiskLevel | null;
  matrix_level?: RiskBand | null;
  factors_triggered?: number | string[] | string | null;
  vendor_name?: string | null;
  contractor_name?: string | null;
  supplier_name?: string | null;
  winner_name?: string | null;
  bidder_name?: string | null;
  [key: string]: unknown;
}

export interface ProjectRiskFactor {
  factor_code: string;
  name_th: string;
  severity?: string | null;
  impact_level?: number | null;
  legal_ref?: string | null;
  formula?: string | null;
  triggered: boolean | number;
  computable: boolean | number;
  observed_value?: number | string | null;
  threshold_used?: number | string | null;
  evidence_text?: string | null;
  likelihood?: number | null;
  impact?: number | null;
  matrix_score?: number | null;
  risk_band?: RiskBand | null;
}

export interface ProjectDetail extends Project {
  risk_factors?: ProjectRiskFactor[];
}

export interface ProjectDetailResponse {
  project: Project;
  risk_score?: {
    score_id?: number;
    run_id?: number;
    project_id?: string | number;
    risk_score?: number | null;
    risk_level?: RiskLevel | null;
    matrix_likelihood?: number | null;
    matrix_impact?: number | null;
    matrix_score?: number | null;
    matrix_level?: RiskBand | null;
    factors_triggered?: number | null;
    factors_not_computable?: number | null;
    summary_text?: string | null;
    [key: string]: unknown;
  } | null;
  risk_factors?: ProjectRiskFactor[];
  [key: string]: unknown;
}

export interface RiskFactorCatalog {
  factor_code: string;
  name_th: string;
  name_en?: string | null;
  description_th?: string | null;
  severity?: string | null;
  category?: string | null;
  threshold?: number | string | null;
  impact_level?: number | null;
  legal_ref?: string | null;
  [key: string]: unknown;
}

export interface AnnualRisk {
  factor_code: string;
  factor_name: string;
  fiscal_year: number;
  subdistrict_id?: number | null;
  legal_ref?: string | null;
  triggered: boolean | number;
  computable: boolean | number;
  risk_level?: RiskLevel | null;
  observed_value?: number | string | null;
  threshold_used?: number | string | null;
  evidence_text?: string | null;
  likelihood?: number | null;
  impact?: number | null;
  matrix_score?: number | null;
  risk_band?: RiskBand | null;
  [key: string]: unknown;
}

export interface FinancialStatement {
  fs_id?: number;
  subdistrict_id: number;
  fiscal_year: number;
  statement_type?: string | null;
  category?: string | null;
  account_item?: string | null;
  value?: number | string | null;
  detail_level?: 'line_item' | 'subtotal' | 'total' | 'indicator' | 'reference' | string | null;
  [key: string]: unknown;
}

export interface RiskSummary {
  total: number;
  by_level: Record<string, number | undefined>;
}

/** เมทาดาทาระดับระบบจาก GET /meta — วันที่ข้อมูลจริง (data-as-of) + ช่วงปีงบที่ครอบคลุม */
export interface SystemMeta {
  data_seeded_at: string | null;
  fiscal_year_min: number | null;
  fiscal_year_max: number | null;
}

export interface ProjectFilters {
  budget_year?: number | null;
  subdistrict_id?: number | null;
  risk_level?: string | null;
}

/** 1 แถวใน access log (บันทึกการเข้าถึงของผู้ใช้ — backend: GET /audit/access-log) */
export interface AccessLogEntry {
  log_id: number;
  username: string | null;
  role: string | null;
  action: string;
  method: string;
  path: string;
  resource_type?: string | null;
  resource_id?: string | null;
  status_code?: number | null;
  ip?: string | null;
  user_agent?: string | null;
  created_at: string;
}

export interface AccessLogPage {
  items: AccessLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface AccessLogFilters {
  username?: string | null;
  action?: string | null;
  resource_type?: string | null;
  date_from?: string | null;
  date_to?: string | null;
  limit?: number | null;
  offset?: number | null;
}

export interface AppNotification {
  notification_id: number;
  user_id: number;
  type: 'assignment' | 'high_risk' | string;
  message: string;
  ref_type?: 'assignment' | 'project' | string | null;
  ref_id?: string | null;
  read_at?: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: AppNotification[];
  unread_count: number;
}

export interface NotificationReadResponse {
  notification_id: number;
  read: boolean;
}

export interface NotificationReadAllResponse {
  marked_read: boolean;
}

export interface LegalRef {
  section_id: number;
  law_code: string | null;
  law: string;
  law_type: string | null;
  section_no: string;
  section_title: string | null;
  summary: string;
  reason: string | null;
}

export interface ProjectLegalFactor {
  factor_code: string;
  factor_name: string;
  description: string | null;
  severity: string | null;
  impact_level: number | null;
  weight: number | null;
  legal_ref_text: string | null;
  action_suggestion: string | null;
  applies_to_project_type: string | null;
  triggered: number | boolean;
  computable: number | boolean;
  observed_value: number | string | null;
  legal_refs: LegalRef[];
  legal_ref_note?: string | null;
}

export interface RiskEngineRunResult {
  run_id: number;
  run_at: string;
  triggered_by: string;
  project_count: number;
  annual_count: number;
}

export interface DataUploadResult {
  subdistrict_id: number;
  projects_inserted: number;
  projects_skipped_duplicate: string[];
  financial_rows_inserted: number;
}

export type AssignmentPriority = 'low' | 'normal' | 'high';
export type AssignmentStatus =
  | 'waiting_acceptance'
  | 'accepted'
  | 'in_progress'
  | 'clarification_needed'
  | 'ready_for_review'
  | 'under_review'
  | 'pending_approval'
  | 'revision_requested'
  | 'completed';

export interface AuditAssignment {
  assignment_id: number;
  project_id: string;
  assigned_to: number;
  assigned_by: number;
  priority: AssignmentPriority;
  note: string;
  due_date?: string | null;
  budget_hours?: number | null;
  audit_steps: string;
  status: AssignmentStatus;
  created_at: string;
  updated_at: string;
  project_name?: string | null;
  subdistrict_id?: number | null;
  assignee_entity_type?: string | null;
  assignee_user_label?: string | null;
  assignee_username?: string | null;
  assignee_display_name?: string | null;
  assigned_by_username?: string | null;
  assigned_by_display_name?: string | null;
}

export interface AssignmentAssignee {
  user_id: number;
  username: string;
  display_name?: string | null;
  role?: string | null;
  entity_type?: string | null;
  user_label?: string | null;
  subdistrict_id: number;
  active_cases: number;
}

export interface CreateAssignmentRequest {
  project_id: string;
  assignee_id: number;
  priority?: AssignmentPriority;
  note: string;
  due_date?: string;
  budget_hours?: number;
  audit_steps?: string;
}

export interface AssignmentStatusHistoryEntry {
  history_id: number;
  assignment_id: number;
  old_status: AssignmentStatus | null;
  new_status: AssignmentStatus;
  changed_by: number;
  changed_by_username?: string | null;
  changed_by_display_name?: string | null;
  note?: string | null;
  created_at: string;
}

export interface AssignmentDetailResponse {
  assignment: AuditAssignment;
  status_history: AssignmentStatusHistoryEntry[];
}

/** ไฟล์หลักฐาน (evidence) แนบกับ assignment — backend เก็บเป็น BYTEA ตรงๆ ใน Postgres */
export interface AssignmentAttachment {
  attachment_id: number;
  assignment_id: number;
  file_name: string;
  content_type: string;
  file_size: number;
  uploaded_by: number;
  uploaded_by_display_name?: string | null;
  created_at: string;
}

/** ข้อความในกระทู้ขอความชัดเจน (clarification thread) ระหว่าง risk_analyst กับ project_auditor */
export interface AssignmentClarification {
  clarification_id: number;
  assignment_id: number;
  message_text: string;
  created_by: number;
  created_by_display_name?: string | null;
  created_at: string;
}

export type FeedbackStatus = 'draft' | 'submitted' | 'resolved';
export type ConcernLevel = 'low' | 'medium' | 'high';

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  draft: 'แบบร่าง',
  submitted: 'ส่งแล้ว',
  resolved: 'ปิดเรื่องแล้ว',
};

export const CONCERN_LEVEL_OPTIONS: ReadonlyArray<{
  value: ConcernLevel;
  label: string;
  hint: string;
}> = [
  { value: 'low', label: 'ต่ำ', hint: 'มีข้อสังเกตเล็กน้อย ติดตามตามรอบปกติ' },
  { value: 'medium', label: 'ปานกลาง', hint: 'ควรตรวจสอบเอกสารหรือบริบทเพิ่มเติม' },
  { value: 'high', label: 'สูง', hint: 'ควรเร่งตรวจสอบและบันทึกหลักฐานประกอบ' },
];

export const LIKELIHOOD_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
  hint: string;
}> = [
  { value: 1, label: '1', hint: 'พบได้น้อยมาก' },
  { value: 2, label: '2', hint: 'พบได้น้อย' },
  { value: 3, label: '3', hint: 'มีโอกาสเกิดปานกลาง' },
  { value: 4, label: '4', hint: 'มีโอกาสเกิดสูง' },
  { value: 5, label: '5', hint: 'มีโอกาสเกิดสูงมากหรือพบสัญญาณชัดเจน' },
];

export const IMPACT_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
  hint: string;
}> = [
  { value: 1, label: '1', hint: 'ผลกระทบต่ำมาก' },
  { value: 2, label: '2', hint: 'ผลกระทบต่ำ' },
  { value: 3, label: '3', hint: 'ผลกระทบปานกลาง' },
  { value: 4, label: '4', hint: 'ผลกระทบสูง' },
  { value: 5, label: '5', hint: 'ผลกระทบสูงมาก ต้องติดตามใกล้ชิด' },
];

export interface AuditorFeedback {
  feedback_id: number;
  project_id: string;
  auditor_username: string;
  auditor_name?: string | null;
  feedback_text: string;
  concern_level?: ConcernLevel | string | null;
  likelihood_score?: number | null;
  impact_score?: number | null;
  risk_score?: number | null;
  suggestions?: string | null;
  status: FeedbackStatus | string;
  created_at: string;
  updated_at: string;
  submitted_at?: string | null;
  resolved_at?: string | null;
}

export interface AuditorFeedbackCreate {
  project_id: string;
  feedback_text: string;
  concern_level?: ConcernLevel | null;
  likelihood_score?: number | null;
  impact_score?: number | null;
  suggestions?: string | null;
  status: 'draft' | 'submitted';
}

/** ประวัติแชท — ฝั่ง client ถืออยู่ ไม่เก็บใน backend (ส่งไปทุกครั้งพร้อมข้อความใหม่) */
export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface ChatToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface ChatResponse {
  reply: string;
  tool_calls: ChatToolCall[];
}

/** ---- Document Intelligence (checklist เอกสารประกอบโครงการ + OCR findings, issue #35) ---- */

export interface DocumentType {
  doc_type_code: string;
  name_th: string;
  description: string | null;
  required_for_project_type: string | null;
  provides: string[];
}

export interface DocumentFinding {
  finding_id: number;
  doc_id: number;
  doc_type_code: string;
  doc_type_name: string;
  finding_text: string;
  risk_category: string;
  observed_value: string | null;
  expected_value: string | null;
  severity: 'low' | 'medium' | 'high';
  source: 'mock' | 'ocr' | 'llm' | 'manual';
  legal_refs: LegalRef[];
}

export type ProjectDocumentStatus = 'present' | 'missing' | 'pending_review';

export interface ProjectDocument {
  doc_id: number;
  doc_type_code: string;
  doc_type_name: string | null;
  status: ProjectDocumentStatus;
  is_required: boolean;
  doc_no: string | null;
  doc_date: string | null;
  summary_text: string | null;
  extracted: Record<string, unknown>;
  provides: string[];
  file_path: string | null;
  source: 'mock' | 'ocr' | 'manual';
  findings: DocumentFinding[];
}

export interface MissingDocType {
  doc_type_code: string;
  name_th: string;
  provides: string[];
  reason: 'no_record' | 'missing' | 'pending_review';
}

export interface ProvidesIndexEntry {
  doc_type_code: string;
  name_th: string;
  status: ProjectDocumentStatus | 'no_record';
}

export interface ProjectDocumentsView {
  project_id: string;
  project_name: string;
  project_type: string | null;
  subdistrict_id: number;
  data_quality_note: string | null;
  required_doc_types: string[];
  has_document_data: boolean;
  documents: ProjectDocument[];
  missing_doc_types: MissingDocType[];
  provides_index: Record<string, ProvidesIndexEntry[]>;
  findings_count: number;
}
