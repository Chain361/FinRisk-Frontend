import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AnnualRisk, FinancialStatement, Subdistrict } from '../../core/models/domain.models';
import { BarChartSeries } from '../../shared/charts/bar-chart.component';
import { CompositionSegment } from '../../shared/ui/composition-bar.component';
import { PALETTE } from '../../shared/utils/design-tokens';
import { FISCAL_YEARS, formatNumber, subdistrictLabel, toBool, toNumber } from '../../shared/utils/risk-utils';
import {
  getBalanceSheetTotals,
  getIncomeStatementTotals,
  getRevenueStructure,
  getCategoryTotals,
  normalizeMetricText,
} from './financial-statement-utils';

interface FactorOption {
  code: string;
  name: string;
}

export type ComparisonMetric = 'netAssets' | 'netIncome' | 'riskFactor';

interface ComparisonDatum {
  name: string;
  value: number | null;
}

/**
 * State ที่ใช้ร่วมกันระหว่างหน้า Overview / Risk Indicators / Benchmarking / Investment Trends
 * (โมดูล Financial Health) เดิมแต่ละหน้าก็อปโค้ดคำนวณชุดนี้แยกกัน — รวมไว้ที่เดียวเพื่อไม่ให้
 * ตรรกะเพี้ยนไปคนละทางเวลามีคนแก้ไฟล์ใดไฟล์หนึ่ง และให้ตัวกรองที่เลือกในหน้าหนึ่งตรงกับอีกหน้าเสมอ
 */
@Injectable({ providedIn: 'root' })
export class FinancialHealthStateService {
  private readonly api = inject(ApiService);
  private initialized = false;

  readonly FISCAL_YEARS = FISCAL_YEARS;
  readonly fiscalYearLabels = FISCAL_YEARS.map(String);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly annualRisks = signal<AnnualRisk[]>([]);
  readonly financialStatements = signal<FinancialStatement[]>([]);

  readonly selectedSubdistrictId = signal<number | null>(null);
  readonly selectedYear = signal<number | null>(2568);

  readonly comparisonMetric = signal<ComparisonMetric>('netAssets');
  readonly comparisonFactorCode = signal<string | null>(null);

  readonly scopedRows = computed(() => {
    const subdistrictId = this.selectedSubdistrictId();
    return this.annualRisks().filter((row) => !subdistrictId || row.subdistrict_id === subdistrictId);
  });

  readonly factorCards = computed(() => {
    const year = this.selectedYear();
    return this.scopedRows()
      .filter((row) => !year || row.fiscal_year === year)
      .sort((a, b) => a.factor_code.localeCompare(b.factor_code, 'th'));
  });

  readonly scopedFinancialStatements = computed(() => {
    const subdistrictId = this.selectedSubdistrictId();
    const year = this.selectedYear();
    return this.financialStatements().filter(
      (row) =>
        (!subdistrictId || row.subdistrict_id === subdistrictId) && (!year || row.fiscal_year === year),
    );
  });

  readonly balanceSheet = computed(() =>
    getBalanceSheetTotals(
      this.scopedFinancialStatements().filter(
        (row) => normalizeMetricText(row.statement_type) === 'งบแสดงฐานะการเงิน',
      ),
    ),
  );

  readonly incomeStatement = computed(() =>
    getIncomeStatementTotals(
      this.scopedFinancialStatements().filter(
        (row) => normalizeMetricText(row.statement_type) === 'งบแสดงผลการดำเนินงาน',
      ),
    ),
  );

  readonly balanceSheetKpis = computed(() => {
    const { assets, liabilities, netAssets } = this.balanceSheet();
    return [
      {
        label: 'สินทรัพย์รวม',
        value: assets === null ? '-' : this.number(assets),
        hint: 'รวมจากงบแสดงฐานะการเงินของตำบลที่เลือก',
        accentClass: 'bg-navy',
      },
      {
        label: 'หนี้สินรวม',
        value: liabilities === null ? '-' : this.number(liabilities),
        hint: 'รวมจากงบแสดงฐานะการเงินของตำบลที่เลือก',
        accentClass: 'bg-risk-medium',
      },
      {
        label: 'ส่วนทุน/สินทรัพย์สุทธิ',
        value: netAssets === null ? '-' : this.number(netAssets),
        hint: 'ยอดสินทรัพย์สุทธิ/ส่วนทุนจากงบการเงิน',
        accentClass: 'bg-risk-low',
      },
    ];
  });

