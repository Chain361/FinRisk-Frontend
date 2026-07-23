import { Component, inject, OnInit } from '@angular/core';

import { BarChartComponent } from '../../../shared/charts/bar-chart.component';
import { FilterBarComponent } from '../../../shared/filters/filter-bar.component';
import { KpiCardComponent } from '../../../shared/ui/kpi-card.component';
import { FinancialHealthStateService } from '../financial-health-state.service';

@Component({
  selector: 'app-investment-trends-page',
  standalone: true,
  imports: [
    BarChartComponent,
    FilterBarComponent,
    KpiCardComponent,
  ],
  template: `
    <section class="page-shell">
      <div>
        <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F2.3</p>
        <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">
          แนวโน้มการลงทุนและการจัดซื้อจัดจ้าง
        </h1>
      </div>

      <app-filter-bar
        [subdistricts]="subdistricts()"
        [selectedSubdistrictId]="selectedSubdistrictId()"
        [selectedYear]="selectedYear()"
        [showRiskFilter]="false"
        (selectedSubdistrictIdChange)="setSubdistrict($event)"
        (selectedYearChange)="setYear($event)"
        (reset)="resetFilters()"
      />

      @if (error()) {
        <p
          class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high"
        >
          {{ error() }}
        </p>
      }

      <section class="panel p-[18px]">
        <div class="mb-3">
          <h2 class="m-0 text-[16px] font-bold text-ink">แนวโน้มการลงทุน (สินทรัพย์ถาวร)</h2>
          <p class="m-0 mt-1 text-[13px] text-muted">
            มูลค่าสินทรัพย์ถาวรย้อนหลังของตำบลที่เลือก พร้อมการเปลี่ยนแปลงเทียบปีก่อน (YoY)
          </p>
        </div>

        <div class="mb-4 grid gap-3.5 sm:grid-cols-2">
          <app-kpi-card
            [label]="'มูลค่าสินทรัพย์ถาวร ปี ' + fixedAssetFocusYear()"
            [value]="fixedAssetFocusValueText()"
            hint="อ้างอิงตัวกรองตำบล/ปีงบประมาณด้านบน"
            accentClass="bg-navy"
          />

          <div class="rounded-[4px] border-[1.5px] border-line bg-white p-4">
            <p class="m-0 text-[13px] font-bold text-muted">YoY เทียบปีก่อน</p>
            @if (fixedAssetYoyView(); as yoyView) {
              <p class="m-0 mt-2 text-2xl font-extrabold" [class]="yoyView.colorClass">
                {{ yoyView.arrow }} {{ yoyView.magnitude }}%
              </p>
              <p class="m-0 mt-1 text-xs text-muted">
                เทียบปี {{ fixedAssetPreviousYear() }} → {{ fixedAssetFocusYear() }}
              </p>
            } @else {
              <p class="m-0 mt-2 text-sm text-muted">ไม่มีข้อมูลเพียงพอสำหรับคำนวณ YoY</p>
            }
          </div>
        </div>

        <app-bar-chart
          [title]="
            'แนวโน้มมูลค่าสินทรัพย์ถาวร (ปี ' +
            FISCAL_YEARS[0] +
            '-' +
            FISCAL_YEARS[FISCAL_YEARS.length - 1] +
            ')'
          "
          [subtitle]="fixedAssetInsight()"
          [categories]="fiscalYearLabels"
          [series]="fixedAssetBarSeries()"
          unitSuffix="บาท"
          [compactValueLabels]="true"
        />
      </section>
    </section>
  `,
})
export class InvestmentTrendsPageComponent implements OnInit {
  private readonly state = inject(FinancialHealthStateService);

  readonly FISCAL_YEARS = this.state.FISCAL_YEARS;
  readonly fiscalYearLabels = this.state.fiscalYearLabels;
  readonly error = this.state.error;
  readonly subdistricts = this.state.subdistricts;
  readonly selectedSubdistrictId = this.state.selectedSubdistrictId;
  readonly selectedYear = this.state.selectedYear;
  readonly fixedAssetFocusYear = this.state.fixedAssetFocusYear;
  readonly fixedAssetPreviousYear = this.state.fixedAssetPreviousYear;
  readonly fixedAssetFocusValueText = this.state.fixedAssetFocusValueText;
  readonly fixedAssetYoyView = this.state.fixedAssetYoyView;
  readonly fixedAssetInsight = this.state.fixedAssetInsight;
  readonly fixedAssetBarSeries = this.state.fixedAssetBarSeries;

  ngOnInit(): void {
    this.state.initialize();
  }

  setSubdistrict(value: number | null): void {
    this.state.setSubdistrict(value);
  }

  setYear(value: number | null): void {
    this.state.setYear(value);
  }

  resetFilters(): void {
    this.state.resetFilters();
  }
}
