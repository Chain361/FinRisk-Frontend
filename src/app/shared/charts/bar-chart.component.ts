import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { I18nService } from '../../core/i18n/i18n.service';
import { formatMoney, formatNumber } from '../utils/risk-utils';

export interface BarChartSeries {
  name: string;
  color: string;
  values: (number | null)[];
}

interface ViewBar {
  heightPct: number;
  color: string;
  valueLabel: string;
  missing: boolean;
}

interface ViewCategory {
  label: string;
  bars: ViewBar[];
}

interface ViewRow {
  seriesName: string;
  cells: string[];
}

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel p-[18px]">
      <div class="mb-3.5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="m-0 text-[16px] font-bold text-ink">{{ title() }}</h2>
          @if (subtitle()) {
            <p class="mt-1 text-[13px] text-muted">{{ subtitle() }}</p>
          }
        </div>
        @if (legend().length) {
          <div class="flex flex-wrap gap-3.5">
            @for (item of legend(); track item.name) {
              <div class="flex items-center gap-1.5 text-xs text-slate-700">
                <span class="inline-block size-3 rounded-[2px]" [style.background]="item.color"></span>
                {{ item.name }}
              </div>
            }
          </div>
        }
      </div>

      <div class="overflow-x-auto">
        <div class="flex h-[200px] items-end gap-6 border-b-2 border-ink px-1" style="min-width: 100%;">
          @for (cat of viewCategories(); track cat.label) {
            <div class="flex h-full min-w-[60px] flex-1 flex-col items-center justify-end">
              <div class="flex h-full items-end gap-[5px]">
                @for (bar of cat.bars; track $index) {
                  <div class="flex h-full w-7 flex-col items-center justify-end">
                    <span class="mb-[3px] whitespace-nowrap text-[11px] font-bold" [class]="bar.missing ? 'text-muted' : 'text-ink'">
                      {{ bar.valueLabel }}
                    </span>
                    @if (!bar.missing) {
                      <div class="w-full rounded-t-[2px]" [style.height.%]="bar.heightPct" [style.background]="bar.color"></div>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </div>
        <div class="flex gap-6 px-1 pt-2">
          @for (cat of viewCategories(); track cat.label) {
            <div class="min-w-[60px] flex-1 text-center text-xs font-semibold text-slate-700">{{ cat.label }}</div>
          }
        </div>
      </div>

      <div class="mt-4 overflow-x-auto">
        <table class="gov-table text-[12.5px]">
          <thead>
            <tr>
              <th>{{ rowHeader() || t('chart.rowHeaderDefault') }}</th>
              @for (header of categories(); track header) {
                <th class="text-right!">{{ header }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of tableRows(); track row.seriesName) {
              <tr>
                <td class="font-bold">{{ row.seriesName }}</td>
                @for (cell of row.cells; track $index) {
                  <td class="text-right">{{ cell }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class BarChartComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly categories = input.required<string[]>();
  readonly series = input.required<BarChartSeries[]>();
  readonly unitSuffix = input<string>('');
  readonly rowHeader = input<string>('');
  readonly fractionDigits = input<number>(0);
  readonly compactValueLabels = input<boolean>(false);

  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  readonly legend = computed(() => {
    const series = this.series();
    return series.length > 1 ? series.map((s) => ({ name: s.name, color: s.color })) : [];
  });

  readonly viewCategories = computed<ViewCategory[]>(() => {
    const series = this.series();
    let max = 0;
    for (const s of series) {
      for (const v of s.values) {
        if (v !== null && v > max) {
          max = v;
        }
      }
    }
    if (max <= 0) {
      max = 1;
    }

    return this.categories().map((label, index) => ({
      label,
      bars: series.map((s) => {
        const value = s.values[index] ?? null;
        if (value === null) {
          return { heightPct: 0, color: s.color, valueLabel: '—', missing: true };
        }
        return {
          heightPct: Math.max(4, Math.round((value / max) * 100)),
          color: s.color,
          valueLabel: this.compactValueLabels()
            ? formatMoney(value)
            : formatNumber(value, this.fractionDigits()),
          missing: false,
        };
      }),
    }));
  });

  readonly tableRows = computed<ViewRow[]>(() => {
    const suffix = this.unitSuffix() ? ` ${this.unitSuffix()}` : '';
    return this.series().map((s) => ({
      seriesName: s.name,
      cells: this.categories().map((_, index) => {
        const value = s.values[index] ?? null;
        if (value === null) {
          return this.t('common.cannotEvaluate');
        }
        return formatNumber(value, this.fractionDigits()) + suffix;
      }),
    }));
  });
}
