export type RiskLevel = 'low' | 'medium' | 'high' | string;

export interface AppUser {
  username: string;
  role: string;
  subdistrict_id?: number | null;
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
  purchase_method_group?: string | null;
  budget_amount?: number | null;
  reference_price?: number | null;
  contract_value?: number | null;
  price_ratio?: number | null;
  risk_score?: number | null;
  risk_level?: RiskLevel | null;
  factors_triggered?: string[] | string | null;
  vendor_name?: string | null;
  contractor_name?: string | null;
  supplier_name?: string | null;
  [key: string]: unknown;
}

export interface ProjectRiskFactor {
  factor_code: string;
  name_th: string;
  severity?: string | null;
  triggered: boolean | number;
  computable: boolean | number;
  observed_value?: number | string | null;
  threshold_used?: number | string | null;
  evidence_text?: string | null;
}

export interface ProjectDetail extends Project {
  risk_factors?: ProjectRiskFactor[];
}

export interface RiskFactorCatalog {
  factor_code: string;
  name_th: string;
  name_en?: string | null;
  description_th?: string | null;
  severity?: string | null;
  category?: string | null;
  threshold?: number | string | null;
  [key: string]: unknown;
}

export interface AnnualRisk {
  factor_code: string;
  factor_name: string;
  fiscal_year: number;
  subdistrict_id?: number | null;
  triggered: boolean | number;
  computable: boolean | number;
  risk_level?: RiskLevel | null;
  observed_value?: number | string | null;
  threshold_used?: number | string | null;
  evidence_text?: string | null;
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
