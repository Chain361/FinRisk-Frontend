import { Component, computed, input } from '@angular/core';
import { EChartsOption } from 'echarts';
import { NgxEchartsDirective } from 'ngx-echarts';

import { FISCAL_YEARS } from '../utils/risk-utils';

export interface TimeSeriesPoint {
  year: number;
  value: number | null;
  computable: boolean;
  tooltip?: string | null;
}

export interface TimeSeries {
  name: string;
  color: string;
  dashed?: boolean;
  points: TimeSeriesPoint[];
}

@Component({
  selector: 'app-time-series-chart',
  standalone: true,
  imports: [NgxEchartsDirective],
  template: `<div echarts [options]="chartOptions()" class="h-72 w-full"></div>`,
})
export class TimeSeriesChartComponent {
  readonly years = input<readonly number[]>(FISCAL_YEARS);
  readonly series = input<TimeSeries[]>([]);
  readonly yAxisName = input('');
  readonly chartType = input<'line' | 'bar'>('line');

  readonly chartOptions = computed<EChartsOption>(() => {
    const years = [...this.years()];
    return {
      color: this.series().map((item) => item.color),
      grid: { top: 28, right: 24, bottom: 36, left: 52 },
      tooltip: {
        trigger: 'axis',
        appendToBody: true,
        formatter: (params: unknown) => this.tooltip(params),
      },
      legend: { top: 0, textStyle: { color: '#475569' } },
      xAxis: {
        type: 'category',
        data: years,
        axisTick: { alignWithLabel: true },
        axisLabel: { color: '#64748b' },
      },
      yAxis: {
        type: 'value',
        name: this.yAxisName(),
        nameTextStyle: { color: '#64748b' },
        axisLabel: { color: '#64748b' },
        splitLine: { lineStyle: { color: '#e2e8f0' } },
      },
    series: this.series().map((item) => ({
      name: item.name,
      type: this.chartType(),
      smooth: this.chartType() === 'line',
      connectNulls: false,
      symbolSize: this.chartType() === 'line' ? 9 : 0,
      lineStyle: {
        width: 3,
        type: item.dashed ? 'dashed' : 'solid',
      },
      emphasis: {
        focus: 'series',
        },
        data: years.map((year) => {
          const point = item.points.find((candidate) => candidate.year === year);
          return {
            value: point?.computable ? point.value : null,
            computable: Boolean(point?.computable),
            tooltip: point?.tooltip ?? null,
          };
        }),
      })),
    };
  });

  private tooltip(params: unknown): string {
    if (!Array.isArray(params)) {
      return '';
    }

    const header = params[0]?.axisValueLabel ?? params[0]?.axisValue ?? '';
    const rows = params
      .map((item) => {
        const data = item.data as { value?: number | null; computable?: boolean; tooltip?: string | null };
        const valueText = data.computable ? (data.value ?? '-') : 'ประเมินไม่ได้';
        const detail = data.tooltip ? `<br/><span style="color:#64748b">${data.tooltip}</span>` : '';
        return `${item.marker}${item.seriesName}: <strong>${valueText}</strong>${detail}`;
      })
      .join('<br/>');

    return `<strong>${header}</strong><br/>${rows}`;
  }
}
