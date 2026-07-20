import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BarChartComponent } from '../../shared/charts/bar-chart.component';
import { FilterBarComponent } from '../../shared/filters/filter-bar.component';
import { AnnouncementPanelComponent } from '../../shared/ui/announcement-panel.component';
import { KpiCardComponent } from '../../shared/ui/kpi-card.component';
import { ProjectRiskStateService } from './project-risk-state.service';

@Component({
  selector: 'app-project-risk-overview-page',
  standalone: true,
  imports: [
    AnnouncementPanelComponent,
    BarChartComponent,
    FilterBarComponent,
    KpiCardComponent,
    RouterLink,
  ],
  template: `
    <section class="page-shell">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F1</p>
          <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">แดชบอร์ดความเสี่ยงโครงการ</h1>
          <p class="m-0 mt-1.5 text-sm text-muted">
            ภาพรวมจำนวนโครงการตามระดับความเสี่ยงและแนวโน้มงบประมาณ
          </p>
        </div>
        <a
          class="gov-button whitespace-nowrap"
          [routerLink]="['/project-risk/analysis']"
          [queryParams]="state.routeQueryParams()"
        >
          ดูการวิเคราะห์เชิงลึก
        </a>
      </div>

      <app-announcement-panel />

      <app-filter-bar
        [subdistricts]="state.subdistricts()"
        [selectedSubdistrictId]="state.selectedSubdistrictId()"
        [selectedYear]="state.selectedYear()"
        [selectedRiskLevel]="state.selectedRiskLevel()"
        (selectedSubdistrictIdChange)="state.setSubdistrict($event)"
        (selectedYearChange)="state.setYear($event)"
        (selectedRiskLevelChange)="state.setRisk($event)"
        (reset)="state.resetFilters()"
      />

      @if (state.error()) {
        <p class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high">
          {{ state.error() }}
        </p>
      }

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <app-kpi-card label="โครงการทั้งหมด" [value]="state.totalProjects()" hint="" accentClass="bg-navy" />
        <app-kpi-card label="เสี่ยงสูง" [value]="state.byLevel()['high'] ?? 0" hint="" accentClass="bg-risk-high" />
        <app-kpi-card label="เสี่ยงปานกลาง" [value]="state.byLevel()['medium'] ?? 0" hint="" accentClass="bg-risk-medium" />
        <app-kpi-card label="เสี่ยงต่ำ" [value]="state.byLevel()['low'] ?? 0" hint="" accentClass="bg-risk-low" />
      </div>

      <section class="panel p-[18px]">
        <h2 class="m-0 mb-0.5 text-[16px] font-bold text-ink">สัดส่วนความเสี่ยงตามประเภทโครงการ</h2>
        <p class="m-0 mb-3.5 text-[13px] text-muted">ตารางไขว้ระหว่างประเภทโครงการและระดับความเสี่ยง</p>
        <div class="overflow-x-auto">
          <table class="gov-table">
            <thead>
              <tr>
                <th>ประเภทโครงการ</th>
                <th class="text-right!">เสี่ยงสูง</th>
                <th class="text-right!">เสี่ยงปานกลาง</th>
                <th class="text-right!">เสี่ยงต่ำ</th>
                <th class="text-right!">รวม</th>
              </tr>
            </thead>
            <tbody>
              @for (row of state.crossTab().rows; track row.type) {
                <tr>
                  <td class="font-bold">{{ row.type }}</td>
                  <td class="text-right">{{ row.high }}</td>
                  <td class="text-right">{{ row.medium }}</td>
                  <td class="text-right">{{ row.low }}</td>
                  <td class="text-right font-bold">{{ row.total }}</td>
                </tr>
              }
              <tr class="bg-row-active! font-extrabold">
                <td>รวมทั้งหมด</td>
                <td class="text-right">{{ state.crossTab().totals.high }}</td>
                <td class="text-right">{{ state.crossTab().totals.medium }}</td>
                <td class="text-right">{{ state.crossTab().totals.low }}</td>
                <td class="text-right">{{ state.crossTab().totals.total }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <app-bar-chart
        title="แนวโน้มจำนวนโครงการตามระดับความเสี่ยง (ปี 2566–2568)"
        subtitle="ปีที่ไม่มีโครงการจะแสดงเป็น 0"
        [categories]="state.fiscalYearLabels"
        [series]="state.riskLevelTrendBarSeries()"
        unitSuffix="โครงการ"
      />

      <app-bar-chart
        title="งบประมาณรวมแต่ละปี แบ่งตามประเภทโครงการ"
        subtitle="เปรียบเทียบงบประมาณของแต่ละประเภทโครงการในแต่ละปี"
        [categories]="state.fiscalYearLabels"
        [series]="state.budgetByTypeBarSeries()"
        unitSuffix="บาท"
        rowHeader="ประเภทโครงการ"
        [compactValueLabels]="true"
      />
    </section>
  `,
})
export class ProjectRiskOverviewPageComponent implements OnInit {
  readonly state = inject(ProjectRiskStateService);

  ngOnInit(): void {
    this.state.initialize();
  }
}
