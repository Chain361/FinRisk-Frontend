export type RiskLevel = 'low' | 'medium' | 'high' | string;

/** ระดับตามกรอบ 5×5 (โอกาส × ผลกระทบ) — ภาษาไทยตามมาตรฐานราชการ */
export type RiskBand = 'ต่ำ' | 'ปานกลาง' | 'สูง' | 'สูงมาก' | string;

export interface AppUser {
  username: string;
  role: string;
  subdistrict_id?: number | null;
  display_name?: string | null;
  full_name?: string | null;
  name?: string | null;
}

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

export type AssignmentPriority = 'low' | 'normal' | 'high';
export type AssignmentStatus =
  | 'waiting_acceptance'
  | 'accepted'
  | 'in_progress'
  | 'clarification_needed'
  | 'ready_for_review'
  | 'under_review'
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
  assignee_username?: string | null;
  assignee_display_name?: string | null;
  assigned_by_username?: string | null;
  assigned_by_display_name?: string | null;
}

export interface AssignmentAssignee {
  user_id: number;
  username: string;
  display_name?: string | null;
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
  audit_steps: string;
}
