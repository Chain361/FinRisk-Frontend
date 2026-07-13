import { Component, Input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Project } from '../../core/models/domain.models';
import {
  FISCAL_YEARS,
  RISK_LEVELS,
  normalizeRiskLevel,
} from '../utils/risk-utils';

@Component({
  selector: 'app-risk-bar-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-5">

      @for (level of chartData(); track level.name) {

        <div>

          <h4 class="mb-2 font-semibold text-sm">
            {{ level.name }}
          </h4>

          @for (item of level.data; track item.year) {

            <div class="mb-3">

              <div class="flex justify-between text-xs mb-1">
                <span>{{ item.year }}</span>
                <span>{{ item.count }} โครงการ</span>
              </div>

              <div class="h-4 rounded bg-slate-200 overflow-hidden">

                <div
                  class="h-full transition-all duration-500"
                  [style.width.%]="item.percent"
                  [style.background]="level.color">
                </div>

              </div>

            </div>

          }

        </div>

      }

    </div>
  `,
})
export class RiskBarChartComponent {

  @Input() projects: Project[] = [];

  readonly chartData = computed(() => {

    const max = this.projects.length || 1;

    return RISK_LEVELS.map(level => ({

      name:
        level === 'high'
          ? 'เสี่ยงสูง'
          : level === 'medium'
          ? 'เสี่ยงปานกลาง'
          : 'เสี่ยงต่ำ',

      color:
        level === 'high'
          ? '#ef4444'
          : level === 'medium'
          ? '#f59e0b'
          : '#22c55e',

      data: FISCAL_YEARS.map(year => {

        const count = this.projects.filter(p =>
          p.budget_year === year &&
          normalizeRiskLevel(p.risk_level) === level
        ).length;

        return {

          year,

          count,

          percent: (count / max) * 100

        };

      })

    }));

  });

}