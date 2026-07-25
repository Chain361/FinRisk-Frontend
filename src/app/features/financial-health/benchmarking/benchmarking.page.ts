import { Component, inject, OnInit } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import { BarChartComponent } from '../../../shared/charts/bar-chart.component';
import { FilterBarComponent } from '../../../shared/filters/filter-bar.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import {
  ComparisonMetric,
  FinancialHealthStateService,
} from '../financial-health-state.service';

@Component({
  selector: 'app-benchmarking-page',
  standalone: true,
  imports: [BarChartComponent, EmptyStateComponent, FilterBarComponent],
  template: `
    <section class="page-shell">
      <div>
        <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F2.2</p>
        <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">{{ t('fhBench.title') }}</h1>
        <p class="m-0 mt-1.5 text-sm text-muted">{{ t('fhBench.subtitle') }}</p>
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
        <p
          class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high"
        >
          {{ error() }}
        </p>
      }

      <section class="panel p-[18px]">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="m-0 text-[16px] font-bold text-ink">{{ t('fhBench.crossTitle') }}</h2>
            <p class="m-0 mt-1 text-[13px] text-muted">
              {{ t('fhBench.crossSubtitle', { year: selectedYear() ?? t('filter.allYears') }) }}
            </p>
          </div>

          <div class="flex flex-wrap items-end gap-3.5">
            <label class="block">
              <span class="text-[12.5px] font-bold text-muted mr-3">{{ t('fh.metric') }}</span>
              <select
                class="gov-select mt-[5px] w-auto!"
                [value]="comparisonMetric()"
                (change)="setComparisonMetric($any($event.target).value)"
              >
                <option value="netAssets">{{ t('fh.metricNetAssets') }}</option>
                <option value="netIncome">{{ t('fh.metricNetIncome') }}</option>
                <option value="riskFactor">{{ t('fh.metricRiskFactorOption') }}</option>
              </select>
            </label>

            @if (comparisonMetric() === 'riskFactor') {
              <label class="block">
                <span class="text-[12.5px] font-bold text-muted ml-3 mr-3">{{ t('fh.factorLabel') }}</span>
                <select
                  class="gov-select mt-[5px] w-auto!"
                  [value]="comparisonFactorCode() ?? ''"
                  (change)="setComparisonFactorCode($any($event.target).value)"
                >
                  @for (option of allFactorOptions(); track option.code) {
                    <option [value]="option.code">{{ option.code }} - {{ option.name }}</option>
                  }
                </select>
              </label>
            }
          </div>
        </div>

        @if (comparisonCategories().length) {
          <app-bar-chart
            [title]="t('fh.compare.title', { metric: comparisonMetricLabel() })"
            [subtitle]="t('fh.compare.subtitle', { metric: comparisonMetricLabel() })"
            [categories]="comparisonCategories()"
            [series]="comparisonBarSeries()"
            [unitSuffix]="comparisonUnit()"
            [compactValueLabels]="comparisonMetric() !== 'riskFactor'"
            [fractionDigits]="comparisonMetric() === 'riskFactor' ? 2 : 0"
          />
        } @else {
          <app-empty-state
            [title]="t('fhBench.emptyTitle')"
            [message]="t('fhBench.emptyMsg')"
          />
        }
      </section>
    </section>
  `,
})
export class BenchmarkingPageComponent implements OnInit {
  private readonly state = inject(FinancialHealthStateService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  readonly error = this.state.error;
  readonly subdistricts = this.state.subdistricts;
  readonly selectedSubdistrictId = this.state.selectedSubdistrictId;
  readonly selectedYear = this.state.selectedYear;
  readonly comparisonMetric = this.state.comparisonMetric;
  readonly comparisonFactorCode = this.state.comparisonFactorCode;
  readonly allFactorOptions = this.state.allFactorOptions;
  readonly comparisonCategories = this.state.comparisonCategories;
  readonly comparisonBarSeries = this.state.comparisonBarSeries;
  readonly comparisonUnit = this.state.comparisonUnit;

  ngOnInit(): void {
    this.state.initialize();
  }

  setSubdistrict(value: number | null): void {
    this.state.setSubdistrict(value);
  }

  setYear(value: number | null): void {
    this.state.setYear(value);
  }

  setComparisonMetric(value: ComparisonMetric): void {
    this.state.setComparisonMetric(value);
  }

  setComparisonFactorCode(value: string): void {
    this.state.setComparisonFactorCode(value);
  }

  resetFilters(): void {
    this.state.resetFilters();
  }

  comparisonMetricLabel(): string {
    return this.state.comparisonMetricLabel();
  }
}
