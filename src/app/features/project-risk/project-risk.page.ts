import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AnnualRisk, Project, ProjectFilters, RiskSummary, Subdistrict } from '../../core/models/domain.models';
import { RiskHeatmapComponent } from '../../shared/charts/risk-heatmap.component';
import { TimeSeries, TimeSeriesChartComponent } from '../../shared/charts/time-series-chart.component';
import { DonutChartComponent } from '../../shared/charts/donut-chart.component';
import { FilterBarComponent } from '../../shared/filters/filter-bar.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { KpiCardComponent } from '../../shared/ui/kpi-card.component';
import { RiskBadgeComponent } from '../../shared/ui/risk-badge.component';
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

@Component({
  selector: 'app-project-risk-page',
  standalone: true,
  imports: [
    DonutChartComponent,
    EmptyStateComponent,
    FilterBarComponent,
    KpiCardComponent,
    RiskBadgeComponent,
    RiskHeatmapComponent,
    TimeSeriesChartComponent,
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
        <app-kpi-card label="โครงการทั้งหมด" [value]="totalProjects()" hint="ตาม scope และตัวกรองปัจจุบัน" accentClass="bg-slate-900" />
        <app-kpi-card label="เสี่ยงสูง" [value]="byLevel()['high'] ?? 0" hint="ต้องตรวจ evidence ต่อ" accentClass="bg-red-500" />
        <app-kpi-card label="เสี่ยงปานกลาง" [value]="byLevel()['medium'] ?? 0" hint="มีสัญญาณบางส่วน" accentClass="bg-amber-500" />
        <app-kpi-card label="เสี่ยงต่ำ" [value]="byLevel()['low'] ?? 0" hint="ยังไม่ใช่คำตัดสิน" accentClass="bg-emerald-500" />
      </div>

      <div class="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section class="panel p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-semibold">สัดส่วนความเสี่ยง</h2>
              <p class="text-sm text-slate-500">ข้อมูลจาก /risk/summary หรือคำนวณจากรายการเมื่อมีตัวกรอง</p>
            </div>
          </div>
          <app-donut-chart [byLevel]="byLevel()" />
        </section>

        <section class="panel p-4">
          <div class="mb-3">
            <h2 class="text-base font-semibold">Risk Heatmap ตามปีงบประมาณ</h2>
            <p class="text-sm text-slate-500">นับจำนวนโครงการในแต่ละระดับความเสี่ยงจาก /projects</p>
          </div>
          <app-risk-heatmap [projects]="heatmapProjects()" />
        </section>
      </div>

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
  readonly heatmapProjects = signal<Project[]>([]);
  readonly summary = signal<RiskSummary | null>(null);
  readonly riskSeries = signal<TimeSeries[]>([]);
  readonly annualRisks = signal<AnnualRisk[]>([]);

  readonly selectedSubdistrictId = signal<number | null>(null);
  readonly selectedYear = signal<number | null>(2568);
  readonly selectedRiskLevel = signal<string | null>(null);

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
        const projects = this.heatmapProjects().filter((project) => project.budget_year === year && this.projectType(project) === type);
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
          value: this.heatmapProjects().filter(
            (project) => project.budget_year === year && normalizeRiskLevel(project.risk_level) === item.level,
          ).length,
          computable: true,
          tooltip: 'นับจาก /projects',
        })),
      }));
    }

    const ids = [...new Set(this.heatmapProjects().map((project) => project.subdistrict_id))];
    const colors = ['#dc2626', '#2563eb', '#0891b2', '#7c3aed', '#ea580c'];
    return ids.map((id, index) => ({
      name: this.subdistrictName(id),
      color: colors[index % colors.length],
      points: FISCAL_YEARS.map((year) => ({
        year,
        value: this.heatmapProjects().filter(
          (project) => project.budget_year === year && project.subdistrict_id === id && normalizeRiskLevel(project.risk_level) === 'high',
        ).length,
        computable: true,
        tooltip: 'จำนวนโครงการเสี่ยงสูง',
      })),
    }));
  });

  readonly repeatedEntities = computed<RepeatedEntity[]>(() => {
    const groups = new Map<string, { years: Set<number>; count: number; totalBudget: number }>();
    this.heatmapProjects().forEach((project) => {
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
    this.loadDashboard();
    this.loadTimeSeries();
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
        this.heatmapProjects.set(all);
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
    this.heatmapProjects().forEach((project) => {
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
