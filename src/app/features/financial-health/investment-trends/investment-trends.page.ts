import { Component, inject, OnInit } from '@angular/core';

import { I18nService } from '../../../core/i18n/i18n.service';
import { BarChartComponent } from '../../../shared/charts/bar-chart.component';
import { FilterBarComponent } from '../../../shared/filters/filter-bar.component';
import { KpiCardComponent } from '../../../shared/ui/kpi-card.component';
import { FinancialHealthStateService } from '../financial-health-state.service';

@Component({
  selector: 'app-investment-trends-page',
  standalone: true,
  imports: [BarChartComponent, FilterBarComponent, KpiCardComponent],
  template: `
    <section class="page-shell">
      <div>
        <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F2.3</p>
        <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">{{ t('fhInvest.title') }}</h1>
        <p class="m-0 mt-1.5 text-sm text-muted">{{ t('fhInvest.subtitle') }}</p>
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
        <div class="mb-3">
          <h2 class="m-0 text-[16px] font-bold text-ink">{{ t('fhInvest.sectionTitle') }}</h2>
          <p class="m-0 mt-1 text-[13px] text-muted">{{ t('fhInvest.sectionSubtitle') }}</p>
        </div>

        <div class="mb-4 grid gap-3.5 sm:grid-cols-2">
          <app-kpi-card
            [label]="t('fhInvest.fixedAssetKpi', { year: fixedAssetFocusYear() })"
            [value]="fixedAssetFocusValueText()"
            [hint]="t('fhInvest.fixedAssetHint')"
            accentClass="bg-navy"
          />

          <div class="rounded-[4px] border-[1.5px] border-line bg-white p-4">
            <p class="m-0 text-[13px] font-bold text-muted">{{ t('fhInvest.yoyTitle') }}</p>
            @if (fixedAssetYoyView(); as yoyView) {
              <p class="m-0 mt-2 text-2xl font-extrabold" [class]="yoyView.colorClass">
                {{ yoyView.arrow }} {{ yoyView.magnitude }}%
              </p>
              <p class="m-0 mt-1 text-xs text-muted">
                {{
                  t('fhInvest.yoyCompare', {
                    prev: fixedAssetPreviousYear(),
                    cur: fixedAssetFocusYear(),
                  })
                }}
              </p>
            } @else {
              <p class="m-0 mt-2 text-sm text-muted">{{ t('fh.fixedAsset.insightNone') }}</p>
            }
          </div>
        </div>

        <app-bar-chart
          [title]="
            t('fhInvest.chartTitle', {
              from: FISCAL_YEARS[0],
              to: FISCAL_YEARS[FISCAL_YEARS.length - 1],
            })
          "
          [subtitle]="fixedAssetInsight()"
          [categories]="fiscalYearLabels"
          [series]="fixedAssetBarSeries()"
          [unitSuffix]="t('common.unit.baht')"
          [compactValueLabels]="true"
        />
      </section>
    </section>
  `,
})
export class InvestmentTrendsPageComponent implements OnInit {
  private readonly state = inject(FinancialHealthStateService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  readonly FISCAL_YEARS = this.state.FISCAL_YEARS;
  readonly fiscalYearLabels = this.state.fiscalYearLabels;
  readonly error = this.state.error;
  readonly subdistricts = this.state.subdistricts;
  readonly selectedSubdistrictId = this.state.selectedSubdistrictId;
  readonly selectedYear = this.state.selectedYear;
  readonly fixedAssetFocusYear = this.state.fixedAssetFocusYear;
  readonly fixedAssetPreviousYear = this.state.fixedAssetPreviousYear;
  readonly fixedAssetFocusValueText = this.state.fixedAssetFocusValueText;
  readonly fixedAssetYoyView = this.state.fixedAssetYoyView;
  readonly fixedAssetInsight = this.state.fixedAssetInsight;
  readonly fixedAssetBarSeries = this.state.fixedAssetBarSeries;

  ngOnInit(): void {
    this.state.initialize();
  }

  setSubdistrict(value: number | null): void {
    this.state.setSubdistrict(value);
  }

  setYear(value: number | null): void {
    this.state.setYear(value);
  }

  resetFilters(): void {
    this.state.resetFilters();
  }
}
