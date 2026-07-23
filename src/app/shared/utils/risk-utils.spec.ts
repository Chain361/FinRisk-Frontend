import { Project } from '../../core/models/domain.models';
import {
  bandColor,
  bandFromScore,
  coverageText,
  countByRisk,
  formatMoney,
  formatNumber,
  matrixChip,
  normalizeRiskLevel,
  riskColor,
  riskLabel,
  sortProjectsByRisk,
  subdistrictLabel,
  toBool,
  toNumber,
} from './risk-utils';

describe('toNumber', () => {
  it('parses numeric strings', () => {
    expect(toNumber('1234.5')).toBe(1234.5);
  });

  it('passes through numbers unchanged', () => {
    expect(toNumber(42)).toBe(42);
  });

  it('returns null for null, undefined, and empty string', () => {
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
    expect(toNumber('')).toBeNull();
  });

  it('returns null for non-numeric strings', () => {
    expect(toNumber('abc')).toBeNull();
  });

  it('treats the string "0" as the number 0, not null', () => {
    expect(toNumber('0')).toBe(0);
  });
});

describe('toBool', () => {
  it('treats true, 1, "1", and "true" as truthy', () => {
    expect(toBool(true)).toBe(true);
    expect(toBool(1)).toBe(true);
    expect(toBool('1')).toBe(true);
    expect(toBool('true')).toBe(true);
    expect(toBool('TRUE')).toBe(true);
  });

  it('treats false, 0, "0", null, and undefined as falsy', () => {
    expect(toBool(false)).toBe(false);
    expect(toBool(0)).toBe(false);
    expect(toBool('0')).toBe(false);
    expect(toBool(null)).toBe(false);
    expect(toBool(undefined)).toBe(false);
  });
});

describe('formatNumber', () => {
  it('formats with the default 2 fraction digits', () => {
    expect(formatNumber(1234.5)).toBe('1,234.5');
  });

  it('respects a custom fraction digit count', () => {
    expect(formatNumber(1.23456, 3)).toBe('1.235');
  });

  it('returns "-" when the value cannot be parsed', () => {
    expect(formatNumber(null)).toBe('-');
    expect(formatNumber('abc')).toBe('-');
  });
});

describe('formatMoney', () => {
  it('formats sub-million values without compact notation', () => {
    expect(formatMoney(1234)).toBe('1,234');
  });

  it('switches to compact notation at 1,000,000 and above', () => {
    expect(formatMoney(1_500_000)).toBe('1.5M');
  });

  it('returns "-" when the value cannot be parsed', () => {
    expect(formatMoney(undefined)).toBe('-');
  });
});

describe('bandFromScore', () => {
  it('maps the boundary scores to the correct band', () => {
    expect(bandFromScore(5)).toBe('ต่ำ');
    expect(bandFromScore(6)).toBe('ปานกลาง');
    expect(bandFromScore(11)).toBe('ปานกลาง');
    expect(bandFromScore(12)).toBe('สูง');
    expect(bandFromScore(19)).toBe('สูง');
    expect(bandFromScore(20)).toBe('สูงมาก');
    expect(bandFromScore(25)).toBe('สูงมาก');
  });

  it('returns null when the score cannot be parsed', () => {
    expect(bandFromScore(null)).toBeNull();
    expect(bandFromScore(undefined)).toBeNull();
  });
});

describe('bandColor', () => {
  it('returns a distinct color per band', () => {
    expect(bandColor('สูงมาก')).toBe('#b91c1c');
    expect(bandColor('สูง')).toBe('#c2410c');
    expect(bandColor('ปานกลาง')).toBe('#b45309');
    expect(bandColor('ต่ำ')).toBe('#15803d');
  });

  it('falls back to the neutral color for unknown bands', () => {
    expect(bandColor(null)).toBe('#64748b');
    expect(bandColor(undefined)).toBe('#64748b');
  });
});

describe('normalizeRiskLevel', () => {
  it('lowercases known levels', () => {
    expect(normalizeRiskLevel('HIGH')).toBe('high');
    expect(normalizeRiskLevel('Medium')).toBe('medium');
    expect(normalizeRiskLevel('low')).toBe('low');
  });

  it('falls back to "unknown" for anything else', () => {
    expect(normalizeRiskLevel(null)).toBe('unknown');
    expect(normalizeRiskLevel(undefined)).toBe('unknown');
    expect(normalizeRiskLevel('critical')).toBe('unknown');
  });
});

