import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AnnualRisk, Project, ProjectFilters, RiskSummary, Subdistrict } from '../../core/models/domain.models';
import { TimeSeries, TimeSeriesChartComponent } from '../../shared/charts/time-series-chart.component';
import { DonutChartComponent } from '../../shared/charts/donut-chart.component';
import { FilterBarComponent } from '../../shared/filters/filter-bar.component';
import { RiskBarChartComponent } from '../../shared/charts/risk-barchart.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { KpiCardComponent } from '../../shared/ui/kpi-card.component';
import {
  countByRisk,
  FISCAL_YEARS,
  formatMoney,
  formatNumber,
  normalizeRiskLevel,
  RISK_LEVELS,
  sortProjectsByRisk,
  subdistrictLabel,
  toBool,
  toNumber,
} from '../../shared/utils/risk-utils';

interface RepeatedEntity {
  label: string;
  years: number[];
  count: number;
  totalBudget: number;
}

interface VendorRanking {
  vendorName: string;
  projectCount: number;
  winCount: number;
  totalContractValue: number;
  sampleProjects: string[];
  years: number[];
  isRecurring: boolean;
  isFrequentWinner: boolean;
}

@Component({
  selector: 'app-project-risk-page',
  standalone: true,
  imports: [
    DonutChartComponent,
    EmptyStateComponent,
    FilterBarComponent,
    KpiCardComponent,
    TimeSeriesChartComponent,
    RiskBarChartComponent,
  ],
  template: `
    <section class="page-shell">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-slate-500">F1</p>
          <h1 class="text-2xl font-semibold text-slate-950">Project Risk Dashboard</h1>
          <p class="mt-1 text-sm text-slate-500">สรุปจำนวนโครงการตามระดับความเสี่ยง และดูรายการที่ควรตรวจต่อ</p>
        </div>
      </div>

      <app-filter-bar
        [subdistricts]="subdistricts()"
        [selectedSubdistrictId]="selectedSubdistrictId()"
        [selectedYear]="selectedYear()"
        [selectedRiskLevel]="selectedRiskLevel()"
        (selectedSubdistrictIdChange)="setSubdistrict($event)"
        (selectedYearChange)="setYear($event)"
        (selectedRiskLevelChange)="setRisk($event)"
        (reset)="resetFilters()"
      />

      @if (error()) {
        <p class="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{{ error() }}</p>
      }

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <app-kpi-card label="โครงการทั้งหมด" [value]="totalProjects()" hint="" accentClass="bg-slate-900" />
        <app-kpi-card label="เสี่ยงสูง" [value]="byLevel()['high'] ?? 0" hint="" accentClass="bg-red-500" />
        <app-kpi-card label="เสี่ยงปานกลาง" [value]="byLevel()['medium'] ?? 0" hint="" accentClass="bg-amber-500" />
        <app-kpi-card label="เสี่ยงต่ำ" [value]="byLevel()['low'] ?? 0" hint="" accentClass="bg-emerald-500" />
      </div>

      <div class="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section class="panel p-4">
          <div class="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 class="text-base font-semibold">สัดส่วนความเสี่ยง</h2>
              <p class="text-sm text-slate-500">ข้อมูลจาก /risk/summary หรือคำนวณจากรายการเมื่อมีตัวกรอง</p>
            </div>
          </div>
          <app-donut-chart [byLevel]="byLevel()" />
        </section>

        <section class="panel p-4">
          <div class="mb-3">
            <h2 class="text-base font-semibold">Risk Bar Chart ตามปีงบประมาณ</h2>
            <p class="text-sm text-slate-500">นับจำนวนโครงการในแต่ละระดับความเสี่ยงจาก /projects</p>
          </div>
          <app-risk-bar-chart [projects]="barchartProjects()" />
        </section>
      </div>

      <section class="panel p-4">
            <div class="mb-3">
              <h2 class="text-base font-semibold">งบประมาณรวมแต่ละปี</h2>
            </div>

            <app-time-series-chart
            [series]="budgetSeries()"
                yAxisName="งบประมาณ (บาท)"
                chartType="bar">
              </app-time-series-chart>
            </section>

            <section class="panel p-4">
              <div class="mb-3">
                <h2 class="text-base font-semibold">Risk Score เฉลี่ยแต่ละปี</h2>
              </div>

            <app-time-series-chart
              [series]="averageRiskSeries()"
                yAxisName="Average Risk Score"
                chartType="bar">
            </app-time-series-chart>
      </section>

      <section class="panel p-4">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold">จำนวนโครงการตามระดับความเสี่ยง</h2>
            <p class="text-sm text-slate-500">ปีที่ไม่มีโครงการจะแสดงเป็น 0 จริง ไม่ใช่ข้อมูลขาด</p>
          </div>
          <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            2566-2568
          </span>
        </div>
        <app-time-series-chart [series]="riskSeries()" yAxisName="จำนวนโครงการ" />
      </section>

      
      <div class="grid gap-4 xl:grid-cols-2">
        <section class="panel p-4">
          <div class="mb-3">
            <h2 class="text-base font-semibold">งบเฉลี่ยตามประเภทโครงการ</h2>
            <p class="text-sm text-slate-500">ถ้าปีใดไม่มีโครงการประเภทนั้น กราฟจะเว้น gap ไม่แทนค่า 0</p>
          </div>
          <app-time-series-chart [series]="averageBudgetSeries()" yAxisName="บาท" />
        </section>

        <section class="panel p-4">
          <div class="mb-3">
            <h2 class="text-base font-semibold">ความเสี่ยงข้ามปี/ข้ามตำบล</h2>
            <p class="text-sm text-slate-500">เมื่อเลือกทุกตำบล เส้นจะแยกตามตำบล; เมื่อเลือกตำบลเดียว เส้นจะแยกตามระดับความเสี่ยง</p>
          </div>
          <app-time-series-chart [series]="riskTrendSeries()" yAxisName="จำนวนโครงการ" />
        </section>
      </div>

      <section class="panel p-4">
        <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold">ผู้รับจ้างที่ได้รับงานบ่อยที่สุด</h2>
            <p class="text-sm text-slate-500">แสดง Top 10 Vendors ตามจำนวนโครงการที่ได้รับในช่วงตัวกรองที่เลือก</p>
          </div>
        </div>

        <div class="mb-4 grid gap-3 md:grid-cols-[1.2fr_0.8fr]">
          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">ค้นหาผู้รับจ้าง</span>
            <input
              type="search"
              class="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-900"
              placeholder="พิมพ์ชื่อผู้รับจ้าง"
              [value]="vendorSearchText()"
              (input)="setVendorSearch($any($event.target).value)"
            />
          </label>

          <label class="block">
            <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">ประเภทโครงการ</span>
            <select
              class="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-900"
              [value]="selectedProjectType() ?? 'all'"
              (change)="setProjectType($any($event.target).value)"
            >
              <option value="all">ทุกประเภท</option>
              @for (type of projectTypes(); track type) {
                <option [value]="type">{{ type }}</option>
              }
            </select>
          </label>
        </div>

        @if (!vendorRankings().length) {
          <app-empty-state title="ไม่พบข้อมูลผู้รับจ้างสำหรับตัวกรองที่เลือก" message="ลองเปลี่ยนตัวกรองปี/ตำบลหรือคำค้นหาผู้รับจ้างใหม่อีกครั้ง" />
        } @else {
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 text-sm">
              <thead class="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th class="px-3 py-3">อันดับ</th>
                  <th class="px-3 py-3">ผู้รับจ้าง</th>
                  <th class="px-3 py-3 text-right">จำนวนโครงการ</th>
                  <th class="px-3 py-3 text-right">จำนวนครั้งที่ชนะ</th>
                  <th class="px-3 py-3 text-right">มูลค่าสัญญารวม</th>
                  <th class="px-3 py-3">รายชื่อโครงการ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (vendor of vendorRankings(); track vendor.vendorName) {
                  <tr>
                    <td class="px-3 py-3 font-semibold text-slate-900">{{ $index + 1 }}</td>
                    <td class="px-3 py-3">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="font-semibold text-slate-900">{{ vendor.vendorName }}</span>
                        @if (vendor.isRecurring) {
                          <span class="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Recurring Vendor</span>
                        }
                        @if (vendor.isFrequentWinner) {
                          <span class="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">Frequent Winner</span>
                        }
                      </div>
                    </td>
                    <td class="px-3 py-3 text-right">{{ vendor.projectCount }}</td>
                    <td class="px-3 py-3 text-right">{{ vendor.winCount }}</td>
                    <td class="px-3 py-3 text-right">{{ money(vendor.totalContractValue) }}</td>
                    <td class="px-3 py-3 text-slate-600">
                      <div class="flex flex-wrap gap-1">
                        @for (projectName of vendor.sampleProjects; track projectName) {
                          <span class="rounded-full bg-slate-100 px-2 py-1 text-xs">{{ projectName }}</span>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <div class="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <section class="panel overflow-hidden">
          <div class="border-b border-slate-200 p-4">
            <h2 class="text-base font-semibold">โครงการ/ผู้รับจ้าง/วิธีจัดซื้อที่ซ้ำข้ามปี</h2>
            <p class="text-sm text-slate-500">ใช้ vendor field ถ้ามีจาก API; ถ้าไม่มีจะ fallback เป็นวิธีจัดซื้อ/ประเภทโครงการ</p>
          </div>
          @if (!repeatedEntities().length) {
            <div class="p-4">
              <app-empty-state title="ยังไม่พบรายการซ้ำ ≥ 2 ปี" message="ข้อมูลใน scope ปัจจุบันอาจมีปีเดียวหรือไม่มี vendor field" />
            </div>
          } @else {
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-200 text-sm">
                <thead class="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th class="px-4 py-3">รายการ</th>
                    <th class="px-4 py-3">ปีที่พบ</th>
                    <th class="px-4 py-3 text-right">จำนวน</th>
                    <th class="px-4 py-3 text-right">งบรวม</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @for (entity of repeatedEntities(); track entity.label) {
                    <tr>
                      <td class="px-4 py-3 font-semibold text-slate-900">{{ entity.label }}</td>
                      <td class="px-4 py-3 text-slate-600">{{ entity.years.join(', ') }}</td>
                      <td class="px-4 py-3 text-right">{{ entity.count }}</td>
                      <td class="px-4 py-3 text-right">{{ money(entity.totalBudget) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <section class="panel p-4">
          <h2 class="text-base font-semibold">Financial Risk Coverage</h2>
          <p class="mt-1 text-sm text-slate-500">สรุปจาก /risk/annual เพื่อเห็นปีที่ประเมินไม่ได้</p>
          <div class="mt-4 grid gap-2">
            @for (year of FISCAL_YEARS; track year) {
              <div class="rounded-md border border-slate-200 p-3">
                <div class="flex items-center justify-between gap-3">
                  <p class="text-sm font-semibold text-slate-900">{{ year }}</p>
                  <p class="text-xs text-slate-500">{{ annualRowsForYear(year).length }} factors</p>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                  <div class="rounded-md bg-emerald-50 px-2 py-2 text-emerald-700">
                    <p class="font-semibold">{{ annualComputableCount(year) }}</p>
                    <p>คำนวณได้</p>
                  </div>
                  <div class="rounded-md bg-slate-100 px-2 py-2 text-slate-600">
                    <p class="font-semibold">{{ annualNotComputableCount(year) }}</p>
                    <p>ประเมินไม่ได้</p>
                  </div>
                </div>
              </div>
            }
          </div>
        </section>
      </div>
    </section>
  `,
})
export class ProjectRiskPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly FISCAL_YEARS = FISCAL_YEARS;
  readonly loading = signal(false);
  readonly error = signal('');
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly barchartProjects = signal<Project[]>([]);
  readonly multiYearProjects = signal<Project[]>([]);
  readonly summary = signal<RiskSummary | null>(null);
  readonly riskSeries = signal<TimeSeries[]>([]);
  readonly budgetSeries = signal<TimeSeries[]>([]);
  readonly averageRiskSeries = signal<TimeSeries[]>([]);  readonly annualRisks = signal<AnnualRisk[]>([]);

  readonly selectedSubdistrictId = signal<number | null>(null);
  readonly selectedYear = signal<number | null>(2568);
  readonly selectedRiskLevel = signal<string | null>(null);
  readonly selectedProjectType = signal<string | null>(null);
  readonly vendorSearchText = signal('');

  readonly hasActiveFilter = computed(
    () => Boolean(this.selectedSubdistrictId()) || Boolean(this.selectedYear()) || Boolean(this.selectedRiskLevel()),
  );

  readonly byLevel = computed<Record<string, number | undefined>>(() => {
    if (this.hasActiveFilter()) {
      return countByRisk(this.projects());
    }
    return this.summary()?.by_level ?? countByRisk(this.projects());
  });

  readonly totalProjects = computed(() => (this.hasActiveFilter() ? this.projects().length : (this.summary()?.total ?? this.projects().length)));
  readonly sortedProjects = computed(() => sortProjectsByRisk(this.projects()));

  readonly projectTypes = computed<string[]>(() => {
    const types = new Set<string>();
    this.projects().forEach((project) => {
      const type = this.projectType(project);
      if (type && type !== 'ไม่ระบุประเภท') {
        types.add(type);
      }
    });
    return [...types].sort((a, b) => a.localeCompare(b, 'th'));
  });

  readonly filteredVendorProjects = computed(() => {
    const search = this.vendorSearchText().trim().toLowerCase();
    return this.projects().filter((project) => {
      const typeMatches = !this.selectedProjectType() || this.projectType(project) === this.selectedProjectType();
      const vendorName = this.vendorDisplayName(project).toLowerCase();
      const searchMatches = !search || vendorName.includes(search);
      return typeMatches && searchMatches;
    });
  });

  readonly vendorRankings = computed<VendorRanking[]>(() => {
    const groups = new Map<string, { years: Set<number>; projectCount: number; totalContractValue: number; sampleProjects: string[] }>();

    this.filteredVendorProjects().forEach((project) => {
      const vendorName = this.vendorDisplayName(project) || 'ไม่ระบุผู้รับจ้าง';
      const current = groups.get(vendorName) ?? {
        years: new Set<number>(),
        projectCount: 0,
        totalContractValue: 0,
        sampleProjects: [],
      };

      current.years.add(project.budget_year);
      current.projectCount += 1;
      current.totalContractValue += toNumber(project.contract_value ?? project.contract_price ?? project.contract_amount ?? project.winning_price ?? project.budget_amount) ?? 0;
      if (project.project_name) {
        current.sampleProjects.push(project.project_name);
      }
      groups.set(vendorName, current);
    });

    return [...groups.entries()]
      .map(([vendorName, value]) => ({
        vendorName,
        projectCount: value.projectCount,
        winCount: value.projectCount,
        totalContractValue: value.totalContractValue,
        sampleProjects: value.sampleProjects.slice(0, 3),
        years: [...value.years].sort((a, b) => a - b),
        isRecurring: value.years.size > 2,
        isFrequentWinner: value.projectCount > 5,
      }))
      .sort((a, b) => b.projectCount - a.projectCount || b.totalContractValue - a.totalContractValue || a.vendorName.localeCompare(b.vendorName, 'th'))
      .slice(0, 10);
  });

  readonly scopedAnnualRisks = computed(() => {
    const subdistrictId = this.selectedSubdistrictId();
    return this.annualRisks().filter((row) => !subdistrictId || row.subdistrict_id === subdistrictId);
  });

  readonly averageBudgetSeries = computed<TimeSeries[]>(() => {
    const topTypes = this.topProjectTypes();
    const colors = ['#2563eb', '#7c3aed', '#0891b2', '#ea580c', '#475569'];

    return topTypes.map((type, index) => ({
      name: type,
      color: colors[index % colors.length],
      points: FISCAL_YEARS.map((year) => {
        const projects = this.multiYearProjects().filter((project) => project.budget_year === year && this.projectType(project) === type);
        const values = projects.map((project) => toNumber(project.budget_amount)).filter((value): value is number => value !== null);
        const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
        return {
          year,
          value: average,
          computable: average !== null,
          tooltip: average === null ? 'ไม่มีโครงการประเภทนี้ในปีนี้' : `${projects.length} โครงการ`,
        };
      }),
    }));
  });

  readonly riskTrendSeries = computed<TimeSeries[]>(() => {
    if (this.selectedSubdistrictId()) {
      const levels = [
        { level: 'high', name: 'เสี่ยงสูง', color: '#dc2626' },
        { level: 'medium', name: 'เสี่ยงปานกลาง', color: '#d97706' },
        { level: 'low', name: 'เสี่ยงต่ำ', color: '#16a34a' },
      ];
      return levels.map((item) => ({
        name: item.name,
        color: item.color,
        points: FISCAL_YEARS.map((year) => ({
          year,
          value: this.multiYearProjects().filter(
            (project) => project.budget_year === year && normalizeRiskLevel(project.risk_level) === item.level,
          ).length,
          computable: true,
          tooltip: 'นับจาก /projects',
        })),
      }));
    }

    const ids = [...new Set(this.multiYearProjects().map((project) => project.subdistrict_id))];
    const colors = ['#dc2626', '#2563eb', '#0891b2', '#7c3aed', '#ea580c'];
    return ids.map((id, index) => ({
      name: this.subdistrictName(id),
      color: colors[index % colors.length],
      points: FISCAL_YEARS.map((year) => ({
        year,
        value: this.multiYearProjects().filter(
          (project) => project.budget_year === year && project.subdistrict_id === id && normalizeRiskLevel(project.risk_level) === 'high',
        ).length,
        computable: true,
        tooltip: 'จำนวนโครงการเสี่ยงสูง',
      })),
    }));
  });

  readonly repeatedEntities = computed<RepeatedEntity[]>(() => {
    const groups = new Map<string, { years: Set<number>; count: number; totalBudget: number }>();
    this.multiYearProjects().forEach((project) => {
      const label = this.entityLabel(project);
      const current = groups.get(label) ?? { years: new Set<number>(), count: 0, totalBudget: 0 };
      current.years.add(project.budget_year);
      current.count += 1;
      current.totalBudget += toNumber(project.budget_amount) ?? 0;
      groups.set(label, current);
    });

    return [...groups.entries()]
      .map(([label, value]) => ({
        label,
        years: [...value.years].sort((a, b) => a - b),
        count: value.count,
        totalBudget: value.totalBudget,
      }))
      .filter((item) => item.years.length >= 2)
      .sort((a, b) => b.count - a.count || b.totalBudget - a.totalBudget)
      .slice(0, 12);
  });

  ngOnInit(): void {
    this.loadSubdistricts();
    this.loadDashboard();
    this.loadTimeSeries();
    this.loadAnnualRisks();
  }

  setSubdistrict(value: number | null): void {
    this.selectedSubdistrictId.set(value);
    this.loadDashboard();
    this.loadTimeSeries();
  }

  setYear(value: number | null): void {
    this.selectedYear.set(value);
    this.loadDashboard();
  }

  setRisk(value: string | null): void {
    this.selectedRiskLevel.set(value);
    this.loadDashboard();
  }

  resetFilters(): void {
    this.selectedSubdistrictId.set(null);
    this.selectedYear.set(2568);
    this.selectedRiskLevel.set(null);
    this.selectedProjectType.set(null);
    this.vendorSearchText.set('');
    this.loadDashboard();
    this.loadTimeSeries();
  }

  setProjectType(value: string | null): void {
    this.selectedProjectType.set(value === 'all' ? null : value);
  }

  setVendorSearch(value: string): void {
    this.vendorSearchText.set(value);
  }

  money(value: number | string | null | undefined): string {
    return formatMoney(value);
  }

  number(value: number | string | null | undefined, fractionDigits = 2): string {
    return formatNumber(value, fractionDigits);
  }

  annualRowsForYear(year: number): AnnualRisk[] {
    return this.scopedAnnualRisks().filter((row) => row.fiscal_year === year);
  }

  annualHighCount(year: number): number {
    return this.annualRowsForYear(year).filter((row) => normalizeRiskLevel(row.risk_level) === 'high').length;
  }

  annualComputableCount(year: number): number {
    return this.annualRowsForYear(year).filter((row) => toBool(row.computable)).length;
  }

  annualNotComputableCount(year: number): number {
    return this.annualRowsForYear(year).filter((row) => !toBool(row.computable)).length;
  }

  private loadSubdistricts(): void {
    this.api.subdistricts().subscribe({
      next: (rows) => this.subdistricts.set(rows),
      error: () => this.error.set('โหลดรายการตำบลไม่สำเร็จ'),
    });
  }

  private loadDashboard(): void {
    this.loading.set(true);
    this.error.set('');

    forkJoin({
      summary: this.api.riskSummary(this.filters()),
      projects: this.api.projects(this.filters()),
    }).subscribe({
      next: ({ summary, projects }) => {
        this.summary.set(summary);
        this.projects.set(projects);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('โหลดข้อมูล Project Risk ไม่สำเร็จ ตรวจ backend และ X-Username');
        this.loading.set(false);
      },
    });
  }

  private loadTimeSeries(): void {
    const subdistrictId = this.selectedSubdistrictId();
    const requests = FISCAL_YEARS.map((year) => this.api.projects({ budget_year: year, subdistrict_id: subdistrictId }));

    forkJoin(requests).subscribe({
      next: (rowsByYear) => {
        const all = rowsByYear.flat();
        this.multiYearProjects.set(all);
        this.barchartProjects.set(all);
        // -------------------------
// งบประมาณรวมแต่ละปี
// -------------------------
this.budgetSeries.set([
  {
    name: 'งบประมาณรวม',
    color: '#2563eb',
    points: FISCAL_YEARS.map((year, index) => ({
      year,
      value: rowsByYear[index].reduce(
        (sum, project) => sum + Number(project.budget_amount ?? 0),
        0
      ),
      computable: true,
      tooltip: 'ผลรวมงบประมาณ',
    })),
  },
]);

// -------------------------
// Risk Score เฉลี่ยแต่ละปี
// -------------------------
this.averageRiskSeries.set([
  {
    name: 'Average Risk Score',
    color: '#9333ea',
    points: FISCAL_YEARS.map((year, index) => {

      const projects = rowsByYear[index];

      const avg =
        projects.length === 0
          ? 0
          : projects.reduce(
              (sum, project) => sum + Number(project.risk_score ?? 0),
              0
            ) / projects.length;

      return {
        year,
        value: Number(avg.toFixed(2)),
        computable: true,
        tooltip: 'Risk Score เฉลี่ย',
      };
    }),
  },
]);

// -------------------------
// จำนวนโครงการแต่ละระดับ
// -------------------------
        this.riskSeries.set(
          RISK_LEVELS.map((level) => ({
            name: level === 'high' ? 'เสี่ยงสูง' : level === 'medium' ? 'เสี่ยงปานกลาง' : 'เสี่ยงต่ำ',
            color: level === 'high' ? '#dc2626' : level === 'medium' ? '#d97706' : '#16a34a',
            points: FISCAL_YEARS.map((year, index) => ({
              year,
              value: rowsByYear[index].filter((project) => normalizeRiskLevel(project.risk_level) === level).length,
              computable: true,
              tooltip: 'นับจากรายการโครงการของปีนั้น',
            })),
          })),
        );
      },
      error: () => this.error.set('โหลด time series โครงการไม่สำเร็จ'),
    });
  }

  private loadAnnualRisks(): void {
    this.api.annualRisk().subscribe({
      next: (rows) => this.annualRisks.set(rows),
      error: () => this.error.set('โหลดข้อมูล Financial Risk Coverage ไม่สำเร็จ'),
    });
  }

  private filters(): ProjectFilters {
    return {
      budget_year: this.selectedYear(),
      subdistrict_id: this.selectedSubdistrictId(),
      risk_level: this.selectedRiskLevel(),
    };
  }

  private topProjectTypes(): string[] {
    const counts = new Map<string, number>();
    this.multiYearProjects().forEach((project) => {
      const type = this.projectType(project);
      counts.set(type, (counts.get(type) ?? 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type]) => type);
  }

  private projectType(project: Project): string {
    return project.project_type || project.purchase_method_group || 'ไม่ระบุประเภท';
  }

  private vendorDisplayName(project: Project): string {
    return (
      project.winner_name ||
      project.vendor_name ||
      project.contractor_name ||
      project.supplier_name ||
      project.bidder_name ||
      'ไม่ระบุผู้รับจ้าง'
    );
  }

  private entityLabel(project: Project): string {
    return (
      project.vendor_name ||
      project.contractor_name ||
      project.supplier_name ||
      project.purchase_method_group ||
      project.project_type ||
      'ไม่ระบุรายการ'
    );
  }

  private subdistrictName(id: number): string {
    return subdistrictLabel(this.subdistricts().find((subdistrict) => subdistrict.subdistrict_id === id));
  }
}
