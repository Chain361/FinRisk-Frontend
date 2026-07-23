import { Component, inject, OnInit } from '@angular/core';

import { FilterBarComponent } from '../../../shared/filters/filter-bar.component';
import { EmptyStateComponent } from '../../../shared/ui/empty-state.component';
import { InfoTooltipComponent } from '../../../shared/ui/info-tooltip.component';
import { bandColor, matrixChip } from '../../../shared/utils/risk-utils';
import { FinancialHealthStateService } from '../financial-health-state.service';

@Component({
  selector: 'app-risk-indicators-page',
  standalone: true,
  imports: [
    EmptyStateComponent,
    FilterBarComponent,
    InfoTooltipComponent,
  ],
  template: `
    <section class="page-shell">
      <div>
        <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F2.4</p>
        <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">ตัวชี้วัดความเสี่ยงทางการคลัง</h1>
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
        <div class="mb-0.5 flex items-center gap-2">
          <h2 class="m-0 text-[16px] font-bold text-ink">
            สถานะปัจจัยเสี่ยงทางการเงิน ปี {{ selectedYear() ?? 'ทุกปี' }}
          </h2>
          <app-info-tooltip
            text="ประเมินไม่ได้ หมายถึงข้อมูลที่จำเป็นต่อการคำนวณยังไม่ครบตามที่ระบุในระเบียบ ไม่ใช่ค่า 0 กรุณาตรวจสอบกับหน่วยงานคลังก่อนสรุปผล"
          />
        </div>
        <p class="m-0 mb-3.5 text-[13px] text-muted">
          ค่าที่ประเมินไม่ได้ (computable = false) จะแสดงข้อความ "ประเมินไม่ได้" และไม่แทนค่าเป็น 0
        </p>

        <div class="mt-[18px] grid gap-4 xl:grid-cols-[1fr_1fr]">
          @if (!factorCards().length) {
            <app-empty-state
              title="ไม่พบข้อมูล Financial Health"
              message="ข้อมูล /risk/annual อาจยังไม่มีสำหรับตัวกรองนี้"
            />
          } @else {
            <div class="max-h-[370px] overflow-y-auto flex flex-col gap-3.5">
              @for (
                row of factorCards();
                track row.factor_code + '-' + row.fiscal_year + '-' + row.subdistrict_id
              ) {
                <article class="rounded-[4px] border-[1.5px] border-line p-3.5">
                  <div class="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p class="m-0 text-sm font-bold text-ink">{{ row.factor_name }}</p>
                      <p class="m-0 mt-0.5 text-[11.5px] text-muted">{{ row.factor_code }} · ปี {{ row.fiscal_year }}</p>
                    </div>
                    @if (row.risk_band) {
                      <span
                        class="shrink-0 rounded-[3px] px-2.5 py-1 text-[11.5px] font-extrabold text-white"
                        [style.background]="bandColor(row.risk_band)"
                        [title]="matrixChip(row)"
                      >{{ matrixChip(row) }} · {{ row.risk_band }}</span>
                    }
                  </div>
                  <div class="mt-2.5 rounded-[3px] border border-line-soft bg-zebra p-2.5">
                    <p class="m-0 text-[11.5px] font-bold text-muted">Observed Value</p>
                    <p
                      class="m-0 mt-1 text-[16px] font-extrabold"
                      [class]="isComputable(row) ? 'text-ink' : 'text-[#8a2a1f]'"
                    >
                      {{
                        isComputable(row) ? observedValueText(row) : 'ประเมินไม่ได้ (ข้อมูลไม่พอ)'
                      }}
                    </p>
                  </div>
                  @if (row.evidence_text) {
                    <p class="m-0 mt-2.5 text-xs leading-relaxed text-muted">
                      {{ row.evidence_text }}
                    </p>
                  }
                </article>
              }
            </div>
          }

          <div class="overflow-x-auto">
            <table class="gov-table text-[13px]">
              <thead>
                <tr>
                  <th>ตัวชี้วัด</th>
                  <th>วิธีการคำนวณ</th>
                  <th>หน่วย</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="whitespace-nowrap font-bold">Y1 - อัตราการพึ่งพาตนเองทางการคลัง</td>
                  <td>(รายได้จัดเก็บเอง + รายได้รัฐจัดเก็บให้) ÷ (รายได้รวม − เงินกู้) × 100</td>
                  <td class="whitespace-nowrap">%</td>
                </tr>
                <tr>
                  <td class="whitespace-nowrap font-bold">Y2 - ดุลการดำเนินงานประจำปี</td>
                  <td>(รายได้ − ค่าใช้จ่าย) ÷ รายได้รวม × 100</td>
                  <td class="whitespace-nowrap">%</td>
                </tr>
                <tr>
                  <td class="whitespace-nowrap font-bold">Y3 - Cash Coverage Ratio</td>
                  <td>เงินสดและรายการเทียบเท่าเงินสด ÷ (ภาระผูกพัน + หนี้สินหมุนเวียน)</td>
                  <td class="whitespace-nowrap">เท่า</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </section>
  `,
})
export class RiskIndicatorsPageComponent implements OnInit {
  private readonly state = inject(FinancialHealthStateService);

  readonly error = this.state.error;
  readonly subdistricts = this.state.subdistricts;
  readonly selectedSubdistrictId = this.state.selectedSubdistrictId;
  readonly selectedYear = this.state.selectedYear;
  readonly factorCards = this.state.factorCards;

  readonly bandColor = bandColor;
  readonly matrixChip = matrixChip;
  readonly isComputable = this.state.isComputable.bind(this.state);
  readonly observedValueText = this.state.observedValueText.bind(this.state);

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