  readonly assetComposition = computed<CompositionSegment[]>(() => {
    const { currentAssets, nonCurrentAssets } = this.balanceSheet();
    return [
      { label: 'สินทรัพย์หมุนเวียน', value: currentAssets, color: PALETTE.navy },
      { label: 'สินทรัพย์ไม่หมุนเวียน', value: nonCurrentAssets, color: PALETTE.chartBlue },
    ];
  });

  readonly liabilityComposition = computed<CompositionSegment[]>(() => {
    const { currentLiabilities, nonCurrentLiabilities } = this.balanceSheet();
    return [
      { label: 'หนี้สินหมุนเวียน', value: currentLiabilities, color: PALETTE.chartRed },
      { label: 'หนี้สินระยะยาว', value: nonCurrentLiabilities, color: PALETTE.chartOrange },
    ];
  });

  readonly incomeStatementKpis = computed(() => {
    const { income, expenses, netIncome } = this.incomeStatement();
    return [
      {
        label: 'รายได้รวม',
        value: income === null ? '-' : this.number(income),
        hint: 'ยอดรวมจากงบแสดงผลการดำเนินงานของตำบลที่เลือก',
        accentClass: 'bg-chart-blue-deep',
      },
      {
        label: 'ค่าใช้จ่ายรวม',
        value: expenses === null ? '-' : this.number(expenses),
        hint: 'ยอดรวมจากงบแสดงผลการดำเนินงานของตำบลที่เลือก',
        accentClass: 'bg-chart-red',
      },
      {
        label: 'ผลสุทธิ (รายได้ − ค่าใช้จ่าย)',
        value: netIncome === null ? '-' : this.number(netIncome),
        hint:
          netIncome === null
            ? 'ไม่พบข้อมูลรายได้หรือค่าใช้จ่ายรวม'
            : netIncome >= 0
              ? 'รายได้สูงกว่าค่าใช้จ่าย'
              : 'ค่าใช้จ่ายสูงกว่ารายได้',
        accentClass: 'bg-navy',
      },
    ];
  });

  readonly revenueStructureCategories = computed(() => [
    this.selectedYear() ? `ปี ${this.selectedYear()}` : 'ทุกปีที่เลือก',
  ]);

  readonly revenueStructureSeries = computed<BarChartSeries[]>(() => {
    const { ownAndAllocatedRevenue, subsidies } = getRevenueStructure(
      this.scopedFinancialStatements().filter(
        (row) => normalizeMetricText(row.statement_type) === 'งบแสดงผลการดำเนินงาน',
      ),
    );
    return [
      { name: 'รายได้จัดเก็บเอง + รัฐจัดสรร', values: [ownAndAllocatedRevenue], color: PALETTE.navy },
      { name: 'เงินอุดหนุน', values: [subsidies], color: PALETTE.chartBlue },
    ];
  });

  readonly subdistrictFinancialStatements = computed(() => {
    const subdistrictId = this.selectedSubdistrictId();
    return this.financialStatements().filter((row) => !subdistrictId || row.subdistrict_id === subdistrictId);
  });

  readonly fixedAssetTotals = computed(() => {
    const rows = this.subdistrictFinancialStatements().filter(
      (row) => normalizeMetricText(row.statement_type) === 'งบแสดงฐานะการเงิน',
    );
    return FISCAL_YEARS.map((year) => ({
      year,
      value: getCategoryTotals(
        rows.filter((row) => row.fiscal_year === year),
        ['สินทรัพย์ไม่หมุนเวียน'],
      )['สินทรัพย์ไม่หมุนเวียน'],
    }));
  });

  readonly fixedAssetBarSeries = computed<BarChartSeries[]>(() => [
    {
      name: 'มูลค่าสินทรัพย์ถาวร',
      color: PALETTE.navy,
      values: this.fixedAssetTotals().map((item) => item.value),
    },
  ]);