describe('riskLabel / riskColor', () => {
  it('labels each normalized level in Thai', () => {
    expect(riskLabel('high')).toBe('เสี่ยงสูง');
    expect(riskLabel('medium')).toBe('เสี่ยงปานกลาง');
    expect(riskLabel('low')).toBe('เสี่ยงต่ำ');
    expect(riskLabel('bogus')).toBe('ไม่ระบุ');
  });

  it('colors each normalized level', () => {
    expect(riskColor('high')).toBe('#b91c1c');
    expect(riskColor('medium')).toBe('#b45309');
    expect(riskColor('low')).toBe('#15803d');
    expect(riskColor(null)).toBe('#64748b');
  });
});

describe('subdistrictLabel', () => {
  it('prefers name_th, then subdistrict_name, then name_en', () => {
    expect(subdistrictLabel({ subdistrict_id: 1, name_th: 'ตำบล A' } as any)).toBe('ตำบล A');
    expect(
      subdistrictLabel({ subdistrict_id: 1, subdistrict_name: 'B' } as any),
    ).toBe('B');
    expect(subdistrictLabel({ subdistrict_id: 1, name_en: 'C' } as any)).toBe('C');
  });

  it('falls back to a generated label when nothing is set', () => {
    expect(subdistrictLabel({ subdistrict_id: 7 } as any)).toBe('ตำบล 7');
  });

  it('returns a placeholder for an undefined subdistrict', () => {
    expect(subdistrictLabel(undefined)).toBe('ไม่ระบุตำบล');
  });
});

describe('countByRisk', () => {
  it('buckets projects by normalized risk level, defaulting unseen buckets to 0', () => {
    const projects = [
      { risk_level: 'high' },
      { risk_level: 'high' },
      { risk_level: 'low' },
      { risk_level: 'weird' },
    ] as Project[];

    expect(countByRisk(projects)).toEqual({ high: 2, medium: 0, low: 1, unknown: 1 });
  });

  it('returns all-zero counts for an empty list', () => {
    expect(countByRisk([])).toEqual({ high: 0, medium: 0, low: 0, unknown: 0 });
  });
});

describe('sortProjectsByRisk', () => {
  it('sorts by risk_score descending', () => {
    const projects = [
      { project_id: 1, risk_score: 10 },
      { project_id: 2, risk_score: 90 },
      { project_id: 3, risk_score: 50 },
    ] as Project[];

    expect(sortProjectsByRisk(projects).map((p) => p.project_id)).toEqual([2, 3, 1]);
  });

  it('breaks ties on risk_score using risk_level rank when scores are missing', () => {
    const projects = [
      { project_id: 'a', risk_level: 'low' },
      { project_id: 'b', risk_level: 'high' },
      { project_id: 'c', risk_level: 'medium' },
    ] as Project[];

    expect(sortProjectsByRisk(projects).map((p) => p.project_id)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate the input array', () => {
    const projects = [{ project_id: 1, risk_score: 1 }, { project_id: 2, risk_score: 2 }] as Project[];
    const original = [...projects];
    sortProjectsByRisk(projects);
    expect(projects).toEqual(original);
  });
});

describe('matrixChip', () => {
  it('formats the likelihood x impact = score label', () => {
    expect(matrixChip({ likelihood: 4, impact: 5, matrix_score: 20 })).toBe('โอกาส 4 × ผลกระทบ 5 = 20');
  });

  it('returns "-" when any component is missing', () => {
    expect(matrixChip({ likelihood: null, impact: 5, matrix_score: 20 })).toBe('-');
    expect(matrixChip({ likelihood: 4, impact: undefined, matrix_score: 20 })).toBe('-');
    expect(matrixChip({})).toBe('-');
  });
});

describe('coverageText', () => {
  it('reports the min-max fiscal year range', () => {
    const rows = [{ fiscal_year: 2568 }, { fiscal_year: 2566 }, { fiscal_year: 2567 }] as any[];
    expect(coverageText(rows)).toBe('ปีที่มีข้อมูล: 2566-2568');
  });

  it('returns a placeholder when there are no rows', () => {
    expect(coverageText([])).toBe('ปีที่มีข้อมูล: -');
  });
});
