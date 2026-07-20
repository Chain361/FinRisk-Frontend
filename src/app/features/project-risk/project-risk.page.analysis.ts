import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { BarChartComponent } from '../../shared/charts/bar-chart.component';
import { FilterBarComponent } from '../../shared/filters/filter-bar.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { ProjectRiskStateService } from './project-risk-state.service';

@Component({
  selector: 'app-project-risk-analysis-page',
  standalone: true,
  imports: [BarChartComponent, EmptyStateComponent, FilterBarComponent, RouterLink],
  template: `
    <section class="page-shell">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F1 · วิเคราะห์เชิงลึก</p>
          <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">ประเด็นที่ควรตรวจสอบต่อ</h1>
          <p class="m-0 mt-1.5 text-sm text-muted">วิเคราะห์ผู้รับจ้าง รายการซ้ำ แนวโน้มงบ และ Financial Risk Coverage</p>
        </div>
        <a
          class="gov-button whitespace-nowrap"
          [routerLink]="['/project-risk']"
          [queryParams]="state.routeQueryParams()"
        >
          กลับสู่ภาพรวม
        </a>
      </div>

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

      <section class="panel p-[18px]">
        <div class="mb-4">
          <h2 class="m-0 text-[16px] font-bold text-ink">ผู้รับจ้างที่ได้รับงานบ่อยที่สุด</h2>
          <p class="m-0 mt-1 text-[13px] text-muted">Top 10 ผู้รับจ้างตามจำนวนโครงการ ภายใต้ตัวกรองที่เลือก</p>
        </div>

        <div class="mb-4 grid gap-3.5 md:grid-cols-[1.2fr_0.8fr]">
          <label class="block">
            <span class="text-[12.5px] font-bold text-muted">ค้นหาผู้รับจ้าง</span>
            <input
              type="search"
              class="gov-input mt-[5px]"
              placeholder="พิมพ์ชื่อผู้รับจ้าง"
              [value]="state.vendorSearchText()"
              (input)="state.setVendorSearch($any($event.target).value)"
            />
          </label>
          <label class="block">
            <span class="text-[12.5px] font-bold text-muted">ประเภทโครงการ</span>
            <select
              class="gov-select mt-[5px]"
              [value]="state.selectedProjectType() ?? 'all'"
              (change)="state.setProjectType($any($event.target).value)"
            >
              <option value="all">ทุกประเภท</option>
              @for (type of state.projectTypes(); track type) {
                <option [value]="type">{{ type }}</option>
              }
            </select>
          </label>
        </div>

        @if (!state.vendorRankings().length) {
          <app-empty-state title="ไม่พบข้อมูลผู้รับจ้าง" message="ลองเปลี่ยนตัวกรองหรือคำค้นหาอีกครั้ง" />
        } @else {
          <div class="overflow-x-auto">
            <table class="gov-table min-w-[900px]">
              <thead>
                <tr>
                  <th>อันดับ</th>
                  <th>ผู้รับจ้าง</th>
                  <th class="text-right!">จำนวนโครงการ</th>
                  <th class="text-right!">จำนวนครั้งที่ชนะ</th>
                  <th class="text-right!">มูลค่าสัญญารวม</th>
                  <th>รายชื่อโครงการตัวอย่าง</th>
                </tr>
              </thead>
              <tbody>
                @for (vendor of state.vendorRankings(); track vendor.vendorName) {
                  <tr>
                    <td class="font-bold">{{ $index + 1 }}</td>
                    <td>
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="font-bold text-ink">{{ vendor.vendorName }}</span>
                        @if (vendor.isRecurring) {
                          <span class="rounded-[3px] bg-risk-low px-2 py-0.5 text-[11px] font-bold text-white">Recurring Vendor</span>
                        }
                        @if (vendor.isFrequentWinner) {
                          <span class="rounded-[3px] bg-chart-blue-deep px-2 py-0.5 text-[11px] font-bold text-white">Frequent Winner</span>
                        }
                      </div>
                    </td>
                    <td class="text-right">{{ vendor.projectCount }}</td>
                    <td class="text-right">{{ vendor.winCount }}</td>
                    <td class="text-right">{{ state.money(vendor.totalContractValue) }}</td>
                    <td class="text-muted">
                      <div class="flex flex-wrap gap-1">
                        @for (projectName of vendor.sampleProjects; track projectName) {
                          <span class="rounded-[3px] border border-line-soft bg-zebra px-2 py-0.5 text-xs">{{ projectName }}</span>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>

      <div class="grid gap-4 xl:grid-cols-2">
        <app-bar-chart
          [title]="'งบเฉลี่ยตามประเภทโครงการ (ปี ' + state.FISCAL_YEARS[0] + '-' + state.FISCAL_YEARS[state.FISCAL_YEARS.length - 1] + ')'"
          subtitle="ปีที่ไม่มีโครงการประเภทนั้นจะเว้นช่อง ไม่แทนด้วย 0"
          [categories]="state.fiscalYearLabels"
          [series]="state.averageBudgetBarSeries()"
          unitSuffix="บาท"
          rowHeader="ประเภทโครงการ"
          [compactValueLabels]="true"
        />
        <app-bar-chart
          [title]="state.selectedSubdistrictId() ? 'ความเสี่ยงข้ามปี (ตำบลที่เลือก)' : 'ความเสี่ยงข้ามปี (ทุกตำบล)'"
          [subtitle]="state.selectedSubdistrictId() ? 'จำนวนโครงการตามระดับความเสี่ยงรายปี' : 'จำนวนโครงการเสี่ยงสูงรายปี แยกตามตำบล'"
          [categories]="state.fiscalYearLabels"
          [series]="state.riskTrendBarSeries()"
          unitSuffix="โครงการ"
          [rowHeader]="state.selectedSubdistrictId() ? 'ระดับความเสี่ยง' : 'ตำบล'"
        />
      </div>

      <div class="grid gap-3 xl:grid-cols-2">
        <section class="panel overflow-hidden">
          <div class="border-b-[1.5px] border-line px-[18px] py-4">
            <h2 class="m-0 text-[16px] font-bold text-ink">รายการที่ซ้ำข้ามปี</h2>
            <p class="m-0 mt-1 text-[13px] text-muted">แสดงผู้รับจ้าง/ประเภท/วิธีจัดซื้อที่พบอย่างน้อย 2 ปีงบประมาณ</p>
          </div>
          @if (!state.repeatedEntities().length) {
            <div class="p-4">
              <app-empty-state title="ยังไม่พบรายการซ้ำ 2 ปีขึ้นไป" message="ข้อมูลในขอบเขตปัจจุบันอาจมีเพียงปีเดียว" />
            </div>
          } @else {
            <div class="overflow-x-auto">
              <table class="gov-table">
                <thead>
                  <tr>
                    <th>รายการ</th>
                    <th>ปีที่พบ</th>
                    <th class="text-right!">จำนวน</th>
                    <th class="text-right!">งบรวม (บาท)</th>
                  </tr>
                </thead>
                <tbody>
                  @for (entity of state.repeatedEntities(); track entity.label) {
                    <tr>
                      <td class="font-bold">{{ entity.label }}</td>
                      <td>{{ entity.years.join(', ') }}</td>
                      <td class="text-right">{{ entity.count }}</td>
                      <td class="text-right">{{ state.money(entity.totalBudget) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>

        <section class="panel p-[18px]">
          <h2 class="m-0 mb-0.5 text-[16px] font-bold text-ink">Financial Risk Coverage</h2>
          <p class="m-0 mb-3.5 text-[13px] text-muted">สรุปปัจจัยที่คำนวณและประเมินไม่ได้รายปี</p>
          <div class="grid grid-cols-3 gap-3.5">
            @for (year of state.FISCAL_YEARS; track year) {
              <div class="rounded-[4px] border-[1.5px] border-line p-3.5">
                <div class="flex items-center justify-between">
                  <p class="m-0 text-sm font-extrabold text-ink">ปี {{ year }}</p>
                  <p class="m-0 text-xs text-muted">{{ state.annualRowsForYear(year).length }} factors</p>
                </div>
                <div class="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div class="rounded-[3px] border border-[#a9d9bb] bg-[#e9f6ee] px-1 py-2 text-[#0f5132]">
                    <p class="m-0 text-[16px] font-extrabold">{{ state.annualComputableCount(year) }}</p>
                    <p class="m-0 mt-0.5">คำนวณได้</p>
                  </div>
                  <div class="rounded-[3px] border border-[#c7cfd8] bg-page px-1 py-2 text-slate-700">
                    <p class="m-0 text-[16px] font-extrabold">{{ state.annualNotComputableCount(year) }}</p>
                    <p class="m-0 mt-0.5">ประเมินไม่ได้</p>
                  </div>
                  <div class="rounded-[3px] border border-[#f0c2c2] bg-red-50 px-1 py-2 text-risk-high">
                    <p class="m-0 text-[16px] font-extrabold">{{ state.annualHighCount(year) }}</p>
                    <p class="m-0 mt-0.5">เสี่ยงสูง</p>
                  </div>
                </div>
              </div>
            }
          </div>
        </section>
      </div>

      <section class="panel overflow-hidden">
        <div class="border-b-[1.5px] border-line px-[18px] py-4">
          <h2 class="m-0 text-[16px] font-bold text-ink">โครงการผิดปกติที่ควรตรวจสอบ</h2>
          <p class="m-0 mt-1 text-[13px] text-muted">
            แสดงโครงการที่มีระดับเสี่ยงสูง คะแนนความเสี่ยงตั้งแต่ 70 หรือราคาเบี่ยงจากราคากลางมาก
          </p>
        </div>
        @if (!state.anomalies().length) {
          <div class="p-4">
            <app-empty-state title="ไม่พบโครงการที่เข้าเกณฑ์ผิดปกติ" message="ไม่มีโครงการในขอบเขตปัจจุบันที่ต้องตรวจสอบเพิ่มเติม" />
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="gov-table min-w-[980px]">
              <thead>
                <tr>
                  <th>โครงการ</th>
                  <th>ผู้รับจ้าง</th>
                  <th>ระดับความเสี่ยง</th>
                  <th class="text-right!">คะแนน</th>
                  <th class="text-right!">Price ratio</th>
                  <th>เหตุผลที่เข้าเกณฑ์</th>
                </tr>
              </thead>
              <tbody>
                @for (item of state.anomalies(); track item.project.project_name) {
                  <tr>
                    <td class="font-bold">{{ item.project.project_name || '-' }}</td>
                    <td>{{ item.project.winner_name || item.project.vendor_name || item.project.contractor_name || '-' }}</td>
                    <td>{{ item.project.risk_level || '-' }}</td>
                    <td class="text-right">{{ state.number(item.project.risk_score, 0) }}</td>
                    <td class="text-right">{{ state.number(item.project.price_ratio) }}</td>
                    <td class="text-muted">{{ item.reason }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </section>
  `,
})
export class ProjectRiskAnalysisPageComponent implements OnInit {
  readonly state = inject(ProjectRiskStateService);

  ngOnInit(): void {
    this.state.initialize();
  }
}