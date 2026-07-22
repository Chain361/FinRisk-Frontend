import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import {
  AnnualRisk,
  Project,
  ProjectFilters,
  Subdistrict,
} from '../../../core/models/domain.models';
import { BarChartComponent, BarChartSeries } from '../../../shared/charts/bar-chart.component';
import { FilterBarComponent } from '../../../shared/filters/filter-bar.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { CHART_SERIES_COLORS, RISK_SERIES } from '../../../shared/utils/design-tokens';
import {
  FISCAL_YEARS,
  formatMoney,
  normalizeRiskLevel,
  subdistrictLabel,
  toBool,
  toNumber,
} from '../../../shared/utils/risk-utils';

interface VendorRanking {
  vendorName: string;
  projectCount: number;
  winCount: number;
  totalContractValue: number;
  sampleProjects: string[];
  isRecurring: boolean;
  isFrequentWinner: boolean;
}
interface RepeatedEntity {
  label: string;
  years: number[];
  count: number;
  totalBudget: number;
}

@Component({
  selector: 'app-insights-page',
  standalone: true,
  imports: [BarChartComponent, EmptyStateComponent, FilterBarComponent],
  template: `
    <section class="page-shell">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F1.2</p>
          <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">{{ t('prInsights.title') }}</h1>
          <p class="m-0 mt-1.5 text-sm text-muted">{{ t('prInsights.subtitle') }}</p>
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
        <p
          class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high"
        >
          {{ error() }}
        </p>
      }

      <section class="panel p-[18px]">
        <div class="mb-4">
          <h2 class="m-0 text-[16px] font-bold text-ink">{{ t('prInsights.vendors.title') }}</h2>
          <p class="m-0 mt-1 text-[13px] text-muted">{{ t('prInsights.vendors.subtitle') }}</p>
        </div>
        <div class="mb-4 grid gap-3.5 md:grid-cols-[1.2fr_0.8fr]">
          <label class="block"
            ><span class="text-[12.5px] font-bold text-muted">{{
              t('prInsights.vendors.searchLabel')
            }}</span
            ><input
              type="search"
              class="gov-input mt-[5px]"
              [placeholder]="t('prInsights.vendors.searchPlaceholder')"
              [value]="vendorSearchText()"
              (input)="setVendorSearch($any($event.target).value)"
          /></label>
          <label class="block"
            ><span class="text-[12.5px] font-bold text-muted">{{ t('common.projectType') }}</span
            ><select
              class="gov-select mt-[5px]"
              [value]="selectedProjectType() ?? 'all'"
              (change)="setProjectType($any($event.target).value)"
            >
              <option value="all">{{ t('filter.allProjectTypes') }}</option>
              @for (type of projectTypes(); track type) {
                <option [value]="type">{{ type }}</option>
              }
            </select></label
          >
        </div>
        @if (!vendorRankings().length) {
          <app-empty-state
            [title]="t('prInsights.vendors.emptyTitle')"
            [message]="t('prInsights.vendors.emptyMsg')"
          />
        } @else {
          <div class="overflow-x-auto">
            <table class="gov-table min-w-[900px]">
              <thead>
                <tr>
                  <th>{{ t('prInsights.vendors.colRank') }}</th>
                  <th>{{ t('prInsights.vendors.colVendor') }}</th>
                  <th class="text-right!">{{ t('prInsights.vendors.colProjectCount') }}</th>
                  <th class="text-right!">{{ t('prInsights.vendors.colWinCount') }}</th>
                  <th class="text-right!">{{ t('prInsights.vendors.colContractValue') }}</th>
                  <th>{{ t('prInsights.vendors.colSamples') }}</th>
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
                            >{{ t('prInsights.vendors.recurring') }}</span
                          >
                        }
                        @if (vendor.isFrequentWinner) {
                          <span
                            class="rounded-[3px] bg-chart-blue-deep px-2 py-0.5 text-[11px] font-bold text-white"
                            >{{ t('prInsights.vendors.frequentWinner') }}</span
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

      <section class="panel overflow-hidden">
        <div class="border-b-[1.5px] border-line px-[18px] py-4">
          <h2 class="m-0 text-[16px] font-bold text-ink">{{ t('prInsights.repeated.title') }}</h2>
          <p class="m-0 mt-1 text-[13px] text-muted">{{ t('prInsights.repeated.subtitle') }}</p>
        </div>
        @if (!repeatedEntities().length) {
          <div class="p-4">
            <app-empty-state
              [title]="t('prInsights.repeated.emptyTitle')"
              [message]="t('prInsights.repeated.emptyMsg')"
            />
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="gov-table">
              <thead>
                <tr>
                  <th>{{ t('common.item') }}</th>
                  <th>{{ t('common.foundYears') }}</th>
                  <th class="text-right!">{{ t('common.count') }}</th>
                  <th class="text-right!">{{ t('common.totalBudgetBaht') }}</th>
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
        <div>
          <h2 class="m-0 text-[16px] font-bold text-ink">{{ t('prInsights.coverage.title') }}</h2>
          <p class="m-0 mt-1 text-[13px] text-muted">{{ t('prInsights.coverage.subtitle') }}</p>
        </div>

        @if (!scopedAnnualRisks().length) {
          <div class="py-10">
            <app-empty-state
              [title]="t('prInsights.coverage.emptyTitle')"
              [message]="t('prInsights.coverage.emptyMsg')"
            />
          </div>
        } @else {
          <div class="mt-5 grid gap-3.5 md:grid-cols-3">
            @for (year of FISCAL_YEARS; track year) {
              <div class="rounded-[4px] border-[1.5px] border-line p-4">
                <div class="flex items-center justify-between">
                  <p class="m-0 text-base font-extrabold text-ink">
                    {{ t('common.yearLabel', { year }) }}
                  </p>
                  <p class="m-0 text-xs text-muted">
                    {{ annualRowsForYear(year).length }} {{ t('common.factorsUnit') }}
                  </p>
                </div>
                <div class="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
                  <div
                    class="rounded-[3px] border border-[#a9d9bb] bg-[#e9f6ee] px-2 py-3 text-[#0f5132]"
                  >
                    <p class="m-0 text-[22px] font-extrabold">{{ annualComputableCount(year) }}</p>
                    <p class="m-0 mt-1 text-xs">{{ t('common.computable') }}</p>
                  </div>
                  <div
                    class="rounded-[3px] border border-[#c7cfd8] bg-page px-2 py-3 text-slate-700"
                  >
                    <p class="m-0 text-[22px] font-extrabold">
                      {{ annualNotComputableCount(year) }}
                    </p>
                    <p class="m-0 mt-1 text-xs">{{ t('common.cannotEvaluate') }}</p>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </section>

      <div class="grid gap-4 xl:grid-cols-2">
        <app-bar-chart
          [title]="
            t('trends.avgBudget.title', {
              from: FISCAL_YEARS[0],
              to: FISCAL_YEARS[FISCAL_YEARS.length - 1],
            })
          "
          [subtitle]="t('prInsights.avgBudget.subtitle')"
          [categories]="fiscalYearLabels"
          [series]="averageBudgetBarSeries()"
          [unitSuffix]="t('common.unit.baht')"
          [rowHeader]="t('common.projectType')"
          [compactValueLabels]="true"
        />
        <app-bar-chart
          [title]="
            selectedSubdistrictId()
              ? t('trends.riskCross.titleSelected')
              : t('trends.riskCross.titleAll')
          "
          [subtitle]="
            selectedSubdistrictId()
              ? t('trends.riskCross.subtitleSelected')
              : t('trends.riskCross.subtitleAll')
          "
          [categories]="fiscalYearLabels"
          [series]="riskTrendBarSeries()"
          [unitSuffix]="t('common.unit.project')"
          [rowHeader]="selectedSubdistrictId() ? t('filter.riskLevel') : t('common.subdistrict')"
        />
      </div>
    </section>
  `,
})
export class InsightsPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;
  readonly FISCAL_YEARS = FISCAL_YEARS;
  readonly fiscalYearLabels = FISCAL_YEARS.map(String);
  readonly error = signal('');
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly multiYearProjects = signal<Project[]>([]);
  readonly annualRisks = signal<AnnualRisk[]>([]);
  readonly selectedSubdistrictId = signal<number | null>(null);
  readonly selectedYear = signal<number | null>(2568);
  readonly selectedRiskLevel = signal<string | null>(null);
  readonly selectedProjectType = signal<string | null>(null);
  readonly vendorSearchText = signal('');

  readonly scopedAnnualRisks = computed(() =>
    this.annualRisks().filter(
      (row) => !this.selectedSubdistrictId() || row.subdistrict_id === this.selectedSubdistrictId(),
    ),
  );
  readonly projectTypes = computed(() =>
    [
      ...new Set(
        this.projects()
          .map((project) => this.projectTypeLabel(project))
          .filter((type) => type !== this.t('common.unspecifiedType')),
      ),
    ].sort((a, b) => a.localeCompare(b, 'th')),
  );
  readonly filteredVendorProjects = computed(() => {
    const search = this.vendorSearchText().trim().toLowerCase();
    return this.projects().filter(
      (project) =>
        (!this.selectedProjectType() ||
          this.projectTypeLabel(project) === this.selectedProjectType()) &&
        (!search || this.vendorDisplayName(project).toLowerCase().includes(search)),
    );
  });
  readonly vendorRankings = computed<VendorRanking[]>(() => {
    const groups = new Map<
      string,
      { years: Set<number>; projectCount: number; total: number; samples: string[] }
    >();
    this.filteredVendorProjects().forEach((project) => {
      const name = this.vendorDisplayName(project);
      const item = groups.get(name) ?? {
        years: new Set<number>(),
        projectCount: 0,
        total: 0,
        samples: [],
      };
      item.years.add(project.budget_year);
      item.projectCount += 1;
      item.total +=
        toNumber(
          project.contract_value ??
            project.contract_price ??
            project.contract_amount ??
            project.winning_price ??
            project.budget_amount,
        ) ?? 0;
      if (project.project_name) item.samples.push(project.project_name);
      groups.set(name, item);
    });
    return [...groups.entries()]
      .map(([vendorName, value]) => ({
        vendorName,
        projectCount: value.projectCount,
        winCount: value.projectCount,
        totalContractValue: value.total,
        sampleProjects: value.samples.slice(0, 3),
        isRecurring: value.years.size > 2,
        isFrequentWinner: value.projectCount > 5,
      }))
      .sort(
        (a, b) => b.projectCount - a.projectCount || b.totalContractValue - a.totalContractValue,
      )
      .slice(0, 10);
  });
  readonly averageBudgetBarSeries = computed<BarChartSeries[]>(() =>
    this.topProjectTypes().map((type, index) => ({
      name: type,
      color: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
      values: FISCAL_YEARS.map((year) => {
        const values = this.multiYearProjects()
          .filter(
            (project) => project.budget_year === year && this.projectTypeLabel(project) === type,
          )
          .map((project) => toNumber(project.budget_amount))
          .filter((value): value is number => value !== null);
        return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
      }),
    })),
  );
  readonly riskTrendBarSeries = computed<BarChartSeries[]>(() => {
    if (this.selectedSubdistrictId())
      return RISK_SERIES.map((risk) => ({
        name: this.i18n.riskLabel(risk.level),
        color: risk.color,
        values: FISCAL_YEARS.map(
          (year) =>
            this.multiYearProjects().filter(
              (project) =>
                project.budget_year === year &&
                normalizeRiskLevel(project.risk_level) === risk.level,
            ).length,
        ),
      }));
    const ids = [...new Set(this.multiYearProjects().map((project) => project.subdistrict_id))];
    return ids.map((id, index) => ({
      name: this.subdistrictName(id),
      color: CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length],
      values: FISCAL_YEARS.map(
        (year) =>
          this.multiYearProjects().filter(
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
    this.multiYearProjects().forEach((project) => {
      const label = this.entityLabel(project);
      const item = groups.get(label) ?? { years: new Set<number>(), count: 0, totalBudget: 0 };
      item.years.add(project.budget_year);
      item.count += 1;
      item.totalBudget += toNumber(project.budget_amount) ?? 0;
      groups.set(label, item);
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
    this.api.annualRisk().subscribe({
      next: (rows) => this.annualRisks.set(rows),
      error: () => this.error.set(this.t('prInsights.error.annualRisk')),
    });
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
  labelSubdistrict(subdistrict: Subdistrict): string {
    return subdistrictLabel(subdistrict);
  }
  annualRowsForYear(year: number): AnnualRisk[] {
    return this.scopedAnnualRisks().filter((row) => row.fiscal_year === year);
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
      error: () => this.error.set(this.t('prInsights.error.subdistricts')),
    });
  }
  private loadDashboard(): void {
    this.error.set('');
    this.api.projects(this.filters()).subscribe({
      next: (projects) => this.projects.set(projects),
      error: () => this.error.set(this.t('prInsights.error.dashboard')),
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
      error: () => this.error.set(this.t('prInsights.error.timeSeries')),
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
    return project.project_type || project.purchase_method_group || this.t('common.unspecifiedType');
  }
  private topProjectTypes(): string[] {
    const counts = new Map<string, number>();
    this.multiYearProjects().forEach((project) => {
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
      this.t('common.unspecifiedItem')
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
      this.t('prInsights.unspecifiedVendor')
    );
  }
}
