import { FinancialStatement } from '../../core/models/domain.models';
import {
  getBalanceSheetTotals,
  getCategoryTotals,
  getIncomeStatementTotals,
  getRevenueStructure,
  normalizeMetricText,
} from './financial-statement-utils';

function row(overrides: Partial<FinancialStatement>): FinancialStatement {
  return {
    subdistrict_id: 1,
    fiscal_year: 2568,
    statement_type: 'งบแสดงฐานะการเงิน',
    detail_level: 'total',
    ...overrides,
  };
}

describe('normalizeMetricText', () => {
  it('trims, lowercases, and strips whitespace/punctuation', () => {
    expect(normalizeMetricText('  Cash Coverage Ratio ')).toBe('cashcoverageratio');
  });

  it('keeps Thai characters intact', () => {
    expect(normalizeMetricText('สินทรัพย์รวม')).toBe('สินทรัพย์รวม');
  });

  it('returns an empty string for null/undefined', () => {
    expect(normalizeMetricText(null)).toBe('');
    expect(normalizeMetricText(undefined)).toBe('');
  });
});

describe('getCategoryTotals', () => {
  it('sums the "total" row per category, per subdistrict-year group', () => {
    const rows = [
      row({ category: 'สินทรัพย์รวม', value: 100, detail_level: 'total' }),
      row({ category: 'สินทรัพย์รวม', value: 999, detail_level: 'line_item' }),
    ];
    expect(getCategoryTotals(rows, ['สินทรัพย์รวม'])['สินทรัพย์รวม']).toBe(100);
  });

  it('falls back to the first "subtotal" row when no "total" row exists', () => {
    const rows = [row({ category: 'สินทรัพย์รวม', value: 55, detail_level: 'subtotal' })];
    expect(getCategoryTotals(rows, ['สินทรัพย์รวม'])['สินทรัพย์รวม']).toBe(55);
  });

  it('returns null for a category with no matching rows', () => {
    const rows = [row({ category: 'หนี้สินรวม', value: 10 })];
    expect(getCategoryTotals(rows, ['สินทรัพย์รวม'])['สินทรัพย์รวม']).toBeNull();
  });

  it('adds totals across multiple subdistrict/year groups', () => {
    const rows = [
      row({ subdistrict_id: 1, category: 'สินทรัพย์รวม', value: 100 }),
      row({ subdistrict_id: 2, category: 'สินทรัพย์รวม', value: 50 }),
    ];
    expect(getCategoryTotals(rows, ['สินทรัพย์รวม'])['สินทรัพย์รวม']).toBe(150);
  });

  it('ignores category text differences in whitespace/case via normalization', () => {
    const rows = [row({ category: ' สินทรัพย์รวม ', value: 20 })];
    expect(getCategoryTotals(rows, ['สินทรัพย์รวม'])['สินทรัพย์รวม']).toBe(20);
  });
});

describe('getBalanceSheetTotals', () => {
  it('uses the direct total rows when present', () => {
    const rows = [
      row({ category: 'สินทรัพย์รวม', value: 500 }),
      row({ category: 'หนี้สินรวม', value: 200 }),
      row({ category: 'สินทรัพย์สุทธิส่วนทุน', value: 300 }),
    ];
    const totals = getBalanceSheetTotals(rows);
    expect(totals.assets).toBe(500);
    expect(totals.liabilities).toBe(200);
    expect(totals.netAssets).toBe(300);
  });

  it('derives assets/liabilities from current+non-current when the rollup row is missing', () => {
    const rows = [
      row({ category: 'สินทรัพย์หมุนเวียน', value: 300 }),
      row({ category: 'สินทรัพย์ไม่หมุนเวียน', value: 200 }),
    ];
    const totals = getBalanceSheetTotals(rows);
    expect(totals.assets).toBe(500);
  });

  it('derives netAssets as assets minus liabilities when no direct row exists', () => {
    const rows = [
      row({ category: 'สินทรัพย์รวม', value: 500 }),
      row({ category: 'หนี้สินรวม', value: 200 }),
    ];
    expect(getBalanceSheetTotals(rows).netAssets).toBe(300);
  });

  it('returns all nulls for an empty input', () => {
    const totals = getBalanceSheetTotals([]);
    expect(totals.assets).toBeNull();
    expect(totals.liabilities).toBeNull();
    expect(totals.netAssets).toBeNull();
  });
});

describe('getIncomeStatementTotals', () => {
  it('computes netIncome as income minus expenses', () => {
    const rows = [
      row({ statement_type: 'งบแสดงผลการดำเนินงาน', category: 'รายได้รวม', value: 1000 }),
      row({ statement_type: 'งบแสดงผลการดำเนินงาน', category: 'ค่าใช้จ่ายรวม', value: 600 }),
    ];
    const totals = getIncomeStatementTotals(rows);
    expect(totals.income).toBe(1000);
    expect(totals.expenses).toBe(600);
    expect(totals.netIncome).toBe(400);
  });

  it('leaves netIncome null when either side is unknown', () => {
    const rows = [row({ category: 'รายได้รวม', value: 1000 })];
    expect(getIncomeStatementTotals(rows).netIncome).toBeNull();
  });
});

describe('getRevenueStructure', () => {
  it('splits line-item revenue into subsidies vs own+allocated revenue', () => {
    const rows = [
      row({ category: 'รายได้', account_item: 'เงินอุดหนุนทั่วไป', value: 300, detail_level: 'line_item' }),
      row({ category: 'รายได้', account_item: 'ภาษีที่จัดเก็บเอง', value: 700, detail_level: 'line_item' }),
    ];
    const structure = getRevenueStructure(rows);
    expect(structure.subsidies).toBe(300);
    expect(structure.ownAndAllocatedRevenue).toBe(700);
  });

  it('ignores non line-item rows so totals are not double-counted', () => {
    const rows = [row({ category: 'รายได้', value: 999, detail_level: 'total' })];
    const structure = getRevenueStructure(rows);
    expect(structure.ownAndAllocatedRevenue).toBe(0);
    expect(structure.subsidies).toBe(0);
  });
});
