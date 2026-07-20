import { Component, computed, input } from '@angular/core';

import { RiskLevel } from '../../core/models/domain.models';
import { riskBadgeClasses, riskLabel } from '../utils/risk-utils';

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
  readonly level = input<RiskLevel | null | undefined>(null);
  readonly label = computed(() => riskLabel(this.level()));
  readonly classes = computed(() => riskBadgeClasses(this.level()));
}