  readonly fixedAssetComputableYears = computed(
    () => this.fixedAssetTotals().filter((item) => item.value !== null) as { year: number; value: number }[],
  );

  readonly fixedAssetFocusYear = computed(() => {
    const year = this.selectedYear();
    if (year) {
      return year;
    }
    const computable = this.fixedAssetComputableYears();
    return computable.length ? computable[computable.length - 1].year : FISCAL_YEARS[FISCAL_YEARS.length - 1];
  });

  readonly fixedAssetPreviousYear = computed(() => this.fixedAssetFocusYear() - 1);

  readonly fixedAssetFocusValue = computed(
    () => this.fixedAssetTotals().find((item) => item.year === this.fixedAssetFocusYear())?.value ?? null,
  );

  readonly fixedAssetPreviousValue = computed(
    () => this.fixedAssetTotals().find((item) => item.year === this.fixedAssetPreviousYear())?.value ?? null,
  );

  readonly fixedAssetFocusValueText = computed(() => {
    const value = this.fixedAssetFocusValue();
    return value === null ? '-' : `${this.number(value)} บาท`;
  });

  readonly fixedAssetYoy = computed(() => {
    const current = this.fixedAssetFocusValue();
    const previous = this.fixedAssetPreviousValue();
    if (current === null || previous === null || previous === 0) {
      return null;
    }
    return ((current - previous) / previous) * 100;
  });

  readonly fixedAssetYoyView = computed(() => {
    const yoy = this.fixedAssetYoy();
    if (yoy === null) {
      return null;
    }
    return {
      arrow: yoy > 0 ? '▲' : yoy < 0 ? '▼' : '─',
      magnitude: this.number(Math.abs(yoy)),
      colorClass: yoy > 0 ? 'text-risk-low' : yoy < 0 ? 'text-risk-high' : 'text-slate-700',
    };
  });

  readonly fixedAssetInsight = computed(() => {
    const yoy = this.fixedAssetYoy();
    if (yoy === null) {
      return 'ไม่มีข้อมูลเพียงพอสำหรับคำนวณ YoY';
    }
    const direction = yoy > 0 ? 'เพิ่มขึ้น' : yoy < 0 ? 'ลดลง' : 'ไม่เปลี่ยนแปลง';
    return `YoY ${this.fixedAssetPreviousYear()} → ${this.fixedAssetFocusYear()}: ${direction} ${this.number(Math.abs(yoy))}%`;
  });

  readonly allFactorOptions = computed<FactorOption[]>(() => {
    const map = new Map<string, string>();
    this.annualRisks().forEach((row) => map.set(row.factor_code, row.factor_name));
    return [...map.entries()].map(([code, name]) => ({ code, name }));
  });

  readonly comparisonData = computed<ComparisonDatum[]>(() => {
    const metric = this.comparisonMetric();
    const year = this.selectedYear();
    const factorCode = this.comparisonFactorCode();

    return this.subdistricts()
      .map((subdistrict) => ({
        name: subdistrictLabel(subdistrict),
        value: this.comparisonValue(subdistrict.subdistrict_id, metric, year, factorCode),
      }))
      .filter((item) => item.value !== null || metric === 'riskFactor');
  });

  readonly comparisonCategories = computed(() => this.comparisonData().map((item) => item.name));

  readonly comparisonBarSeries = computed<BarChartSeries[]>(() => [
    {
      name: this.comparisonMetricLabel(),
      color: PALETTE.navy,
      values: this.comparisonData().map((item) => item.value),
    },
  ]);

  readonly comparisonUnit = computed(() => {
    if (this.comparisonMetric() !== 'riskFactor') {
      return 'บาท';
    }
    const option = this.allFactorOptions().find((item) => item.code === this.comparisonFactorCode());
    return option
      ? this.observedValueUnit({ factor_code: option.code, factor_name: option.name } as AnnualRisk)
      : '';
  });

