import { Component, input, output } from '@angular/core';

import { Subdistrict } from '../../core/models/domain.models';
import { FISCAL_YEARS, subdistrictLabel } from '../utils/risk-utils';

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  template: `
    <div class="grid gap-3.5 rounded-[4px] border-[1.5px] border-line bg-white px-[18px] py-4 sm:grid-cols-2 lg:grid-cols-4">
      @if (showSearch()) {
        <label class="block sm:col-span-2">
          <span class="text-[12.5px] font-bold text-muted">ค้นหาโครงการ</span>
          <input
            type="search"
            class="gov-input mt-[5px]"
            [placeholder]="searchPlaceholder()"
            [value]="searchValue()"
            (input)="searchChange.emit($any($event.target).value)"
          />
        </label>
      }

      <label class="block">
        <span class="text-[12.5px] font-bold text-muted">ตำบล</span>
        <select
          class="gov-select mt-[5px]"
          [value]="selectedSubdistrictId() ?? 'all'"
          (change)="onSubdistrictChange($any($event.target).value)"
        >
          <option value="all">ทุกตำบลที่มีสิทธิ์</option>
          @for (subdistrict of subdistricts(); track subdistrict.subdistrict_id) {
            <option [value]="subdistrict.subdistrict_id">{{ labelFor(subdistrict) }}</option>
          }
        </select>
      </label>

      @if (showYearFilter()) {
        <label class="block">
          <span class="text-[12.5px] font-bold text-muted">ปีงบประมาณ</span>
          <select
            class="gov-select mt-[5px]"
            [value]="selectedYear() ?? 'all'"
            (change)="onYearChange($any($event.target).value)"
          >
            <option value="all">ทุกปี</option>
            @for (year of yearOptions(); track year) {
              <option [value]="year">{{ year }}</option>
            }
          </select>
        </label>
      }

      @if (showRiskFilter()) {
        <label class="block">
          <span class="text-[12.5px] font-bold text-muted">ระดับความเสี่ยง</span>
          <select
            class="gov-select mt-[5px]"
            [value]="selectedRiskLevel() ?? 'all'"
            (change)="onRiskChange($any($event.target).value)"
          >
            <option value="all">ทุกระดับ</option>
            <option value="high">เสี่ยงสูง</option>
            <option value="medium">เสี่ยงปานกลาง</option>
            <option value="low">เสี่ยงต่ำ</option>
          </select>
        </label>
      }

      <div class="flex items-end">
        <button
          type="button"
          class="inline-flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-[3px] border-[1.5px] border-line bg-white px-3 text-[13.5px] font-bold text-slate-700 hover:bg-zebra"
          (click)="reset.emit()"
        >
          ↺ รีเซ็ตตัวกรอง
        </button>
      </div>
    </div>
  `,
})
export class FilterBarComponent {
  readonly subdistricts = input<Subdistrict[]>([]);
  readonly selectedSubdistrictId = input<number | null>(null);
  readonly selectedYear = input<number | null>(null);
  readonly selectedRiskLevel = input<string | null>(null);
  readonly showYearFilter = input(true);
  readonly showRiskFilter = input(true);
  readonly yearOptions = input<readonly number[]>(FISCAL_YEARS);
  readonly showSearch = input(false);
  readonly searchValue = input('');
  readonly searchPlaceholder = input('ค้นหาชื่อโครงการ หรือ Project ID');

  readonly selectedSubdistrictIdChange = output<number | null>();
  readonly selectedYearChange = output<number | null>();
  readonly selectedRiskLevelChange = output<string | null>();
  readonly reset = output<void>();
  readonly searchChange = output<string>();

  labelFor(subdistrict: Subdistrict): string {
    return subdistrictLabel(subdistrict);
  }

  onSubdistrictChange(value: string): void {
    this.selectedSubdistrictIdChange.emit(value === 'all' ? null : Number(value));
  }

  onYearChange(value: string): void {
    this.selectedYearChange.emit(value === 'all' ? null : Number(value));
  }

  onRiskChange(value: string): void {
    this.selectedRiskLevelChange.emit(value === 'all' ? null : value);
  }
}
