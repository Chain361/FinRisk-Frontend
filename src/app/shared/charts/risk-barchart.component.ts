import { ChangeDetectionStrategy, Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Project } from '../../core/models/domain.models';
import {
  FISCAL_YEARS,
  RISK_LEVELS,
  normalizeRiskLevel,
} from '../utils/risk-utils';

interface ChartItem {
  year: number;
  count: number;
  percent: number;
}

interface ChartLevel {
  name: string;
  color: string;
  data: ChartItem[];
}

@Component({
  selector: 'app-risk-bar-chart',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
export class RiskBarChartComponent implements OnChanges {
  @Input() projects: Project[] = [];

  readonly chartData = signal<ChartLevel[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['projects']) {
      this.chartData.set(this.buildChartData(this.projects));
    }
  }

  private buildChartData(projects: Project[]): ChartLevel[] {
    const max = projects.length || 1;

    return RISK_LEVELS.map((level) => {
      const levelName = level === 'high' ? 'เสี่ยงสูง' : level === 'medium' ? 'เสี่ยงปานกลาง' : 'เสี่ยงต่ำ';
      const color = level === 'high' ? '#ef4444' : level === 'medium' ? '#f59e0b' : '#22c55e';

      const data: ChartItem[] = FISCAL_YEARS.map((year) => {
        let count = 0;
        for (const project of projects) {
          if (project.budget_year === year && normalizeRiskLevel(project.risk_level) === level) {
            count += 1;
          }
        }

        return {
          year,
          count,
          percent: (count / max) * 100,
        };
      });

      return { name: levelName, color, data };
    });
  }
}