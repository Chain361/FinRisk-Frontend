import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { Project, ProjectFilters, RiskSummary, Subdistrict } from '../../core/models/domain.models';
import { BarChartComponent, BarChartSeries } from '../../shared/charts/bar-chart.component';
import { FilterBarComponent } from '../../shared/filters/filter-bar.component';
import { AnnouncementPanelComponent } from '../../shared/ui/announcement-panel.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { KpiCardComponent } from '../../shared/ui/kpi-card.component';
import { RiskBadgeComponent } from '../../shared/ui/risk-badge.component';
import { StepperComponent, StepperStep } from '../../shared/ui/stepper.component';
import { CHART_SERIES_COLORS, RISK_SERIES } from '../../shared/utils/design-tokens';
import {
  countByRisk,
  FISCAL_YEARS,
  formatMoney,
  formatNumber,
  normalizeRiskLevel,
  sortProjectsByRisk,
} from '../../shared/utils/risk-utils';
import { toNumber } from '../../shared/utils/risk-utils';

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

interface CrossTabRow {
  type: string;
  high: number;
  medium: number;
  low: number;
  total: number;
}

@Component({
  selector: 'app-project-risk-page',
  standalone: true,
  imports: [
    AnnouncementPanelComponent,
    BarChartComponent,
    EmptyStateComponent,
    FilterBarComponent,
    KpiCardComponent,
    RiskBadgeComponent,
    StepperComponent,
  ],
  template: `
    <section class="page-shell">
      <div>
        <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F1</p>
        <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">Project Risk Dashboard</h1>
        <p class="m-0 mt-1.5 text-sm text-muted">
          สรุปจำนวนโครงการตามระดับความเสี่ยง และรายการที่ควรตรวจสอบต่อ
        </p>
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
          hint="ตาม scope และตัวกรองปัจจุบัน"
          accentClass="bg-navy"
        />
        <app-kpi-card
          label="เสี่ยงสูง"
          [value]="byLevel()['high'] ?? 0"
          hint="ต้องตรวจหลักฐานเพิ่มเติม"
          accentClass="bg-risk-high"
        />
        <app-kpi-card
          label="เสี่ยงปานกลาง"
          [value]="byLevel()['medium'] ?? 0"
          hint="มีสัญญาณบางส่วน"
          accentClass="bg-risk-medium"
        />
        <app-kpi-card
          label="เสี่ยงต่ำ"
          [value]="byLevel()['low'] ?? 0"
          hint="ยังไม่ใช่คำตัดสิน"
          accentClass="bg-risk-low"
        />
      </div>

      <section class="panel px-[26px] py-5">
        <h2 class="m-0 mb-1 text-[16px] font-bold text-ink">
          ตัวอย่างสถานะกระบวนการอนุมัติงบประมาณโครงการ
        </h2>
        <p class="m-0 mb-5 text-[13px] text-muted">
          โครงการก่อสร้างถนนคอนกรีตเสริมเหล็ก สายบ้านหนองบัว-บ้านโคก (PRJ-2568-014)
        </p>
        <app-stepper [steps]="approvalSteps" />
      </section>

      <section class="panel p-[18px]">
        <h2 class="m-0 mb-0.5 text-[16px] font-bold text-ink">สัดส่วนความเสี่ยงตามประเภทโครงการ</h2>
        <p class="m-0 mb-3.5 text-[13px] text-muted">
          ตารางไขว้ระหว่างประเภทโครงการและระดับความเสี่ยง (จำนวนโครงการ)
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
        title="แนวโน้มจำนวนโครงการตามระดับความเสี่ยง (ปี 2566-2568)"
        subtitle="ปีที่ไม่มีโครงการจะแสดงเป็น 0 จริง ไม่ใช่ข้อมูลขาด"
        [categories]="fiscalYearLabels"
        [series]="riskTrendBarSeries()"
        unitSuffix="โครงการ"
      />

      <app-bar-chart
        title="งบประมาณรวมแต่ละปี (แบ่งตามประเภทโครงการ)"
        subtitle="แยกตามประเภทโครงการเพื่อดูว่าแต่ละประเภทใช้จ่ายงบประมาณอย่างไรในแต่ละปี"
        [categories]="fiscalYearLabels"
        [series]="budgetByTypeBarSeries()"
        unitSuffix="บาท"
        rowHeader="ประเภทโครงการ"
        [compactValueLabels]="true"
      />
    </section>
  `,
})
export class ProjectRiskPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly fiscalYearLabels = FISCAL_YEARS.map(String);

  readonly approvalSteps: StepperStep[] = [
    { label: 'สร้างคำขอ', state: 'done' },
    { label: 'รอ อปท. ตรวจสอบ', state: 'done' },
    { label: 'อนุมัติ', state: 'current' },
    { label: 'เบิกจ่าย', state: 'upcoming' },
  ];

  readonly loading = signal(false);
  readonly error = signal('');
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly multiYearProjects = signal<Project[]>([]);
  readonly summary = signal<RiskSummary | null>(null);

  readonly selectedSubdistrictId = signal<number | null>(null);
  readonly selectedYear = signal<number | null>(2568);
  readonly selectedRiskLevel = signal<string | null>(null);
  readonly selectedProjectType = signal<string | null>(null);
  readonly vendorSearchText = signal('');

  readonly hasActiveFilter = computed(
    () =>
      Boolean(this.selectedSubdistrictId()) ||
      Boolean(this.selectedYear()) ||
      Boolean(this.selectedRiskLevel()),
  );

  readonly byLevel = computed<Record<string, number | undefined>>(() => {
    if (this.hasActiveFilter()) {
      return countByRisk(this.projects());
    }
    return this.summary()?.by_level ?? countByRisk(this.projects());
  });

  readonly totalProjects = computed(() =>
    this.hasActiveFilter()
      ? this.projects().length
      : (this.summary()?.total ?? this.projects().length),
  );

  readonly sortedProjects = computed(() => sortProjectsByRisk(this.projects()));

  readonly crossTab = computed<{ rows: CrossTabRow[]; totals: CrossTabRow }>(() => {
    const groups = new Map<string, { high: number; medium: number; low: number }>();
    this.projects().forEach((project) => {
      const type = this.projectTypeLabel(project);
      const current = groups.get(type) ?? { high: 0, medium: 0, low: 0 };
      const level = normalizeRiskLevel(project.risk_level);
      if (level === 'high' || level === 'medium' || level === 'low') {
        current[level] += 1;
      }
      groups.set(type, current);
    });

    const rows = [...groups.entries()]
      .map(([type, counts]) => ({
        type,
        ...counts,
        total: counts.high + counts.medium + counts.low,
      }))
      .sort((a, b) => b.total - a.total);

    const totals = rows.reduce(
      (acc, row) => ({
        type: 'รวมทั้งหมด',
        high: acc.high + row.high,
        medium: acc.medium + row.medium,
        low: acc.low + row.low,
        total: acc.total + row.total,
      }),
      { type: 'รวมทั้งหมด', high: 0, medium: 0, low: 0, total: 0 },
    );

    return { rows, totals };
  });

  readonly riskTrendBarSeries = computed<BarChartSeries[]>(() =>
    RISK_SERIES.map((item) => ({
      name: item.name,
      color: item.color,
      values: FISCAL_YEARS.map(
        (year) =>
          this.multiYearProjects().filter(
            (project) =>
              project.budget_year === year && normalizeRiskLevel(project.risk_level) === item.level,
          ).length,
      ),
    })),
  );

  readonly budgetByTypeBarSeries = computed<BarChartSeries[]>(() => {
    const types = this.distinctProjectTypes(this.multiYearProjects());
    return types.map((type, index) => ({
      name: type,
      color: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
      values: FISCAL_YEARS.map((year) =>
        this.multiYearProjects()
          .filter(
            (project) => project.budget_year === year && this.projectTypeLabel(project) === type,
          )
          .reduce((sum, project) => sum + (toNumber(project.budget_amount) ?? 0), 0),
      ),
    }));
  });

  readonly projectTypes = computed<string[]>(() => {
    const types = new Set<string>();
    this.projects().forEach((project) => {
      const type = this.projectTypeLabel(project);
      if (type && type !== 'ไม่ระบุประเภท') {
        types.add(type);
      }
    });
    return [...types].sort((a, b) => a.localeCompare(b, 'th'));
  });

  readonly filteredVendorProjects = computed(() => {
    const search = this.vendorSearchText().trim().toLowerCase();
    return this.projects().filter((project) => {
      const typeMatches =
        !this.selectedProjectType() ||
        this.projectTypeLabel(project) === this.selectedProjectType();
      const vendorName = this.vendorDisplayName(project).toLowerCase();
      const searchMatches = !search || vendorName.includes(search);
      return typeMatches && searchMatches;
    });
  });

  readonly vendorRankings = computed<VendorRanking[]>(() => {
    const groups = new Map<
      string,
      {
        years: Set<number>;
        projectCount: number;
        totalContractValue: number;
        sampleProjects: string[];
      }
    >();

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
      current.totalContractValue +=
        toNumber(
          project.contract_value ??
            project.contract_price ??
            project.contract_amount ??
            project.winning_price ??
            project.budget_amount,
        ) ?? 0;
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
      .sort(
        (a, b) =>
          b.projectCount - a.projectCount ||
          b.totalContractValue - a.totalContractValue ||
          a.vendorName.localeCompare(b.vendorName, 'th'),
      )
      .slice(0, 10);
  });

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

  projectTypeLabel(project: Project): string {
    return project.project_type || project.purchase_method_group || 'ไม่ระบุประเภท';
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
    const requests = FISCAL_YEARS.map((year) =>
      this.api.projects({ budget_year: year, subdistrict_id: subdistrictId }),
    );

    forkJoin(requests).subscribe({
      next: (rowsByYear) => this.multiYearProjects.set(rowsByYear.flat()),
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

  private distinctProjectTypes(projects: Project[]): string[] {
    const types = new Set<string>();
    projects.forEach((project) => {
      const type = this.projectTypeLabel(project);
      if (type) {
        types.add(type);
      }
    });
    return [...types].sort((a, b) => a.localeCompare(b, 'th'));
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
}
