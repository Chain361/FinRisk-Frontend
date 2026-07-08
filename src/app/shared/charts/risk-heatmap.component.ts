import { Component, computed, input } from '@angular/core';
import { EChartsOption } from 'echarts';
import { NgxEchartsDirective } from 'ngx-echarts';

import { Project } from '../../core/models/domain.models';
import { FISCAL_YEARS, normalizeRiskLevel, riskColor, riskLabel } from '../utils/risk-utils';

@Component({
  selector: 'app-risk-heatmap',
  standalone: true,
  imports: [NgxEchartsDirective],
  template: `<div echarts [options]="chartOptions()" class="h-72 w-full"></div>`,
})
export class RiskHeatmapComponent {
  readonly projects = input<Project[]>([]);
  readonly years = input<readonly number[]>(FISCAL_YEARS);

  readonly chartOptions = computed<EChartsOption>(() => {
    const levels = ['high', 'medium', 'low'];
    const years = [...this.years()];
    const data = years.flatMap((year, x) =>
      levels.map((level, y) => {
        const count = this.projects().filter(
          (project) => project.budget_year === year && normalizeRiskLevel(project.risk_level) === level,
        ).length;
        return [x, y, count];
      }),
    );

    return {
      grid: { top: 20, right: 20, bottom: 44, left: 94 },
      tooltip: {
        formatter: (params: unknown) => {
          const item = params as { value?: [number, number, number] };
          const value = item.value;
          if (!value) {
            return '';
          }
          return `${years[value[0]]}<br/>${riskLabel(levels[value[1]])}: <strong>${value[2]}</strong> โครงการ`;
        },
      },
      xAxis: { type: 'category', data: years, axisLabel: { color: '#64748b' } },
      yAxis: { type: 'category', data: levels.map((level) => riskLabel(level)), axisLabel: { color: '#64748b' } },
      visualMap: {
        min: 0,
        max: Math.max(1, ...data.map((item) => item[2])),
        show: false,
        inRange: { color: ['#f8fafc', '#facc15', '#dc2626'] },
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: { show: true, color: '#0f172a' },
          itemStyle: {
            borderColor: '#ffffff',
            borderWidth: 4,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 8,
              shadowColor: 'rgba(15,23,42,0.18)',
            },
          },
        },
      ],
    };
  });

  protected readonly riskColor = riskColor;
}
