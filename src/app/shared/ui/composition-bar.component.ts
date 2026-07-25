import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { I18nService } from '../../core/i18n/i18n.service';
import { formatNumber } from '../utils/risk-utils';

export interface CompositionSegment {
  label: string;
  value: number | null;
  color: string;
}

interface ViewSegment extends CompositionSegment {
  pct: number;
  valueText: string;
}

@Component({
  selector: 'app-composition-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel p-[18px]">
      <h2 class="m-0 text-[16px] font-bold text-ink">{{ title() }}</h2>
      @if (subtitle()) {
        <p class="mt-0.5 mb-3.5 text-[13px] text-muted">{{ subtitle() }}</p>
      }
      @if (total() > 0) {
        <div class="flex h-[34px] overflow-hidden rounded-[3px] border border-line">
          @for (segment of viewSegments(); track segment.label) {
            @if (segment.pct > 0) {
              <div
                class="flex items-center justify-center text-xs font-bold text-white"
                [style.width.%]="segment.pct"
                [style.background]="segment.color"
              >
                {{ segment.pct }}%
              </div>
            }
          }
        </div>
      } @else {
        <p class="text-[13px] text-muted">{{ t('common.noData') }}</p>
      }
      <table class="gov-table mt-3.5 text-[13px]">
        <tbody>
          @for (segment of viewSegments(); track segment.label) {
            <tr>
              <td>
                <span class="mr-2 inline-block size-2.5 rounded-[2px] align-middle" [style.background]="segment.color"></span>
                {{ segment.label }}
              </td>
              <td class="text-right font-bold">{{ segment.valueText }}</td>
            </tr>
          }
        </tbody>
      </table>
    </section>
  `,
})
export class CompositionBarComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly segments = input.required<CompositionSegment[]>();
  readonly unit = input<string>('');

  readonly total = computed(() =>
    this.segments().reduce((sum, segment) => sum + (segment.value ?? 0), 0),
  );

  readonly viewSegments = computed<ViewSegment[]>(() => {
    const total = this.total();
    const unit = this.unit() || this.t('common.unit.baht');
    return this.segments().map((segment) => ({
      ...segment,
      pct: total > 0 && segment.value !== null ? Math.round((segment.value / total) * 100) : 0,
      valueText:
        segment.value === null
          ? this.t('common.cannotEvaluate')
          : `${formatNumber(segment.value, 0)} ${unit}`,
    }));
  });
}
