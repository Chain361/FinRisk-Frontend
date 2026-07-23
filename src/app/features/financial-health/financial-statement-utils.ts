import { FinancialStatement } from '../../core/models/domain.models';
import { toNumber } from '../../shared/utils/risk-utils';

export interface BalanceSheetTotals {
  assets: number | null;
  liabilities: number | null;
  netAssets: number | null;
  currentAssets: number | null;
  nonCurrentAssets: number | null;
  currentLiabilities: number | null;
  nonCurrentLiabilities: number | null;
}

export interface IncomeStatementTotals {
  income: number | null;
  expenses: number | null;
  netIncome: number | null;
}

export interface RevenueStructure {
  ownAndAllocatedRevenue: number;
  subsidies: number;
}

/** ตัด whitespace/สัญลักษณ์ทิ้ง เหลือเฉพาะ a-z0-9ก-๙ เพื่อเทียบข้อความหมวดหมู่แบบไม่สนช่องว่าง/ตัวพิมพ์ */
export function normalizeMetricText(value: string | null | undefined): string {
  return (value ?? '')
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9ก-๙]/g, '');
}

export function sumValues(first: number | null, second: number | null): number | null {
  return first !== null && second !== null ? first + second : null;
}

export function subtractValues(first: number | null, second: number | null): number | null {
  return first !== null && second !== null ? first - second : null;
}

/**
 * รวมยอดตาม category ต่อกลุ่ม (subdistrict_id-fiscal_year) โดยเลือกแถว detail_level='total'
 * ก่อน แล้วค่อย fallback ไป 'subtotal' ตัวแรกที่เจอ
 */
export function getCategoryTotals(
  rows: FinancialStatement[],
  categories: string[],
): Record<string, number | null> {
  const groupedRows = new Map<string, FinancialStatement[]>();
  rows.forEach((row) => {
    const key = `${row.subdistrict_id}-${row.fiscal_year}`;
    const group = groupedRows.get(key) ?? [];
    group.push(row);
    groupedRows.set(key, group);
  });

  const totals = Object.fromEntries(categories.map((category) => [category, 0])) as Record<
    string,
    number
  >;
  const found = Object.fromEntries(categories.map((category) => [category, false])) as Record<
    string,
    boolean
  >;
  groupedRows.forEach((group) => {
    categories.forEach((category) => {
      const matchingRows = group.filter(
        (row) =>
          normalizeMetricText(row.category) === category &&
          ['total', 'subtotal'].includes(row.detail_level ?? ''),
      );
      const row = matchingRows.find((item) => item.detail_level === 'total') ?? matchingRows[0];
      const value = row ? toNumber(row.value) : null;
      if (value !== null) {
        totals[category] += value;
        found[category] = true;
      }
    });
  });
  return Object.fromEntries(
    categories.map((category) => [category, found[category] ? totals[category] : null]),
  );
}

export function getBalanceSheetTotals(rows: FinancialStatement[]): BalanceSheetTotals {
  const totals = getCategoryTotals(rows, [
    'สินทรัพย์รวม',
    'หนี้สินรวม',
    'สินทรัพย์สุทธิส่วนทุน',
    'สินทรัพย์หมุนเวียน',
    'สินทรัพย์ไม่หมุนเวียน',
    'หนี้สินหมุนเวียน',
    'หนี้สินไม่หมุนเวียน',
  ]);
  const assets =
    totals['สินทรัพย์รวม'] ?? sumValues(totals['สินทรัพย์หมุนเวียน'], totals['สินทรัพย์ไม่หมุนเวียน']);
  const liabilities =
    totals['หนี้สินรวม'] ?? sumValues(totals['หนี้สินหมุนเวียน'], totals['หนี้สินไม่หมุนเวียน']);
  return {
    assets,
    liabilities,
    netAssets: totals['สินทรัพย์สุทธิส่วนทุน'] ?? subtractValues(assets, liabilities),
    currentAssets: totals['สินทรัพย์หมุนเวียน'],
    nonCurrentAssets: totals['สินทรัพย์ไม่หมุนเวียน'],
    currentLiabilities: totals['หนี้สินหมุนเวียน'],
    nonCurrentLiabilities: totals['หนี้สินไม่หมุนเวียน'],
  };
}

export function getIncomeStatementTotals(rows: FinancialStatement[]): IncomeStatementTotals {
  const totals = getCategoryTotals(rows, ['รายได้รวม', 'ค่าใช้จ่ายรวม']);
  const income = totals['รายได้รวม'];
  const expenses = totals['ค่าใช้จ่ายรวม'];
  return { income, expenses, netIncome: subtractValues(income, expenses) };
}

export function getRevenueStructure(rows: FinancialStatement[]): RevenueStructure {
  return rows
    .filter(
      (row) => normalizeMetricText(row.category) === 'รายได้' && row.detail_level === 'line_item',
    )
    .reduce(
      (totals, row) => {
        const value = toNumber(row.value) ?? 0;
        if (normalizeMetricText(row.account_item).includes('อุดหนุน')) {
          totals.subsidies += value;
        } else {
          totals.ownAndAllocatedRevenue += value;
        }
        return totals;
      },
      { ownAndAllocatedRevenue: 0, subsidies: 0 },
    );
}
