import { Component, inject, OnInit } from '@angular/core';

import { BarChartComponent } from '../../../shared/charts/bar-chart.component';
import { FilterBarComponent } from '../../../shared/filters/filter-bar.component';
import { CompositionBarComponent } from '../../../shared/ui/composition-bar.component';
import { KpiCardComponent } from '../../../shared/ui/kpi-card.component';
import { FinancialHealthStateService } from '../financial-health-state.service';

@Component({
  selector: 'app-overview-page',
  standalone: true,
  imports: [
    BarChartComponent,
    CompositionBarComponent,
    FilterBarComponent,
    KpiCardComponent,
  ],
  template: `
    <section class="page-shell">
      <div>
        <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F2.1</p>
        <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">ภาพรวมสุขภาพการคลัง</h1>
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

      <div class="grid gap-4 md:grid-cols-3">
        @for (card of balanceSheetKpis(); track card.label) {
          <app-kpi-card
            [label]="card.label"
            [value]="card.value"
            [hint]="card.hint"
            [accentClass]="card.accentClass"
          />
        }
      </div>

      <div class="grid gap-4 md:grid-cols-3">
        @for (card of incomeStatementKpis(); track card.label) {
          <app-kpi-card
            [label]="card.label"
            [value]="card.value"
            [hint]="card.hint"
            [accentClass]="card.accentClass"
          />
        }
      </div>

      <div class="grid gap-4 xl:grid-cols-2">
        <app-composition-bar
          title="โครงสร้างสินทรัพย์"
          subtitle="แบ่งเป็นสินทรัพย์หมุนเวียนและไม่หมุนเวียน"
          [segments]="assetComposition()"
        />
        <app-composition-bar
          title="โครงสร้างหนี้สิน"
          subtitle="แบ่งเป็นหนี้สินหมุนเวียนและระยะยาว"
          [segments]="liabilityComposition()"
        />
      </div>

      <app-bar-chart
        title="โครงสร้างรายได้"
        subtitle="เปรียบเทียบรายได้จัดเก็บเองและรัฐจัดสรร กับเงินอุดหนุนของตำบลที่เลือก"
        [categories]="revenueStructureCategories()"
        [series]="revenueStructureSeries()"
        unitSuffix="บาท"
        rowHeader="ประเภทรายได้"
        [compactValueLabels]="true"
      />
    </section>
  `,
})
export class OverviewPageComponent implements OnInit {
  private readonly state = inject(FinancialHealthStateService);

  readonly error = this.state.error;
  readonly subdistricts = this.state.subdistricts;
  readonly selectedSubdistrictId = this.state.selectedSubdistrictId;
  readonly selectedYear = this.state.selectedYear;
  readonly balanceSheetKpis = this.state.balanceSheetKpis;
  readonly incomeStatementKpis = this.state.incomeStatementKpis;
  readonly assetComposition = this.state.assetComposition;
  readonly liabilityComposition = this.state.liabilityComposition;
  readonly revenueStructureCategories = this.state.revenueStructureCategories;
  readonly revenueStructureSeries = this.state.revenueStructureSeries;

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
