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

/** สถานะความเห็นผู้ตรวจสอบ (F5) — draft แก้ได้, submitted แก้ไม่ได้, resolved ปิดเรื่องแล้ว */
export type FeedbackStatus = 'draft' | 'submitted' | 'resolved';

/** ระดับความกังวลที่ API รับ (DB เผื่อ 'critical' ไว้แต่ API จำกัดเฉพาะ 3 ระดับนี้) */
export type ConcernLevel = 'low' | 'medium' | 'high';

/** ความเห็นผู้ตรวจสอบ — mirror ของ AuditorFeedbackOut (FinRisk-Backend/src/schemas.py) */
export interface AuditorFeedback {
  feedback_id: number;
  project_id: string;
  auditor_username: string;
  auditor_name?: string | null;
  feedback_text: string;
  concern_level?: ConcernLevel | string | null;
  likelihood_score?: number | null;
  impact_score?: number | null;
  /** คำนวณฝั่ง backend = likelihood × impact (null ถ้าขาดค่าใดค่าหนึ่ง) */
  risk_score?: number | null;
  suggestions?: string | null;
  status: FeedbackStatus | string;
  created_at: string;
  updated_at: string;
  submitted_at?: string | null;
  resolved_at?: string | null;
}

/** payload สร้าง/แก้ไขความเห็น — mirror ของ AuditorFeedbackIn */
export interface AuditorFeedbackCreate {
  project_id: string;
  feedback_text: string;
  concern_level?: ConcernLevel | null;
  likelihood_score?: number | null;
  impact_score?: number | null;
  suggestions?: string | null;
  status: 'draft' | 'submitted';
}

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  draft: 'ฉบับร่าง',
  submitted: 'ส่งแล้ว',
  resolved: 'แก้ไขแล้ว',
};

export const CONCERN_LEVEL_OPTIONS: ReadonlyArray<{ value: ConcernLevel; label: string }> = [
  { value: 'low', label: 'ต่ำ' },
  { value: 'medium', label: 'ปานกลาง' },
  { value: 'high', label: 'สูง' },
];

export const LIKELIHOOD_OPTIONS: ReadonlyArray<{ value: number; label: string; hint: string }> = [
  { value: 1, label: '1 - ต่ำมาก', hint: 'แทบไม่มีโอกาสเกิดขึ้น' },
  { value: 2, label: '2 - ต่ำ', hint: 'มีโอกาสเกิดขึ้นน้อย' },
  { value: 3, label: '3 - ปานกลาง', hint: 'มีโอกาสเกิดขึ้นปานกลาง' },
  { value: 4, label: '4 - สูง', hint: 'มีโอกาสเกิดขึ้นค่อนข้างสูง' },
  { value: 5, label: '5 - สูงมาก', hint: 'มีโอกาสเกิดขึ้นสูงมากหรือเกิดขึ้นแล้ว' },
];

export const IMPACT_OPTIONS: ReadonlyArray<{ value: number; label: string; hint: string }> = [
  { value: 1, label: '1 - ต่ำมาก', hint: 'ผลกระทบน้อยมาก ไม่กระทบการดำเนินโครงการ' },
  { value: 2, label: '2 - ต่ำ', hint: 'ผลกระทบน้อย แก้ไขได้ในระดับปฏิบัติงาน' },
  { value: 3, label: '3 - ปานกลาง', hint: 'ผลกระทบปานกลาง อาจกระทบงบประมาณหรือระยะเวลา' },
  { value: 4, label: '4 - สูง', hint: 'ผลกระทบสูง กระทบวัตถุประสงค์ของโครงการ' },
  { value: 5, label: '5 - สูงมาก', hint: 'ผลกระทบรุนแรง อาจนำไปสู่ความเสียหายร้ายแรง' },
];
