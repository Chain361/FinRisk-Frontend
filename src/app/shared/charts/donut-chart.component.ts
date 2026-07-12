import { Component, computed, input } from '@angular/core';
import { EChartsOption } from 'echarts';
import { NgxEchartsDirective } from 'ngx-echarts';

import { riskColor, riskLabel } from '../utils/risk-utils';

interface DonutSegment {
  name: string;
  value: number | null | undefined;
  color?: string;
}

@Component({
  selector: 'app-donut-chart',
  standalone: true,
  imports: [NgxEchartsDirective],
  template: `<div echarts [options]="chartOptions()" class="h-64 w-full"></div>`,
})
export class DonutChartComponent {
  readonly byLevel = input<Record<string, number | undefined>>({});
  readonly segments = input<DonutSegment[]>([]);

  readonly chartOptions = computed<EChartsOption>(() => {
    const levels = ['high', 'medium', 'low'];
    const customSegments = this.segments();

    const data = customSegments.length
      ? customSegments.map((segment) => ({
          name: segment.name,
          value: segment.value ?? 0,
          itemStyle: { color: segment.color ?? '#2563eb' },
        }))
      : levels.map((level) => ({
          name: riskLabel(level),
          value: this.byLevel()[level] ?? 0,
          itemStyle: { color: riskColor(level) },
        }));

    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: '#475569' } },
      series: [
        {
          type: 'pie',
          radius: ['52%', '72%'],
          center: ['50%', '44%'],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: '#fff', borderWidth: 3 },
          label: { formatter: '{b}\n{c}', color: '#334155' },
          data,
        },
      ],
    };
  });
}
