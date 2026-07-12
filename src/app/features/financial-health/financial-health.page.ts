import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AnnualRisk, FinancialStatement, Subdistrict } from '../../core/models/domain.models';
import { DonutChartComponent } from '../../shared/charts/donut-chart.component';
import {
  StackedBarChartComponent,
  StackedBarSeries,
} from '../../shared/charts/stacked-bar-chart.component';
import {
  TimeSeries,
  TimeSeriesChartComponent,
} from '../../shared/charts/time-series-chart.component';
import { FilterBarComponent } from '../../shared/filters/filter-bar.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { KpiCardComponent } from '../../shared/ui/kpi-card.component';
import {
  coverageText,
  FISCAL_YEARS,
  formatNumber,
  toBool,
  toNumber,
} from '../../shared/utils/risk-utils';

interface FactorOption {
  code: string;
  name: string;
}

interface BalanceSheetTotals {
  assets: number | null;
  liabilities: number | null;
  netAssets: number | null;
  currentAssets: number | null;
  nonCurrentAssets: number | null;
  currentLiabilities: number | null;
  nonCurrentLiabilities: number | null;
}

interface IncomeStatementTotals {
  income: number | null;
  expenses: number | null;
  netIncome: number | null;
}

@Component({
  selector: 'app-financial-health-page',
  standalone: true,
  imports: [
    DonutChartComponent,
    EmptyStateComponent,
    FilterBarComponent,
    KpiCardComponent,
    StackedBarChartComponent,
    TimeSeriesChartComponent,
  ],
  template: `
    <section class="page-shell">
      <div>
        <p class="text-sm font-semibold text-slate-500">F2</p>
        <h1 class="text-2xl font-semibold text-slate-950">Annual Financial Health</h1>
        <p class="mt-1 text-sm text-slate-500">
          ใช้ /risk/annual เพื่อดู risk level, observed value และ evidence ต่อ factor รายปี
        </p>
      </div>

      <app-filter-bar
        [subdistricts]="subdistricts()"
        [selectedSubdistrictId]="selectedSubdistrictId()"
        [selectedYear]="selectedYear()"
        [showRiskFilter]="false"
        (selectedSubdistrictIdChange)="setSubdistrict($event)"
        (selectedYearChange)="setYear($event)"
        (reset)="resetFilters()"
      />

      <div class="grid gap-4 md:grid-cols-3">
        @for (card of balanceSheetKpis(); track card.label) {
          <app-kpi-card
            [label]="card.label"
            [value]="card.value"
            [hint]="card.hint"
            [accentClass]="card.accentClass"
          />
        }
      </div>

      <div class="grid gap-4 xl:grid-cols-2">
        <section class="panel p-4">
          <div class="mb-3">
            <h2 class="text-base font-semibold">สินทรัพย์รวม</h2>
            <p class="text-sm text-slate-500">แบ่งเป็นสินทรัพย์หมุนเวียนและไม่หมุนเวียน</p>
          </div>
          <app-donut-chart [segments]="assetComposition()" />
        </section>

        <section class="panel p-4">
          <div class="mb-3">
            <h2 class="text-base font-semibold">หนี้สินรวม</h2>
            <p class="text-sm text-slate-500">แบ่งเป็นหนี้สินหมุนเวียนและระยะยาว</p>
          </div>
          <app-donut-chart [segments]="liabilityComposition()" />
        </section>
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        @for (card of incomeStatementKpis(); track card.label) {
          <app-kpi-card
            [label]="card.label"
            [value]="card.value"
            [hint]="card.hint"
            [accentClass]="card.accentClass"
          />
        }
      </div>

      <section class="panel p-4">
        <div class="mb-3">
          <h2 class="text-base font-semibold">โครงสร้างรายได้</h2>
          <p class="text-sm text-slate-500">
            เปรียบเทียบรายได้จัดเก็บเองและรัฐจัดสรร กับเงินอุดหนุนของตำบลที่เลือก
          </p>
        </div>
        <app-stacked-bar-chart
          [categories]="revenueStructureCategories()"
          [series]="revenueStructureSeries()"
          yAxisName="บาท"
        />
      </section>

      @if (error()) {
        <p class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {{ error() }}
        </p>
      }

      <div class="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section class="panel p-4">
          <div class="mb-3">
            <h2 class="text-base font-semibold">สถานะปี {{ selectedYear() ?? 'ทุกปี' }}</h2>
            <p class="text-sm text-slate-500">
              computable=0 แสดงเป็นประเมินไม่ได้ และไม่แทนค่าเป็น 0
            </p>
          </div>

          @if (!factorCards().length) {
            <app-empty-state
              title="ไม่พบข้อมูล Financial Health"
              message="ข้อมูล /risk/annual อาจยังไม่มีสำหรับตัวกรองนี้"
            />
          } @else {
            <div class="grid gap-3">
              @for (
                row of factorCards();
                track row.factor_code + '-' + row.fiscal_year + '-' + row.subdistrict_id
              ) {
                <article class="rounded-lg border border-slate-200 p-4">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p class="text-sm font-semibold text-slate-950">{{ row.factor_name }}</p>
                      <p class="text-xs text-slate-500">
                        {{ row.factor_code }} · ปี {{ row.fiscal_year }}
                      </p>
                    </div>
                  </div>

                  <div class="mt-4">
                    <div class="rounded-md bg-slate-50 p-3">
                      <p class="text-xs font-semibold text-slate-500">Observed Value</p>
                      <p class="mt-1 text-lg font-semibold text-slate-900">
                        {{
                          isComputable(row) ? observedValueText(row) : 'ประเมินไม่ได้ (ข้อมูลไม่พอ)'
                        }}
                      </p>
                    </div>
                  </div>

                  @if (row.evidence_text) {
                    <p class="mt-3 text-sm leading-6 text-slate-600">{{ row.evidence_text }}</p>
                  }
                </article>
              }
            </div>
          }
        </section>

        <section class="panel p-4">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold">ทุก Risk Factor - Time Series</h2>
              <p class="text-sm text-slate-500">กราฟเว้น gap เมื่อปีนั้น computable=0</p>
            </div>
            <span
              class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
            >
              Factors: {{ factorOptions().length }}
            </span>
          </div>

          <app-time-series-chart [series]="allFactorsSeries()" yAxisName="Observed value" />

          <div class="mt-7 overflow-x-auto rounded-lg border border-slate-200">
            <table class="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead
                class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                <tr>
                  <th class="px-4 py-3">ตัวชี้วัด</th>
                  <th class="px-4 py-3">วิธีการคำนวณ</th>
                  <th class="px-4 py-3">หน่วย</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200 text-slate-700">
                <tr>
                  <td class="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                    Y1 - อัตราการพึ่งพาตนเองทางการคลัง
                  </td>
                  <td class="px-4 py-3 leading-6">
                    (รายได้จัดเก็บเอง + รายได้รัฐจัดเก็บให้) ÷ (รายได้รวม − เงินกู้) × 100
                  </td>
                  <td class="whitespace-nowrap px-4 py-3">%</td>
                </tr>
                <tr>
                  <td class="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                    Y2 - ดุลการดำเนินงานประจำปี
                  </td>
                  <td class="px-4 py-3 leading-6">(รายได้ − ค่าใช้จ่าย) ÷ รายได้รวม × 100</td>
                  <td class="whitespace-nowrap px-4 py-3">%</td>
                </tr>
                <tr>
                  <td class="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                    Y3 - Cash Coverage
                  </td>
                  <td class="px-4 py-3 leading-6">
                    เงินสดและรายการเทียบเท่าเงินสด ÷ (ภาระผูกพัน + หนี้สินหมุนเวียน)
                  </td>
                  <td class="whitespace-nowrap px-4 py-3">เท่า</td>
                </tr>
              </tbody>
            </table>
          </div>

          @if (allFactorsSeries().length === 0) {
            <app-empty-state title="ไม่พบข้อมูล" message="ไม่มี factor สำหรับตัวกรองนี้" />
          }
        </section>
      </div>
    </section>
  `,
})
export class FinancialHealthPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly FISCAL_YEARS = FISCAL_YEARS;
  readonly loading = signal(false);
  readonly error = signal('');
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly annualRisks = signal<AnnualRisk[]>([]);
  readonly financialStatements = signal<FinancialStatement[]>([]);

  readonly selectedSubdistrictId = signal<number | null>(null);
  readonly selectedYear = signal<number | null>(2568);
  readonly selectedFactorCode = signal<string | null>(null);

  readonly scopedRows = computed(() => {
    const subdistrictId = this.selectedSubdistrictId();
    return this.annualRisks().filter(
      (row) => !subdistrictId || row.subdistrict_id === subdistrictId,
    );
  });

  readonly factorOptions = computed<FactorOption[]>(() => {
    const map = new Map<string, string>();
    this.scopedRows().forEach((row) => map.set(row.factor_code, row.factor_name));
    return [...map.entries()].map(([code, name]) => ({ code, name }));
  });

  readonly factorCards = computed(() => {
    const year = this.selectedYear();
    return this.scopedRows()
      .filter((row) => !year || row.fiscal_year === year)
      .sort((a, b) => a.factor_code.localeCompare(b.factor_code, 'th'));
  });

  readonly selectedFactorRows = computed(() => {
    const code = this.selectedFactorCode() ?? this.factorOptions()[0]?.code ?? null;
    if (!code) {
      return [];
    }
    return this.scopedRows()
      .filter((row) => row.factor_code === code)
      .sort((a, b) => a.fiscal_year - b.fiscal_year);
  });

  readonly selectedFactorName = computed(() => {
    const first = this.selectedFactorRows()[0];
    return first ? `${first.factor_code} - ${first.factor_name}` : 'ยังไม่มี factor';
  });

  readonly computableYearCount = computed(
    () => this.selectedFactorRows().filter((row) => toBool(row.computable)).length,
  );
  readonly coverage = computed(() => coverageText(this.scopedRows()));

  readonly scopedFinancialStatements = computed(() => {
    const subdistrictId = this.selectedSubdistrictId();
    const year = this.selectedYear();
    return this.financialStatements().filter(
      (row) =>
        (!subdistrictId || row.subdistrict_id === subdistrictId) &&
        (!year || row.fiscal_year === year),
    );
  });

  readonly balanceSheet = computed(() =>
    this.getBalanceSheetTotals(
      this.scopedFinancialStatements().filter(
        (row) => this.normalizeMetricText(row.statement_type) === 'งบแสดงฐานะการเงิน',
      ),
    ),
  );

  readonly incomeStatement = computed(() =>
    this.getIncomeStatementTotals(
      this.scopedFinancialStatements().filter(
        (row) => this.normalizeMetricText(row.statement_type) === 'งบแสดงผลการดำเนินงาน',
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
        accentClass: 'bg-slate-900',
      },
      {
        label: 'หนี้สินรวม',
        value: liabilities === null ? '-' : this.number(liabilities),
        hint: 'รวมจากงบแสดงฐานะการเงินของตำบลที่เลือก',
        accentClass: 'bg-amber-500',
      },
      {
        label: 'ส่วนทุน/สินทรัพย์สุทธิ',
        value: netAssets === null ? '-' : this.number(netAssets),
        hint: 'ยอดสินทรัพย์สุทธิ/ส่วนทุนจากงบการเงิน',
        accentClass: 'bg-emerald-500',
      },
    ];
  });

  readonly assetComposition = computed(() => {
    const { currentAssets, nonCurrentAssets } = this.balanceSheet();

    return [
      { name: 'สินทรัพย์หมุนเวียน', value: currentAssets ?? 0, color: '#2563eb' },
      { name: 'สินทรัพย์ไม่หมุนเวียน', value: nonCurrentAssets ?? 0, color: '#16a34a' },
    ];
  });

  readonly liabilityComposition = computed(() => {
    const { currentLiabilities, nonCurrentLiabilities } = this.balanceSheet();

    return [
      { name: 'หนี้สินหมุนเวียน', value: currentLiabilities ?? 0, color: '#dc2626' },
      { name: 'หนี้สินระยะยาว', value: nonCurrentLiabilities ?? 0, color: '#ea580c' },
    ];
  });

  readonly incomeStatementKpis = computed(() => {
    const { income, expenses, netIncome } = this.incomeStatement();
    return [
      {
        label: 'รายได้รวม',
        value: income === null ? '-' : this.number(income),
        hint: 'ยอดรวมจากงบแสดงผลการดำเนินงานของตำบลที่เลือก',
        accentClass: 'bg-sky-600',
      },
      {
        label: 'ค่าใช้จ่ายรวม',
        value: expenses === null ? '-' : this.number(expenses),
        hint: 'ยอดรวมจากงบแสดงผลการดำเนินงานของตำบลที่เลือก',
        accentClass: 'bg-rose-500',
      },
      {
        label: 'ผลสุทธิ (รายได้ − ค่าใช้จ่าย)',
        value: netIncome === null ? '-' : this.number(netIncome),
        hint:
          netIncome === null
            ? 'ไม่พบข้อมูลรายได้หรือค่าใช้จ่ายรวม'
            : netIncome >= 0
              ? `รายได้สูงกว่าค่าใช้จ่าย ${this.number(netIncome)} บาท`
              : `ค่าใช้จ่ายสูงกว่ารายได้ ${this.number(Math.abs(netIncome))} บาท`,
        accentClass: netIncome !== null && netIncome < 0 ? 'bg-rose-600' : 'bg-emerald-500',
      },
    ];
  });

  readonly revenueStructureCategories = computed(() => [
    this.selectedYear() ? `ปี ${this.selectedYear()}` : 'ทุกปีที่เลือก',
  ]);

  readonly revenueStructureSeries = computed<StackedBarSeries[]>(() => {
    const { ownAndAllocatedRevenue, subsidies } = this.getRevenueStructure(
      this.scopedFinancialStatements().filter(
        (row) => this.normalizeMetricText(row.statement_type) === 'งบแสดงผลการดำเนินงาน',
      ),
    );
    return [
      {
        name: 'รายได้จัดเก็บเอง + รัฐจัดสรร',
        values: [ownAndAllocatedRevenue],
        color: '#2563eb',
      },
      { name: 'เงินอุดหนุน', values: [subsidies], color: '#16a34a' },
    ];
  });

  readonly allFactorsSeries = computed<TimeSeries[]>(() => {
    const factorMap = new Map<string, { name: string; color: string }>();
    const colors = ['#2563eb', '#dc2626', '#16a34a', '#ea580c', '#7c3aed', '#0891b2'];

    this.scopedRows().forEach((row, idx) => {
      if (!factorMap.has(row.factor_code)) {
        factorMap.set(row.factor_code, {
          name: row.factor_name,
          color: colors[idx % colors.length],
        });
      }
    });

    return Array.from(factorMap.entries()).map(([code, { name, color }]) => ({
      name: `${code} - ${name}`,
      color,
      points: FISCAL_YEARS.map((year) => {
        const row = this.scopedRows().find(
          (candidate) => candidate.fiscal_year === year && candidate.factor_code === code,
        );
        const computable = toBool(row?.computable);
        return {
          year,
          value: computable ? toNumber(row?.observed_value) : null,
          computable,
          tooltip: row?.evidence_text ?? (computable ? null : 'ข้อมูลไม่พอสำหรับคำนวณ factor นี้'),
        };
      }),
    }));
  });

  readonly factorSeries = computed<TimeSeries[]>(() => [
    {
      name: 'Observed value',
      color: '#2563eb',
      points: FISCAL_YEARS.map((year) => {
        const row = this.selectedFactorRows().find((candidate) => candidate.fiscal_year === year);
        const computable = toBool(row?.computable);
        return {
          year,
          value: computable ? toNumber(row?.observed_value) : null,
          computable,
          tooltip: row?.evidence_text ?? (computable ? null : 'ข้อมูลไม่พอสำหรับคำนวณ factor นี้'),
        };
      }),
    },
  ]);

  ngOnInit(): void {
    this.loading.set(true);
    forkJoin({
      subdistricts: this.api.subdistricts(),
      annualRisks: this.api.annualRisk(),
      // `/financials` is optional while older backends are being upgraded.
      // Its absence must not block the existing annual-risk view.
      financialStatements: this.api
        .financialStatements()
        .pipe(catchError(() => of<FinancialStatement[]>([]))),
    }).subscribe({
      next: ({ subdistricts, annualRisks, financialStatements }) => {
        this.subdistricts.set(subdistricts);
        this.annualRisks.set(annualRisks);
        this.financialStatements.set(financialStatements);
        this.selectedFactorCode.set(this.factorOptions()[0]?.code ?? null);
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
    this.selectedFactorCode.set(this.factorOptions()[0]?.code ?? null);
  }

  setYear(value: number | null): void {
    this.selectedYear.set(value);
  }

  setFactor(value: string): void {
    this.selectedFactorCode.set(value || null);
  }

  resetFilters(): void {
    this.selectedSubdistrictId.set(null);
    this.selectedYear.set(2568);
    this.selectedFactorCode.set(this.factorOptions()[0]?.code ?? null);
  }

  isComputable(row: AnnualRisk): boolean {
    return toBool(row.computable);
  }

  observedValueText(row: AnnualRisk): string {
    const unit = this.observedValueUnit(row);
    const value = this.number(row.observed_value);
    return unit ? `${value} ${unit}` : value;
  }

  private normalizeMetricText(value: string | null | undefined): string {
    return (value ?? '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9ก-๙]/g, '');
  }

  private getBalanceSheetTotals(rows: FinancialStatement[]): BalanceSheetTotals {
    const totals = this.getCategoryTotals(rows, [
      'สินทรัพย์รวม',
      'หนี้สินรวม',
      'สินทรัพย์สุทธิส่วนทุน',
      'สินทรัพย์หมุนเวียน',
      'สินทรัพย์ไม่หมุนเวียน',
      'หนี้สินหมุนเวียน',
      'หนี้สินไม่หมุนเวียน',
    ]);
    const assets =
      totals['สินทรัพย์รวม'] ??
      this.sumValues(totals['สินทรัพย์หมุนเวียน'], totals['สินทรัพย์ไม่หมุนเวียน']);
    const liabilities =
      totals['หนี้สินรวม'] ??
      this.sumValues(totals['หนี้สินหมุนเวียน'], totals['หนี้สินไม่หมุนเวียน']);
    return {
      assets,
      liabilities,
      netAssets: totals['สินทรัพย์สุทธิส่วนทุน'] ?? this.subtractValues(assets, liabilities),
      currentAssets: totals['สินทรัพย์หมุนเวียน'],
      nonCurrentAssets: totals['สินทรัพย์ไม่หมุนเวียน'],
      currentLiabilities: totals['หนี้สินหมุนเวียน'],
      nonCurrentLiabilities: totals['หนี้สินไม่หมุนเวียน'],
    };
  }

  private getIncomeStatementTotals(rows: FinancialStatement[]): IncomeStatementTotals {
    const totals = this.getCategoryTotals(rows, ['รายได้รวม', 'ค่าใช้จ่ายรวม']);
    const income = totals['รายได้รวม'];
    const expenses = totals['ค่าใช้จ่ายรวม'];
    return { income, expenses, netIncome: this.subtractValues(income, expenses) };
  }

  private getRevenueStructure(rows: FinancialStatement[]): {
    ownAndAllocatedRevenue: number;
    subsidies: number;
  } {
    return rows
      .filter(
        (row) =>
          this.normalizeMetricText(row.category) === 'รายได้' && row.detail_level === 'line_item',
      )
      .reduce(
        (totals, row) => {
          const value = toNumber(row.value) ?? 0;
          if (this.normalizeMetricText(row.account_item).includes('อุดหนุน')) {
            totals.subsidies += value;
          } else {
            totals.ownAndAllocatedRevenue += value;
          }
          return totals;
        },
        { ownAndAllocatedRevenue: 0, subsidies: 0 },
      );
  }

  private getCategoryTotals(
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
            this.normalizeMetricText(row.category) === category &&
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

  private sumValues(first: number | null, second: number | null): number | null {
    return first !== null && second !== null ? first + second : null;
  }

  private subtractValues(first: number | null, second: number | null): number | null {
    return first !== null && second !== null ? first - second : null;
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
}
