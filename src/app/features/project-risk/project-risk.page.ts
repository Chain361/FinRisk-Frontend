import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import {
  AnnualRisk,
  Project,
  ProjectFilters,
  RiskSummary,
  Subdistrict,
} from '../../core/models/domain.models';
import { BarChartComponent, BarChartSeries } from '../../shared/charts/bar-chart.component';
import { FilterBarComponent } from '../../shared/filters/filter-bar.component';
import { AnnouncementPanelComponent } from '../../shared/ui/announcement-panel.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { KpiCardComponent } from '../../shared/ui/kpi-card.component';
import { RiskBadgeComponent } from '../../shared/ui/risk-badge.component';
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

interface RepeatedEntity {
  label: string;
  years: number[];
  count: number;
  totalBudget: number;
}

interface Anomaly {
  project: Project;
  reason: string;
}

@Component({
  selector: 'app-project-risk-page',
  standalone: true,
  imports: [
    AnnouncementPanelComponent,
    BarChartComponent,
    EmptyStateComponent,
    FilterBarComponent,
    KpiCardComponent
  ],
  template: `
    <section class="page-shell">
      <div>
        <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F1</p>
        <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">แดชบอร์ดความเสี่ยงโครงการ</h1>
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
        [series]="riskLevelTrendBarSeries()"
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

      <div class="grid gap-4 xl:grid-cols-2">
        <app-bar-chart
          [title]="
            'งบเฉลี่ยตามประเภทโครงการ (ปี ' +
            FISCAL_YEARS[0] +
            '-' +
            FISCAL_YEARS[FISCAL_YEARS.length - 1] +
            ')'
          "
          subtitle="ปีที่ไม่มีโครงการประเภทนั้นจะเว้นช่อง ไม่แทนค่า 0"
          [categories]="fiscalYearLabels"
          [series]="averageBudgetBarSeries()"
          unitSuffix="บาท"
          rowHeader="ประเภทโครงการ"
          [compactValueLabels]="true"
        />

        <app-bar-chart
          [title]="
            selectedSubdistrictId()
              ? 'ความเสี่ยงข้ามปี (ตำบลที่เลือก)'
              : 'ความเสี่ยงข้ามปี (ทุกตำบล)'
          "
          [subtitle]="
            selectedSubdistrictId()
              ? 'จำนวนโครงการตามระดับความเสี่ยงรายปี'
              : 'จำนวนโครงการเสี่ยงสูงรายปี แยกตามตำบล'
          "
          [categories]="fiscalYearLabels"
          [series]="riskTrendBarSeries()"
          unitSuffix="โครงการ"
          [rowHeader]="selectedSubdistrictId() ? 'ระดับความเสี่ยง' : 'ตำบล'"
        />
      </div>

      <section class="panel p-[18px]">
        <div class="mb-4">
          <h2 class="m-0 text-[16px] font-bold text-ink">ผู้รับจ้างที่ได้รับงานบ่อยที่สุด</h2>
          <p class="m-0 mt-1 text-[13px] text-muted">
            แสดง Top 10 Vendors ตามจำนวนโครงการที่ได้รับในช่วงตัวกรองที่เลือก
          </p>
        </div>

        <div class="mb-4 grid gap-3.5 md:grid-cols-[1.2fr_0.8fr]">
          <label class="block">
            <span class="text-[12.5px] font-bold text-muted">ค้นหาผู้รับจ้าง</span>
            <input
              type="search"
              class="gov-input mt-[5px]"
              placeholder="พิมพ์ชื่อผู้รับจ้าง"
              [value]="vendorSearchText()"
              (input)="setVendorSearch($any($event.target).value)"
            />
          </label>

          <label class="block">
            <span class="text-[12.5px] font-bold text-muted">ประเภทโครงการ</span>
            <select
              class="gov-select mt-[5px]"
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
          <app-empty-state
            title="ไม่พบข้อมูลผู้รับจ้างสำหรับตัวกรองที่เลือก"
            message="ลองเปลี่ยนตัวกรองปี/ตำบลหรือคำค้นหาผู้รับจ้างใหม่อีกครั้ง"
          />
        } @else {
          <div class="overflow-x-auto">
            <table class="gov-table min-w-[900px]">
              <thead>
                <tr>
                  <th>อันดับ</th>
                  <th>ผู้รับจ้าง</th>
                  <th class="text-right!">จำนวนโครงการ</th>
                  <th class="text-right!">จำนวนครั้งที่ชนะ</th>
                  <th class="text-right!">มูลค่าสัญญารวม</th>
                  <th>รายชื่อโครงการ</th>
                </tr>
              </thead>
              <tbody>
                @for (vendor of vendorRankings(); track vendor.vendorName) {
                  <tr>
                    <td class="font-bold">{{ $index + 1 }}</td>
                    <td>
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="font-bold text-ink">{{ vendor.vendorName }}</span>
                        @if (vendor.isRecurring) {
                          <span
                            class="rounded-[3px] bg-risk-low px-2 py-0.5 text-[11px] font-bold text-white"
                            >Recurring Vendor</span
                          >
                        }
                        @if (vendor.isFrequentWinner) {
                          <span
                            class="rounded-[3px] bg-chart-blue-deep px-2 py-0.5 text-[11px] font-bold text-white"
                            >Frequent Winner</span
                          >
                        }
                      </div>
                    </td>
                    <td class="text-right">{{ vendor.projectCount }}</td>
                    <td class="text-right">{{ vendor.winCount }}</td>
                    <td class="text-right">{{ money(vendor.totalContractValue) }}</td>
                    <td class="text-muted">
                      <div class="flex flex-wrap gap-1">
                        @for (projectName of vendor.sampleProjects; track projectName) {
                          <span
                            class="rounded-[3px] border border-line-soft bg-zebra px-2 py-0.5 text-xs"
                            >{{ projectName }}</span
                          >
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

      <div class="grid gap-3 md:grid-cols-1 xl:grid-cols-2">
        <section class="panel overflow-hidden">
          <div class="border-b-[1.5px] border-line px-[18px] py-4">
            <h2 class="m-0 text-[16px] font-bold text-ink">
              โครงการ/ผู้รับจ้าง/วิธีจัดซื้อที่ซ้ำข้ามปี
            </h2>
            <p class="m-0 mt-1 text-[13px] text-muted">
              นับจากผู้รับจ้างที่ปรากฏตั้งแต่ 2 ปีงบประมาณขึ้นไป
            </p>
          </div>

          @if (!repeatedEntities().length) {
            <div class="p-4">
              <app-empty-state
                title="ยังไม่พบรายการซ้ำ ≥ 2 ปี"
                message="ข้อมูลใน scope ปัจจุบันอาจมีปีเดียวหรือไม่มี vendor field"
              />
            </div>
          } @else {
            <div class="overflow-x-auto">
              <table class="gov-table">
                <thead>
                  <tr>
                    <th>รายการ</th>
                    <th>ปีที่พบ</th>
                    <th class="text-right!">จำนวน</th>
                    <th class="text-right!">งบรวม (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  @for (entity of repeatedEntities(); track entity.label) {
                    <tr>
                      <td class="font-bold">{{ entity.label }}</td>
                      <td>{{ entity.years.join(', ') }}</td>
                      <td class="text-right">{{ entity.count }}</td>
                      <td class="text-right">{{ money(entity.totalBudget) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <section class="panel p-[18px]">
          <h2 class="m-0 mb-0.5 text-[16px] font-bold text-ink">Financial Risk Coverage</h2>
          <p class="m-0 mb-3.5 text-[13px] text-muted">
            สรุปจำนวนปัจจัยที่ตรวจสอบได้และประเมินไม่ได้รายปี
          </p>
          <div class="grid gap-3.5 grid-cols-3">
            @for (year of FISCAL_YEARS; track year) {
              <div class="rounded-[4px] border-[1.5px] border-line p-3.5">
                <div class="flex items-center justify-between">
                  <p class="m-0 text-sm font-extrabold text-ink">ปี {{ year }}</p>
                  <p class="m-0 text-xs text-muted">{{ annualRowsForYear(year).length }} factors</p>
                </div>
                <div class="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                  <div
                    class="rounded-[3px] border border-[#a9d9bb] bg-[#e9f6ee] px-1 py-2 text-[#0f5132]"
                  >
                    <p class="m-0 text-[16px] font-extrabold">{{ annualComputableCount(year) }}</p>
                    <p class="m-0 mt-0.5">คำนวณได้</p>
                  </div>
                  <div
                    class="rounded-[3px] border border-[#c7cfd8] bg-page px-1 py-2 text-slate-700"
                  >
                    <p class="m-0 text-[16px] font-extrabold">
                      {{ annualNotComputableCount(year) }}
                    </p>
                    <p class="m-0 mt-0.5">ประเมินไม่ได้</p>
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

  readonly fiscalYearLabels = FISCAL_YEARS.map(String);

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

  readonly FISCAL_YEARS = FISCAL_YEARS;
  readonly annualRisks = signal<AnnualRisk[]>([]);

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

  readonly anomalies = computed<Anomaly[]>(() =>
    this.scopedProjects()
      .map((project) => ({ project, reason: this.anomalyReason(project) }))
      .filter((item) => Boolean(item.reason))
      .sort((a, b) => (toNumber(b.project.risk_score) ?? 0) - (toNumber(a.project.risk_score) ?? 0))
      .slice(0, 12),
  );

  ngOnInit(): void {
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

  annualHighCount(year: number): number {
    return this.annualRowsForYear(year).filter(
      (row) => normalizeRiskLevel(row.risk_level) === 'high',
    ).length;
  }

  annualComputableCount(year: number): number {
    return this.annualRowsForYear(year).filter((row) => toBool(row.computable)).length;
  }

  annualNotComputableCount(year: number): number {
    return this.annualRowsForYear(year).filter((row) => !toBool(row.computable)).length;
  }

  projectTypeLabel(project: Project): string {
    return project.project_type || project.purchase_method_group || 'ไม่ระบุประเภท';
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

  private anomalyReason(project: Project): string {
    const reasons: string[] = [];
    const ratio = toNumber(project.price_ratio);
    const score = toNumber(project.risk_score);

    if (normalizeRiskLevel(project.risk_level) === 'high') {
      reasons.push('risk_level=high');
    }
    if (score !== null && score >= 70) {
      reasons.push('risk_score สูง');
    }
    if (ratio !== null && (ratio >= 1.15 || ratio <= 0.85)) {
      reasons.push('price_ratio ห่างจากราคากลางมาก');
    }

    return reasons.join(' · ');
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
}
