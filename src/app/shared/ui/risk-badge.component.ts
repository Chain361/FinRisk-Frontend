import { Component, computed, inject, input } from '@angular/core';

import { I18nService } from '../../core/i18n/i18n.service';
import { RiskLevel } from '../../core/models/domain.models';
import { riskBadgeClasses } from '../utils/risk-utils';

@Component({
  selector: 'app-risk-badge',
  standalone: true,
  template: `
    <span class="inline-flex items-center rounded-[3px] px-2.5 py-1 text-xs font-bold" [class]="classes()">
      {{ label() }}
    </span>
  `,
})
export class RiskBadgeComponent {
  private readonly i18n = inject(I18nService);
  readonly level = input<RiskLevel | null | undefined>(null);
  readonly label = computed(() => this.i18n.riskLabel(this.level()));
  readonly classes = computed(() => riskBadgeClasses(this.level()));
}
