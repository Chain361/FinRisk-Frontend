import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AnnualRisk, Subdistrict } from '../../core/models/domain.models';
import { TimeSeries, TimeSeriesChartComponent } from '../../shared/charts/time-series-chart.component';
import { FilterBarComponent } from '../../shared/filters/filter-bar.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { RiskBadgeComponent } from '../../shared/ui/risk-badge.component';
import { coverageText, FISCAL_YEARS, formatNumber, toBool, toNumber } from '../../shared/utils/risk-utils';

interface FactorOption {
  code: string;
  name: string;
}

@Component({
  selector: 'app-financial-health-page',
  standalone: true,
  imports: [EmptyStateComponent, FilterBarComponent, RiskBadgeComponent, TimeSeriesChartComponent],
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

      @if (error()) {
        <p class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</p>
      }

      <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 class="text-base font-semibold text-slate-950">เลือก Risk Factor เพื่อดู Time Series</h2>
          <p class="mt-1 text-sm text-slate-500">{{ coverage() }}</p>
        </div>
        <select
          class="h-10 min-w-64 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-slate-900"
          [value]="selectedFactorCode() ?? ''"
          (change)="setFactor($any($event.target).value)"
        >
          @for (factor of factorOptions(); track factor.code) {
            <option [value]="factor.code">{{ factor.code }} - {{ factor.name }}</option>
          }
        </select>
      </div>

      <div class="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <section class="panel p-4">
          <div class="mb-3">
            <h2 class="text-base font-semibold">สถานะปี {{ selectedYear() ?? 'ทุกปี' }}</h2>
            <p class="text-sm text-slate-500">computable=0 แสดงเป็นประเมินไม่ได้ และไม่แทนค่าเป็น 0</p>
          </div>

          @if (!factorCards().length) {
            <app-empty-state title="ไม่พบข้อมูล Financial Health" message="ข้อมูล /risk/annual อาจยังไม่มีสำหรับตัวกรองนี้" />
          } @else {
            <div class="grid gap-3">
              @for (row of factorCards(); track row.factor_code + '-' + row.fiscal_year + '-' + row.subdistrict_id) {
                <article class="rounded-lg border border-slate-200 p-4">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p class="text-sm font-semibold text-slate-950">{{ row.factor_name }}</p>
                      <p class="text-xs text-slate-500">{{ row.factor_code }} · ปี {{ row.fiscal_year }}</p>
                    </div>
                    @if (isComputable(row)) {
                      <app-risk-badge [level]="row.risk_level" />
                    } @else {
                      <span class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        ประเมินไม่ได้
                      </span>
                    }
                  </div>

                  <div class="mt-4 grid gap-3 sm:grid-cols-2">
                    <div class="rounded-md bg-slate-50 p-3">
                      <p class="text-xs font-semibold text-slate-500">Observed Value</p>
                      <p class="mt-1 text-lg font-semibold text-slate-900">
                        {{ isComputable(row) ? number(row.observed_value) : 'ประเมินไม่ได้ (ข้อมูลไม่พอ)' }}
                      </p>
                    </div>
                    <div class="rounded-md bg-slate-50 p-3">
                      <p class="text-xs font-semibold text-slate-500">Threshold</p>
                      <p class="mt-1 text-lg font-semibold text-slate-900">{{ number(row.threshold_used) }}</p>
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
              <h2 class="text-base font-semibold">{{ selectedFactorName() }}</h2>
              <p class="text-sm text-slate-500">กราฟเว้น gap เมื่อปีนั้น computable=0</p>
            </div>
            <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              ปีที่คำนวณได้ {{ computableYearCount() }}/{{ FISCAL_YEARS.length }}
            </span>
          </div>

          <app-time-series-chart [series]="factorSeries()" yAxisName="Observed value" />

          @if (computableYearCount() > 0 && computableYearCount() < 2) {
            <p class="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              ต้องมี ≥ 2 ปีที่คำนวณได้จึงดูแนวโน้ม/คำนวณ YoY ได้ ตอนนี้แสดงเป็นจุดเดี่ยวเท่านั้น
            </p>
          }

          <div class="mt-4 grid gap-2">
            @for (row of selectedFactorRows(); track row.factor_code + '-' + row.fiscal_year + '-' + row.subdistrict_id) {
              <div class="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
                <span class="font-semibold text-slate-700">{{ row.fiscal_year }}</span>
                <span class="text-slate-600">{{ isComputable(row) ? number(row.observed_value) : 'ประเมินไม่ได้ (ข้อมูลไม่พอ)' }}</span>
                @if (isComputable(row)) {
                  <app-risk-badge [level]="row.risk_level" />
                } @else {
                  <span class="text-xs font-semibold text-slate-500">computable=0</span>
                }
              </div>
            }
          </div>
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
    return this.annualRisks().filter((row) => !subdistrictId || row.subdistrict_id === subdistrictId);
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

  readonly computableYearCount = computed(() => this.selectedFactorRows().filter((row) => toBool(row.computable)).length);
  readonly coverage = computed(() => coverageText(this.scopedRows()));

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

  number(value: number | string | null | undefined): string {
    return formatNumber(value, 3);
  }
}
