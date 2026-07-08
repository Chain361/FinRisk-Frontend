import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { Project, ProjectFilters, RiskSummary, Subdistrict } from '../../core/models/domain.models';
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
} from '../../shared/utils/risk-utils';

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
            <h2 class="text-base font-semibold">Time Series จำนวนโครงการตามระดับความเสี่ยง</h2>
            <p class="text-sm text-slate-500">ปีที่ไม่มีโครงการจะแสดงเป็น 0 จริง ไม่ใช่ข้อมูลขาด</p>
          </div>
          <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
            2566-2568
          </span>
        </div>
        <app-time-series-chart [series]="riskSeries()" yAxisName="จำนวนโครงการ" />
      </section>

      <section class="panel overflow-hidden">
        <div class="border-b border-slate-200 p-4">
          <h2 class="text-base font-semibold">รายการโครงการเรียงตาม Risk Score</h2>
          <p class="text-sm text-slate-500">ใช้ /projects และกรองตามปี ตำบล ระดับความเสี่ยง</p>
        </div>

        @if (loading()) {
          <div class="p-6 text-sm text-slate-500">กำลังโหลดข้อมูล...</div>
        } @else if (!sortedProjects().length) {
          <div class="p-4">
            <app-empty-state title="ไม่พบโครงการในตัวกรองนี้" message="ลองเลือกปีหรือตำบลอื่นเพื่อดูความเสี่ยง" />
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200 text-sm">
              <thead class="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th class="px-4 py-3">โครงการ</th>
                  <th class="px-4 py-3">ปี</th>
                  <th class="px-4 py-3">ประเภท</th>
                  <th class="px-4 py-3 text-right">งบประมาณ</th>
                  <th class="px-4 py-3 text-right">ราคา/อ้างอิง</th>
                  <th class="px-4 py-3 text-right">Risk Score</th>
                  <th class="px-4 py-3">ระดับ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                @for (project of sortedProjects(); track project.project_id) {
                  <tr class="hover:bg-slate-50">
                    <td class="max-w-md px-4 py-3">
                      <p class="font-semibold text-slate-900">{{ project.project_name }}</p>
                      <p class="text-xs text-slate-500">ID {{ project.project_id }}</p>
                    </td>
                    <td class="px-4 py-3">{{ project.budget_year }}</td>
                    <td class="px-4 py-3">{{ project.project_type || project.purchase_method_group || '-' }}</td>
                    <td class="px-4 py-3 text-right">{{ money(project.budget_amount) }}</td>
                    <td class="px-4 py-3 text-right">{{ number(project.price_ratio, 3) }}</td>
                    <td class="px-4 py-3 text-right font-semibold">{{ number(project.risk_score, 2) }}</td>
                    <td class="px-4 py-3"><app-risk-badge [level]="project.risk_level" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </section>
  `,
})
export class ProjectRiskPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading = signal(false);
  readonly error = signal('');
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly heatmapProjects = signal<Project[]>([]);
  readonly summary = signal<RiskSummary | null>(null);
  readonly riskSeries = signal<TimeSeries[]>([]);

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

  ngOnInit(): void {
    this.loadSubdistricts();
    this.loadDashboard();
    this.loadTimeSeries();
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

  private filters(): ProjectFilters {
    return {
      budget_year: this.selectedYear(),
      subdistrict_id: this.selectedSubdistrictId(),
      risk_level: this.selectedRiskLevel(),
    };
  }
}
