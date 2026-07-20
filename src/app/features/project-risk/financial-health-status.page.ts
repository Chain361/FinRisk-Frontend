import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ApiService } from '../../core/api/api.service';
import { AnnualRisk, Subdistrict } from '../../core/models/domain.models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { FISCAL_YEARS, subdistrictLabel, toBool } from '../../shared/utils/risk-utils';

@Component({
  selector: 'app-financial-health-status-page',
  standalone: true,
  imports: [EmptyStateComponent, RouterLink],
  template: `
    <section class="page-shell">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div><p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F1 · สุขภาพการคลัง</p><h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">สถานะและสุขภาพการคลัง</h1><p class="m-0 mt-1.5 text-sm text-muted">สรุปความพร้อมของข้อมูลสำหรับการประเมินความเสี่ยงทางการคลัง</p></div>
        <div class="flex flex-wrap gap-2"><a class="gov-button whitespace-nowrap" [routerLink]="['/project-risk/insights']">ดูการวิเคราะห์เชิงลึก</a><a class="gov-button whitespace-nowrap" [routerLink]="['/project-risk']">กลับสู่ภาพรวม</a></div>
      </div>

      @if (error()) { <p class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high">{{ error() }}</p> }

      <section class="panel p-[18px]">
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div><h2 class="m-0 text-[16px] font-bold text-ink">Financial Risk Coverage</h2><p class="m-0 mt-1 text-[13px] text-muted">แสดงเฉพาะจำนวนปัจจัยที่คำนวณได้ และปัจจัยที่ประเมินไม่ได้</p></div>
          <label class="block min-w-[220px]"><span class="text-[12.5px] font-bold text-muted">ตำบล</span><select class="gov-select mt-[5px]" [value]="selectedSubdistrictId() ?? 'all'" (change)="setSubdistrict($any($event.target).value === 'all' ? null : +$any($event.target).value)"><option value="all">ทุกตำบล</option>@for (subdistrict of subdistricts(); track subdistrict.subdistrict_id) { <option [value]="subdistrict.subdistrict_id">{{ labelSubdistrict(subdistrict) }}</option> }</select></label>
        </div>

        @if (!scopedAnnualRisks().length) {
          <div class="py-10"><app-empty-state title="ไม่พบข้อมูลสุขภาพการคลัง" message="ลองเปลี่ยนตำบล หรือตรวจสอบข้อมูล Annual Risk" /></div>
        } @else {
          <div class="mt-5 grid gap-3.5 md:grid-cols-3">
            @for (year of FISCAL_YEARS; track year) {
              <div class="rounded-[4px] border-[1.5px] border-line p-4">
                <div class="flex items-center justify-between"><p class="m-0 text-base font-extrabold text-ink">ปี {{ year }}</p><p class="m-0 text-xs text-muted">{{ annualRowsForYear(year).length }} ปัจจัย</p></div>
                <div class="mt-4 grid grid-cols-2 gap-3 text-center text-sm">
                  <div class="rounded-[3px] border border-[#a9d9bb] bg-[#e9f6ee] px-2 py-3 text-[#0f5132]"><p class="m-0 text-[22px] font-extrabold">{{ annualComputableCount(year) }}</p><p class="m-0 mt-1 text-xs">คำนวณได้</p></div>
                  <div class="rounded-[3px] border border-[#c7cfd8] bg-page px-2 py-3 text-slate-700"><p class="m-0 text-[22px] font-extrabold">{{ annualNotComputableCount(year) }}</p><p class="m-0 mt-1 text-xs">ประเมินไม่ได้</p></div>
                </div>
              </div>
            }
          </div>
        }
      </section>
    </section>
  `,
})
export class FinancialHealthStatusPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly FISCAL_YEARS = FISCAL_YEARS;
  readonly error = signal('');
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly annualRisks = signal<AnnualRisk[]>([]);
  readonly selectedSubdistrictId = signal<number | null>(null);
  readonly scopedAnnualRisks = computed(() => this.annualRisks().filter((row) => !this.selectedSubdistrictId() || row.subdistrict_id === this.selectedSubdistrictId()));

  ngOnInit(): void {
    this.api.subdistricts().subscribe({ next: (rows) => this.subdistricts.set(rows), error: () => this.error.set('โหลดรายการตำบลไม่สำเร็จ') });
    this.api.annualRisk().subscribe({ next: (rows) => this.annualRisks.set(rows), error: () => this.error.set('โหลดข้อมูลสุขภาพการคลังไม่สำเร็จ') });
  }
  setSubdistrict(value: number | null): void { this.selectedSubdistrictId.set(value); }
  labelSubdistrict(subdistrict: Subdistrict): string { return subdistrictLabel(subdistrict); }
  annualRowsForYear(year: number): AnnualRisk[] { return this.scopedAnnualRisks().filter((row) => row.fiscal_year === year); }
  annualComputableCount(year: number): number { return this.annualRowsForYear(year).filter((row) => toBool(row.computable)).length; }
  annualNotComputableCount(year: number): number { return this.annualRowsForYear(year).filter((row) => !toBool(row.computable)).length; }
}
