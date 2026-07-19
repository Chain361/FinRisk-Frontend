import { computed, inject, Injectable, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import {
  AnnualRisk,
  Project,
  ProjectFilters,
  RiskSummary,
  Subdistrict,
} from '../../core/models/domain.models';
import { BarChartSeries } from '../../shared/charts/bar-chart.component';
import { CHART_SERIES_COLORS, RISK_SERIES } from '../../shared/utils/design-tokens';
import {
  countByRisk,
  FISCAL_YEARS,
  formatMoney,
  formatNumber,
  normalizeRiskLevel,
  sortProjectsByRisk,
  subdistrictLabel,
  toBool,
  toNumber,
} from '../../shared/utils/risk-utils';

export interface VendorRanking {
  vendorName: string;
  projectCount: number;
  winCount: number;
  totalContractValue: number;
  sampleProjects: string[];
  years: number[];
  isRecurring: boolean;
  isFrequentWinner: boolean;
}

export interface CrossTabRow {
  type: string;
  high: number;
  medium: number;
  low: number;
  total: number;
}

export interface RepeatedEntity {
  label: string;
  years: number[];
  count: number;
  totalBudget: number;
}

export interface Anomaly {
  project: Project;
  reason: string;
}

/**
 * State ที่ใช้ร่วมกันระหว่างหน้า Overview และ Analysis
 * Service นี้ทำให้เปลี่ยนตัวกรองหน้าใดหน้าหนึ่งแล้วข้อมูลในอีกหน้าตรงกันเสมอ
 */
@Injectable({ providedIn: 'root' })
export class ProjectRiskStateService {
  private readonly api = inject(ApiService);
  private initialized = false;

  readonly fiscalYearLabels = FISCAL_YEARS.map(String);
  readonly FISCAL_YEARS = FISCAL_YEARS;

  readonly loading = signal(false);
  readonly error = signal('');
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly multiYearProjects = signal<Project[]>([]);
  readonly summary = signal<RiskSummary | null>(null);
  readonly annualRisks = signal<AnnualRisk[]>([]);

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

  /** Query params สำหรับส่งตัวกรองเดิมไปยังอีกหน้า */
  readonly routeQueryParams = computed(() => {
    const params: Record<string, string | number> = {};
    const year = this.selectedYear();
    const subdistrictId = this.selectedSubdistrictId();
    const risk = this.selectedRiskLevel();

    if (year !== null) params['year'] = year;
    if (subdistrictId !== null) params['subdistrictId'] = subdistrictId;
    if (risk !== null) params['risk'] = risk;
    return params;
  });

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

  /** เก็บไว้สำหรับส่วนที่ต้องแสดงโครงการเรียงจากความเสี่ยงสูงไปต่ำ */
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

  readonly riskLevelTrendBarSeries = computed<BarChartSeries[]>(() =>
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
      if (type !== 'ไม่ระบุประเภท') types.add(type);
    });
    return [...types].sort((a, b) => a.localeCompare(b, 'th'));
  });

  readonly filteredVendorProjects = computed(() => {
    const search = this.vendorSearchText().trim().toLowerCase();
    return this.projects().filter((project) => {
      const typeMatches =
        !this.selectedProjectType() ||
        this.projectTypeLabel(project) === this.selectedProjectType();
      const searchMatches =
        !search || this.vendorDisplayName(project).toLowerCase().includes(search);
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
      const vendorName = this.vendorDisplayName(project);
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
      if (project.project_name) current.sampleProjects.push(project.project_name);
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

  readonly scopedProjects = computed(() => this.multiYearProjects());

  readonly scopedAnnualRisks = computed(() => {
    const subdistrictId = this.selectedSubdistrictId();
    return this.annualRisks().filter(
      (row) => !subdistrictId || row.subdistrict_id === subdistrictId,
    );
  });

  readonly averageBudgetBarSeries = computed<BarChartSeries[]>(() => {
    const topTypes = this.topProjectTypes();
    return topTypes.map((type, index) => ({
      name: type,
      color: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
      values: FISCAL_YEARS.map((year) => {
        const projects = this.scopedProjects().filter(
          (project) => project.budget_year === year && this.projectTypeLabel(project) === type,
        );
        const values = projects
          .map((project) => toNumber(project.budget_amount))
          .filter((value): value is number => value !== null);
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      }),
    }));
  });

  readonly riskTrendBarSeries = computed<BarChartSeries[]>(() => {
    if (this.selectedSubdistrictId()) {
      return RISK_SERIES.map((item) => ({
        name: item.name,
        color: item.color,
        values: FISCAL_YEARS.map(
          (year) =>
            this.scopedProjects().filter(
              (project) =>
                project.budget_year === year &&
                normalizeRiskLevel(project.risk_level) === item.level,
            ).length,
        ),
      }));
    }

    const ids = [...new Set(this.scopedProjects().map((project) => project.subdistrict_id))];
    return ids.map((id, index) => ({
      name: this.subdistrictName(id),
      color: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
      values: FISCAL_YEARS.map(
        (year) =>
          this.scopedProjects().filter(
            (project) =>
              project.budget_year === year &&
              project.subdistrict_id === id &&
              normalizeRiskLevel(project.risk_level) === 'high',
          ).length,
      ),
    }));
  });

  readonly repeatedEntities = computed<RepeatedEntity[]>(() => {
    const groups = new Map<string, { years: Set<number>; count: number; totalBudget: number }>();
    this.scopedProjects().forEach((project) => {
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

  /** โครงการที่เข้าเกณฑ์เสี่ยงสูง คะแนนสูง หรือราคาเบี่ยงจากราคากลางมาก */
  readonly anomalies = computed<Anomaly[]>(() =>
    this.scopedProjects()
      .map((project) => ({ project, reason: this.anomalyReason(project) }))
      .filter((item) => Boolean(item.reason))
      .sort(
        (a, b) =>
          (toNumber(b.project.risk_score) ?? 0) - (toNumber(a.project.risk_score) ?? 0),
      )
      .slice(0, 12),
  );

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.loadSubdistricts();
    this.loadAnnualRisk();
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

  annualRowsForYear(year: number): AnnualRisk[] {
    return this.scopedAnnualRisks().filter((row) => row.fiscal_year === year);
  }

  annualComputableCount(year: number): number {
    return this.annualRowsForYear(year).filter((row) => toBool(row.computable)).length;
  }

  annualHighCount(year: number): number {
    return this.annualRowsForYear(year).filter(
      (row) => normalizeRiskLevel(row.risk_level) === 'high',
    ).length;
  }

  annualNotComputableCount(year: number): number {
    return this.annualRowsForYear(year).filter((row) => !toBool(row.computable)).length;
  }

  private loadAnnualRisk(): void {
    this.api.annualRisk().subscribe({
      next: (rows) => this.annualRisks.set(rows),
      error: () => this.error.set('โหลดข้อมูล Financial Risk Coverage ไม่สำเร็จ'),
    });
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
        this.error.set('โหลดข้อมูล Project Risk ไม่สำเร็จ กรุณาตรวจสอบ backend และ X-Username');
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
    const types = new Set<string>();
    projects.forEach((project) => types.add(this.projectTypeLabel(project)));
    return [...types].sort((a, b) => a.localeCompare(b, 'th'));
  }

  private topProjectTypes(): string[] {
    const counts = new Map<string, number>();
    this.scopedProjects().forEach((project) => {
      const type = this.projectTypeLabel(project);
      counts.set(type, (counts.get(type) ?? 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([type]) => type);
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
    return subdistrictLabel(
      this.subdistricts().find((subdistrict) => subdistrict.subdistrict_id === id),
    );
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

  private anomalyReason(project: Project): string {
    const reasons: string[] = [];
    const ratio = toNumber(project.price_ratio);
    const score = toNumber(project.risk_score);

    if (normalizeRiskLevel(project.risk_level) === 'high') {
      reasons.push('ระดับความเสี่ยงสูง');
    }
    if (score !== null && score >= 70) {
      reasons.push('คะแนนความเสี่ยงตั้งแต่ 70');
    }
    if (ratio !== null && (ratio >= 1.15 || ratio <= 0.85)) {
      reasons.push('อัตราส่วนราคาเบี่ยงจากราคากลางมาก');
    }

    return reasons.join(' · ');
  }
}