  /** โหลดข้อมูลครั้งแรกที่มีหน้าใดในโมดูล Financial Health ถูกเปิด — หน้าถัดไปใช้ข้อมูลชุดเดียวกันต่อ ไม่ยิงซ้ำ */
  initialize(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;
    this.loading.set(true);
    forkJoin({
      subdistricts: this.api.subdistricts(),
      annualRisks: this.api.annualRisk(),
      // `/financials` is optional while older backends are being upgraded.
      // Its absence must not block the existing annual-risk view.
      financialStatements: this.api.financialStatements().pipe(catchError(() => of<FinancialStatement[]>([]))),
    }).subscribe({
      next: ({ subdistricts, annualRisks, financialStatements }) => {
        this.subdistricts.set(subdistricts);
        this.annualRisks.set(annualRisks);
        this.financialStatements.set(financialStatements);
        this.comparisonFactorCode.set(this.allFactorOptions()[0]?.code ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('โหลดข้อมูล Financial Health ไม่สำเร็จ');
        this.loading.set(false);
      },
    });
  }

  setSubdistrict(value: number | null): void {
    this.selectedSubdistrictId.set(value);
  }

  setYear(value: number | null): void {
    this.selectedYear.set(value);
  }

  setComparisonMetric(value: ComparisonMetric): void {
    this.comparisonMetric.set(value);
    if (value === 'riskFactor' && !this.comparisonFactorCode()) {
      this.comparisonFactorCode.set(this.allFactorOptions()[0]?.code ?? null);
    }
  }

  setComparisonFactorCode(value: string): void {
    this.comparisonFactorCode.set(value || null);
  }

  resetFilters(): void {
    this.selectedSubdistrictId.set(null);
    this.selectedYear.set(2568);
    this.comparisonMetric.set('netAssets');
    this.comparisonFactorCode.set(this.allFactorOptions()[0]?.code ?? null);
  }

  isComputable(row: AnnualRisk): boolean {
    return toBool(row.computable);
  }

  observedValueText(row: AnnualRisk): string {
    const unit = this.observedValueUnit(row);
    const value = this.number(row.observed_value);
    return unit ? `${value} ${unit}` : value;
  }

  comparisonMetricLabel(): string {
    switch (this.comparisonMetric()) {
      case 'netAssets':
        return 'สินทรัพย์สุทธิ';
      case 'netIncome':
        return 'ผลสุทธิ';
      case 'riskFactor': {
        const option = this.allFactorOptions().find((item) => item.code === this.comparisonFactorCode());
        return option ? `${option.code} - ${option.name}` : 'Risk Factor';
      }
    }
  }

  observedValueUnit(row: AnnualRisk): string {
    const name = (row.factor_name ?? '').trim().toLowerCase();
    const code = (row.factor_code ?? '').trim().toLowerCase();

    if (
      name.includes('อัตราการพึ่งพาตนเองทางการคลัง') ||
      name.includes('ดุลการดำเนินงานประจำปี') ||
      name.includes('self-reliance') ||
      name.includes('operating balance')
    ) {
      return '%';
    }

    if (
      name.includes('cash coverage ratio') ||
      (code.includes('cash') && code.includes('coverage')) ||
      code.includes('ccr')
    ) {
      return 'เท่า';
    }

    return '';
  }

  number(value: number | string | null | undefined): string {
    return formatNumber(value, 3);
  }

  private comparisonValue(
    subdistrictId: number,
    metric: ComparisonMetric,
    year: number | null,
    factorCode: string | null,
  ): number | null {
    if (metric === 'riskFactor') {
      if (!factorCode) {
        return null;
      }
      const row = this.annualRisks().find(
        (candidate) =>
          candidate.subdistrict_id === subdistrictId &&
          candidate.factor_code === factorCode &&
          (!year || candidate.fiscal_year === year),
      );
      return row && toBool(row.computable) ? toNumber(row.observed_value) : null;
    }

    const statementType = metric === 'netAssets' ? 'งบแสดงฐานะการเงิน' : 'งบแสดงผลการดำเนินงาน';
    const rows = this.financialStatements().filter(
      (row) =>
        row.subdistrict_id === subdistrictId &&
        (!year || row.fiscal_year === year) &&
        normalizeMetricText(row.statement_type) === statementType,
    );

    return metric === 'netAssets'
      ? getBalanceSheetTotals(rows).netAssets
      : getIncomeStatementTotals(rows).netIncome;
  }
}
