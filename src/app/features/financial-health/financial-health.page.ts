import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AnnualRisk, Subdistrict } from '../../core/models/domain.models';
import { DonutChartComponent } from '../../shared/charts/donut-chart.component';
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

@Component({
  selector: 'app-financial-health-page',
  standalone: true,
  imports: [
    DonutChartComponent,
    EmptyStateComponent,
    FilterBarComponent,
    KpiCardComponent,
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

  readonly balanceSheetKpis = computed(() => {
    const year = this.selectedYear();
    const rows = this.scopedRows().filter((row) => !year || row.fiscal_year === year);

    const getValue = (patterns: string[]): number | null => {
      const row = rows.find((candidate) => {
        const name = this.normalizeMetricText(candidate.factor_name);
        const code = this.normalizeMetricText(candidate.factor_code);
        return patterns.some((pattern) => name.includes(pattern) || code.includes(pattern));
      });
      return row ? toNumber(row.observed_value) : null;
    };

    const assets = getValue(['สินทรัพย์รวม', 'assets', 'asset']);
    const liabilities = getValue(['หนี้สินรวม', 'liabilities', 'liability']);
    const netAssets = assets !== null && liabilities !== null ? assets - liabilities : null;

    return [
      {
        label: 'สินทรัพย์รวม',
        value: assets === null ? '-' : this.number(assets),
        hint: '',
        accentClass: 'bg-slate-900',
      },
      {
        label: 'หนี้สินรวม',
        value: liabilities === null ? '-' : this.number(liabilities),
        hint: '',
        accentClass: 'bg-amber-500',
      },
      {
        label: 'ส่วนทุน/สินทรัพย์สุทธิ',
        value: netAssets === null ? '-' : this.number(netAssets),
        hint: '',
        accentClass: 'bg-emerald-500',
      },
    ];
  });

  readonly assetComposition = computed(() => {
    const year = this.selectedYear();
    const rows = this.scopedRows().filter((row) => !year || row.fiscal_year === year);

    const findValue = (patterns: string[]): number | null => {
      const row = rows.find((candidate) => {
        const name = this.normalizeMetricText(candidate.factor_name);
        const code = this.normalizeMetricText(candidate.factor_code);
        return patterns.some((pattern) => name.includes(pattern) || code.includes(pattern));
      });
      return row ? toNumber(row.observed_value) : null;
    };

    const currentAssets = findValue([
      'สินทรัพย์หมุนเวียน',
      'currentassets',
      'currentasset',
      'current assets',
      'currentassetscurrent',
    ]);
    const nonCurrentAssets = findValue([
      'สินทรัพย์ไม่หมุนเวียน',
      'noncurrentassets',
      'noncurrentasset',
      'non-current assets',
      'fixedassets',
    ]);

    return [
      { name: 'สินทรัพย์หมุนเวียน', value: currentAssets ?? 0, color: '#2563eb' },
      { name: 'สินทรัพย์ไม่หมุนเวียน', value: nonCurrentAssets ?? 0, color: '#16a34a' },
    ];
  });

  readonly liabilityComposition = computed(() => {
    const year = this.selectedYear();
    const rows = this.scopedRows().filter((row) => !year || row.fiscal_year === year);

    const findValue = (patterns: string[]): number | null => {
      const row = rows.find((candidate) => {
        const name = this.normalizeMetricText(candidate.factor_name);
        const code = this.normalizeMetricText(candidate.factor_code);
        return patterns.some((pattern) => name.includes(pattern) || code.includes(pattern));
      });
      return row ? toNumber(row.observed_value) : null;
    };

    const currentLiabilities = findValue([
      'หนี้สินหมุนเวียน',
      'currentliabilities',
      'currentliability',
      'current liabilities',
    ]);
    const longTermLiabilities = findValue([
      'หนี้สินระยะยาว',
      'longtermliabilities',
      'longtermliability',
      'long-term liabilities',
      'noncurrentliabilities',
      'noncurrentliability',
    ]);

    return [
      { name: 'หนี้สินหมุนเวียน', value: currentLiabilities ?? 0, color: '#dc2626' },
      { name: 'หนี้สินระยะยาว', value: longTermLiabilities ?? 0, color: '#ea580c' },
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
    }).subscribe({
      next: ({ subdistricts, annualRisks }) => {
        this.subdistricts.set(subdistricts);
        this.annualRisks.set(annualRisks);
        this.selectedFactorCode.set(this.factorOptions()[0]?.code ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('โหลด /risk/annual ไม่สำเร็จ');
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
