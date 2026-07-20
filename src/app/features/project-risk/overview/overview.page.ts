import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import {
  Project,
  ProjectFilters,
  RiskSummary,
  Subdistrict,
} from '../../../core/models/domain.models';
import { BarChartComponent, BarChartSeries } from '../../../shared/charts/bar-chart.component';
import { FilterBarComponent } from '../../../shared/filters/filter-bar.component';
import { AnnouncementPanelComponent } from '../../../shared/ui/announcement-panel.component';
import { KpiCardComponent } from '../../../shared/ui/kpi-card.component';
import { CHART_SERIES_COLORS, RISK_SERIES } from '../../../shared/utils/design-tokens';
import {
  countByRisk,
  FISCAL_YEARS,
  normalizeRiskLevel,
  toNumber,
} from '../../../shared/utils/risk-utils';

interface CrossTabRow {
  type: string;
  high: number;
  medium: number;
  low: number;
  total: number;
}

@Component({
  selector: 'app-overview-page',
  standalone: true,
  imports: [AnnouncementPanelComponent, BarChartComponent, FilterBarComponent, KpiCardComponent],
  template: `
    <section class="page-shell">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F1.1</p>
          <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">
            ภาพรวมสุขภาพความเสี่ยงโครงการ
          </h1>
          <p class="m-0 mt-1.5 text-sm text-muted">
            ภาพรวมจำนวนโครงการ ระดับความเสี่ยง และแนวโน้มงบประมาณ
          </p>
        </div>
      </div>

      <app-announcement-panel />

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
        <p
          class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high"
        >
          {{ error() }}
        </p>
      }

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <app-kpi-card
          label="โครงการทั้งหมด"
          [value]="totalProjects()"
          hint=""
          accentClass="bg-navy"
        />
        <app-kpi-card
          label="เสี่ยงสูง"
          [value]="byLevel()['high'] ?? 0"
          hint=""
          accentClass="bg-risk-high"
        />
        <app-kpi-card
          label="เสี่ยงปานกลาง"
          [value]="byLevel()['medium'] ?? 0"
          hint=""
          accentClass="bg-risk-medium"
        />
        <app-kpi-card
          label="เสี่ยงต่ำ"
          [value]="byLevel()['low'] ?? 0"
          hint=""
          accentClass="bg-risk-low"
        />
      </div>

      <section class="panel p-[18px]">
        <h2 class="m-0 mb-0.5 text-[16px] font-bold text-ink">สัดส่วนความเสี่ยงตามประเภทโครงการ</h2>
        <p class="m-0 mb-3.5 text-[13px] text-muted">
          ตารางไขว้ระหว่างประเภทโครงการและระดับความเสี่ยง
        </p>
        <div class="overflow-x-auto">
          <table class="gov-table">
            <thead>
              <tr>
                <th>ประเภทโครงการ</th>
                <th class="text-right!">เสี่ยงสูง</th>
                <th class="text-right!">เสี่ยงปานกลาง</th>
                <th class="text-right!">เสี่ยงต่ำ</th>
                <th class="text-right!">รวม</th>
              </tr>
            </thead>
            <tbody>
              @for (row of crossTab().rows; track row.type) {
                <tr>
                  <td class="font-bold">{{ row.type }}</td>
                  <td class="text-right">{{ row.high }}</td>
                  <td class="text-right">{{ row.medium }}</td>
                  <td class="text-right">{{ row.low }}</td>
                  <td class="text-right font-bold">{{ row.total }}</td>
                </tr>
              }
              <tr class="bg-row-active! font-extrabold">
                <td>รวมทั้งหมด</td>
                <td class="text-right">{{ crossTab().totals.high }}</td>
                <td class="text-right">{{ crossTab().totals.medium }}</td>
                <td class="text-right">{{ crossTab().totals.low }}</td>
                <td class="text-right">{{ crossTab().totals.total }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <app-bar-chart
        title="แนวโน้มจำนวนโครงการตามระดับความเสี่ยง (ปี 2566–2568)"
        subtitle="ปีที่ไม่มีโครงการจะแสดงเป็น 0"
        [categories]="fiscalYearLabels"
        [series]="riskLevelTrendBarSeries()"
        unitSuffix="โครงการ"
      />
      <app-bar-chart
        title="งบประมาณรวมแต่ละปี แบ่งตามประเภทโครงการ"
        subtitle="เปรียบเทียบงบประมาณของแต่ละประเภทโครงการในแต่ละปี"
        [categories]="fiscalYearLabels"
        [series]="budgetByTypeBarSeries()"
        unitSuffix="บาท"
        rowHeader="ประเภทโครงการ"
        [compactValueLabels]="true"
      />
    </section>
  `,
})
export class OverviewPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly fiscalYearLabels = FISCAL_YEARS.map(String);
  readonly error = signal('');
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly multiYearProjects = signal<Project[]>([]);
  readonly summary = signal<RiskSummary | null>(null);
  readonly selectedSubdistrictId = signal<number | null>(null);
  readonly selectedYear = signal<number | null>(2568);
  readonly selectedRiskLevel = signal<string | null>(null);

  readonly hasActiveFilter = computed(
    () =>
      Boolean(this.selectedSubdistrictId()) ||
      Boolean(this.selectedYear()) ||
      Boolean(this.selectedRiskLevel()),
  );
  readonly byLevel = computed<Record<string, number | undefined>>(() =>
    this.hasActiveFilter()
      ? countByRisk(this.projects())
      : (this.summary()?.by_level ?? countByRisk(this.projects())),
  );
  readonly totalProjects = computed(() =>
    this.hasActiveFilter()
      ? this.projects().length
      : (this.summary()?.total ?? this.projects().length),
  );
  readonly crossTab = computed<{ rows: CrossTabRow[]; totals: CrossTabRow }>(() => {
    const groups = new Map<string, { high: number; medium: number; low: number }>();
    this.projects().forEach((project) => {
      const type = this.projectTypeLabel(project);
      const count = groups.get(type) ?? { high: 0, medium: 0, low: 0 };
      const level = normalizeRiskLevel(project.risk_level);
      if (level === 'high' || level === 'medium' || level === 'low') count[level] += 1;
      groups.set(type, count);
    });
    const rows = [...groups.entries()]
      .map(([type, count]) => ({ type, ...count, total: count.high + count.medium + count.low }))
      .sort((a, b) => b.total - a.total);
    const totals = rows.reduce(
      (total, row) => ({
        type: 'รวมทั้งหมด',
        high: total.high + row.high,
        medium: total.medium + row.medium,
        low: total.low + row.low,
        total: total.total + row.total,
      }),
      { type: 'รวมทั้งหมด', high: 0, medium: 0, low: 0, total: 0 },
    );
    return { rows, totals };
  });
  readonly riskLevelTrendBarSeries = computed<BarChartSeries[]>(() =>
    RISK_SERIES.map((risk) => ({
      name: risk.name,
      color: risk.color,
      values: FISCAL_YEARS.map(
        (year) =>
          this.multiYearProjects().filter(
            (project) =>
              project.budget_year === year && normalizeRiskLevel(project.risk_level) === risk.level,
          ).length,
      ),
    })),
  );
  readonly budgetByTypeBarSeries = computed<BarChartSeries[]>(() =>
    this.distinctProjectTypes(this.multiYearProjects()).map((type, index) => ({
      name: type,
      color: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
      values: FISCAL_YEARS.map((year) =>
        this.multiYearProjects()
          .filter(
            (project) => project.budget_year === year && this.projectTypeLabel(project) === type,
          )
          .reduce((sum, project) => sum + (toNumber(project.budget_amount) ?? 0), 0),
      ),
    })),
  );

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
  private loadSubdistricts(): void {
    this.api.subdistricts().subscribe({
      next: (rows) => this.subdistricts.set(rows),
      error: () => this.error.set('โหลดรายการตำบลไม่สำเร็จ'),
    });
  }
  private loadDashboard(): void {
    this.error.set('');
    forkJoin({
      summary: this.api.riskSummary(this.filters()),
      projects: this.api.projects(this.filters()),
    }).subscribe({
      next: ({ summary, projects }) => {
        this.summary.set(summary);
        this.projects.set(projects);
      },
      error: () => this.error.set('โหลดข้อมูล Project Risk ไม่สำเร็จ'),
    });
  }
  private loadTimeSeries(): void {
    const subdistrictId = this.selectedSubdistrictId();
    forkJoin(
      FISCAL_YEARS.map((year) =>
        this.api.projects({ budget_year: year, subdistrict_id: subdistrictId }),
      ),
    ).subscribe({
      next: (rows) => this.multiYearProjects.set(rows.flat()),
      error: () => this.error.set('โหลดข้อมูลโครงการย้อนหลังไม่สำเร็จ'),
    });
  }
  private filters(): ProjectFilters {
    return {
      budget_year: this.selectedYear(),
      subdistrict_id: this.selectedSubdistrictId(),
      risk_level: this.selectedRiskLevel(),
    };
  }
  private projectTypeLabel(project: Project): string {
    return project.project_type || project.purchase_method_group || 'ไม่ระบุประเภท';
  }
  private distinctProjectTypes(projects: Project[]): string[] {
    return [...new Set(projects.map((project) => this.projectTypeLabel(project)))].sort((a, b) =>
      a.localeCompare(b, 'th'),
    );
  }
}
