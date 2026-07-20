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

export interface ProjectFilters {
  budget_year?: number | null;
  subdistrict_id?: number | null;
  risk_level?: string | null;
}
