import { Component, computed, input } from '@angular/core';
import { EChartsOption } from 'echarts';
import { NgxEchartsDirective } from 'ngx-echarts';

export interface StackedBarSeries {
  name: string;
  values: number[];
  color: string;
}

@Component({
  selector: 'app-stacked-bar-chart',
  standalone: true,
  imports: [NgxEchartsDirective],
  template: `<div echarts [options]="chartOptions()" class="h-72 w-full"></div>`,
})
export class StackedBarChartComponent {
  readonly categories = input<string[]>([]);
  readonly series = input<StackedBarSeries[]>([]);
  readonly yAxisName = input('บาท');

  readonly chartOptions = computed<EChartsOption>(() => ({
    color: this.series().map((item) => item.color),
    grid: { top: 28, right: 24, bottom: 36, left: 112 },
    tooltip: { trigger: 'axis', appendToBody: true },
    legend: { bottom: 0, textStyle: { color: '#475569' } },
    xAxis: {
      type: 'value',
      name: this.yAxisName(),
      nameTextStyle: { color: '#64748b' },
      axisLabel: { color: '#64748b' },
      splitLine: { lineStyle: { color: '#e2e8f0' } },
    },
    yAxis: {
      type: 'category',
      data: this.categories(),
      axisTick: { alignWithLabel: true },
      axisLabel: { color: '#64748b' },
    },
    series: this.series().map((item) => ({
      name: item.name,
      type: 'bar',
      stack: 'income',
      barMaxWidth: 52,
      emphasis: { focus: 'series' },
      itemStyle: { color: item.color },
      data: item.values,
    })),
  }));
}
