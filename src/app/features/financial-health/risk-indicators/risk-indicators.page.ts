import { Component, inject, OnInit } from '@angular/core';

import { AnnualRisk } from '../../../core/models/domain.models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { FilterBarComponent } from '../../../shared/filters/filter-bar.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { InfoTooltipComponent } from '../../../shared/ui/info-tooltip.component';
import { bandColor, toNumber } from '../../../shared/utils/risk-utils';
import { FinancialHealthStateService } from '../financial-health-state.service';

@Component({
  selector: 'app-risk-indicators-page',
  standalone: true,
  imports: [EmptyStateComponent, FilterBarComponent, InfoTooltipComponent],
  template: `
    <section class="page-shell">
      <div>
        <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F2.4</p>
        <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">{{ t('fhRiskInd.title') }}</h1>
        <p class="m-0 mt-1.5 text-sm text-muted">{{ t('fhRiskInd.subtitle') }}</p>
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
        <div class="mb-0.5 flex items-center gap-2">
          <h2 class="m-0 text-[16px] font-bold text-ink">
            {{ t('fhRiskInd.statusTitle', { year: selectedYear() ?? t('filter.allYears') }) }}
          </h2>
          <app-info-tooltip [text]="t('fhRiskInd.tooltip')" />
        </div>
        <p class="m-0 mb-3.5 text-[13px] text-muted">{{ t('fhRiskInd.note') }}</p>

        <div class="mt-[18px] grid gap-4 xl:grid-cols-[1fr_1fr]">
          @if (!factorCards().length) {
            <app-empty-state
              [title]="t('fhRiskInd.emptyTitle')"
              [message]="t('fhRiskInd.emptyMsg')"
            />
          } @else {
            <div class="max-h-[370px] overflow-y-auto flex flex-col gap-3.5">
              @for (
                row of factorCards();
                track row.factor_code + '-' + row.fiscal_year + '-' + row.subdistrict_id
              ) {
                <article class="rounded-[4px] border-[1.5px] border-line p-3.5">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p class="m-0 text-sm font-bold text-ink">{{ row.factor_name }}</p>
                      <p class="m-0 mt-0.5 text-[11.5px] text-muted">
                        {{ row.factor_code }} · {{ t('common.yearLabel', { year: row.fiscal_year }) }}
                      </p>
                    </div>
                    @if (row.risk_band) {
                      <span
                        class="shrink-0 rounded-[3px] px-2.5 py-1 text-[11.5px] font-extrabold text-white"
                        [style.background]="bandColor(row.risk_band)"
                        [title]="matrixChip(row)"
                        >{{ matrixChip(row) }} · {{ bandText(row.risk_band) }}</span
                      >
                    }
                  </div>
                  <div class="mt-2.5 rounded-[3px] border border-line-soft bg-zebra p-2.5">
                    <p class="m-0 text-[11.5px] font-bold text-muted">Observed Value</p>
                    <p
                      class="m-0 mt-1 text-[16px] font-extrabold"
                      [class]="isComputable(row) ? 'text-ink' : 'text-[#8a2a1f]'"
                    >
                      {{
                        isComputable(row)
                          ? observedValueText(row)
                          : t('fhRiskInd.cannotEvaluateFull')
                      }}
                    </p>
                  </div>
                  @if (row.evidence_text) {
                    <p class="m-0 mt-2.5 text-xs leading-relaxed text-muted">
                      {{ row.evidence_text }}
                    </p>
                  }
                </article>
              }
            </div>
          }

          <div class="overflow-x-auto">
            <table class="gov-table text-[13px]">
              <thead>
                <tr>
                  <th>{{ t('fh.metric') }}</th>
                  <th>{{ t('fhRiskInd.colMethod') }}</th>
                  <th>{{ t('fhRiskInd.colUnit') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="whitespace-nowrap font-bold">{{ t('fhRiskInd.y1Name') }}</td>
                  <td>{{ t('fhRiskInd.y1Formula') }}</td>
                  <td class="whitespace-nowrap">%</td>
                </tr>
                <tr>
                  <td class="whitespace-nowrap font-bold">{{ t('fhRiskInd.y2Name') }}</td>
                  <td>{{ t('fhRiskInd.y2Formula') }}</td>
                  <td class="whitespace-nowrap">%</td>
                </tr>
                <tr>
                  <td class="whitespace-nowrap font-bold">{{ t('fhRiskInd.y3Name') }}</td>
                  <td>{{ t('fhRiskInd.y3Formula') }}</td>
                  <td class="whitespace-nowrap">{{ t('fh.unit.times') }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  `,
})
export class RiskIndicatorsPageComponent implements OnInit {
  private readonly state = inject(FinancialHealthStateService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  readonly error = this.state.error;
  readonly subdistricts = this.state.subdistricts;
  readonly selectedSubdistrictId = this.state.selectedSubdistrictId;
  readonly selectedYear = this.state.selectedYear;
  readonly factorCards = this.state.factorCards;

  readonly bandColor = bandColor;
  readonly isComputable = this.state.isComputable.bind(this.state);
  readonly observedValueText = this.state.observedValueText.bind(this.state);

  bandText(band: string | null | undefined): string {
    return band ? this.i18n.bandLabel(band) : '';
  }

  matrixChip(row: AnnualRisk): string {
    const l = toNumber(row.likelihood);
    const i = toNumber(row.impact);
    const s = toNumber(row.matrix_score);
    if (l === null || i === null || s === null) {
      return '-';
    }
    return this.t('rf.matrixChip', { l, i, s });
  }

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
