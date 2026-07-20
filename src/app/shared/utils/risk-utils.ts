import { AnnualRisk, Project, RiskBand, RiskLevel, Subdistrict } from '../../core/models/domain.models';

export const FISCAL_YEARS = [2566, 2567, 2568] as const;

/** ระดับ 5×5 (โอกาส × ผลกระทบ) เรียงจากต่ำ → สูงมาก */
export const RISK_BANDS = ['ต่ำ', 'ปานกลาง', 'สูง', 'สูงมาก'] as const;

/** map matrix_score (1–25) → ระดับ ตามเกณฑ์ default (ค่านโยบายฝั่ง backend = app_config) */
export function bandFromScore(score: number | null | undefined): RiskBand | null {
  const s = toNumber(score);
  if (s === null) {
    return null;
  }
  if (s <= 5) return 'ต่ำ';
  if (s <= 11) return 'ปานกลาง';
  if (s <= 19) return 'สูง';
  return 'สูงมาก';
}

/** สีของแต่ละระดับ 5×5 — เขียว/เหลือง/ส้ม/แดง ตามมาตรฐาน risk matrix */
export function bandColor(band: RiskBand | null | undefined): string {
  switch (band) {
    case 'สูงมาก':
      return '#b91c1c';
    case 'สูง':
      return '#c2410c';
    case 'ปานกลาง':
      return '#b45309';
    case 'ต่ำ':
      return '#15803d';
    default:
      return '#64748b';
  }
}

export function bandBadgeClasses(band: RiskBand | null | undefined): string {
  switch (band) {
    case 'สูงมาก':
      return 'text-white';
    case 'สูง':
      return 'text-white';
    case 'ปานกลาง':
      return 'text-white';
    case 'ต่ำ':
      return 'text-white';
    default:
      return 'text-white';
  }
}

export const RISK_LEVELS = ['high', 'medium', 'low'] as const;

export function normalizeRiskLevel(level: RiskLevel | null | undefined): 'high' | 'medium' | 'low' | 'unknown' {
  const value = String(level ?? '').toLowerCase();
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }
  return 'unknown';
}

export function riskLabel(level: RiskLevel | null | undefined): string {
  switch (normalizeRiskLevel(level)) {
    case 'high':
      return 'เสี่ยงสูง';
    case 'medium':
      return 'เสี่ยงปานกลาง';
    case 'low':
      return 'เสี่ยงต่ำ';
    default:
      return 'ไม่ระบุ';
  }
}

export function riskColor(level: RiskLevel | null | undefined): string {
  switch (normalizeRiskLevel(level)) {
    case 'high':
      return '#b91c1c';
    case 'medium':
      return '#b45309';
    case 'low':
      return '#15803d';
    default:
      return '#64748b';
  }
}

export function riskBadgeClasses(level: RiskLevel | null | undefined): string {
  switch (normalizeRiskLevel(level)) {
    case 'high':
      return 'bg-risk-high text-white';
    case 'medium':
      return 'bg-risk-medium text-white';
    case 'low':
      return 'bg-risk-low text-white';
    default:
      return 'bg-slate-500 text-white';
  }
}

export function toBool(value: boolean | number | string | null | undefined): boolean {
  return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
}

export function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatNumber(value: number | string | null | undefined, fractionDigits = 2): string {
  const parsed = toNumber(value);
  if (parsed === null) {
    return '-';
  }
  return new Intl.NumberFormat('th-TH', {
    maximumFractionDigits: fractionDigits,
  }).format(parsed);
}

export function formatMoney(value: number | string | null | undefined): string {
  const parsed = toNumber(value);
  if (parsed === null) {
    return '-';
  }
  return new Intl.NumberFormat('th-TH', {
    notation: Math.abs(parsed) >= 1_000_000 ? 'compact' : 'standard',
    maximumFractionDigits: 2,
  }).format(parsed);
}

export function subdistrictLabel(subdistrict: Subdistrict | undefined): string {
  if (!subdistrict) {
    return 'ไม่ระบุตำบล';
  }
  return subdistrict.name_th ?? subdistrict.subdistrict_name ?? subdistrict.name_en ?? `ตำบล ${subdistrict.subdistrict_id}`;
}

export function countByRisk(projects: Project[]): Record<string, number> {
  return projects.reduce<Record<string, number>>(
    (acc, project) => {
      const key = normalizeRiskLevel(project.risk_level);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    },
    { high: 0, medium: 0, low: 0, unknown: 0 },
  );
}

export function sortProjectsByRisk(projects: Project[]): Project[] {
  const rank: Record<string, number> = { high: 3, medium: 2, low: 1, unknown: 0 };
  return [...projects].sort((a, b) => {
    const scoreDiff = (toNumber(b.risk_score) ?? -1) - (toNumber(a.risk_score) ?? -1);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return rank[normalizeRiskLevel(b.risk_level)] - rank[normalizeRiskLevel(a.risk_level)];
  });
}

export function coverageText(rows: AnnualRisk[]): string {
  const years = [...new Set(rows.map((row) => row.fiscal_year))].sort((a, b) => a - b);
  if (!years.length) {
    return 'ปีที่มีข้อมูล: -';
  }
  return `ปีที่มีข้อมูล: ${years[0]}-${years[years.length - 1]}`;
}
