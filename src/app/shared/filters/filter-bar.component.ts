import { Component, inject, input, output } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
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
        <span class="text-[12.5px] font-bold text-muted">
          ตำบล
          @if (scopeLocked()) {
            <span class="ml-1 font-bold text-[#8a2a1f]">(ล็อกตามสิทธิ์ของคุณ)</span>
          }
        </span>
        @if (scopeLocked()) {
          <!-- role ที่จำกัดพื้นที่ (local_executive/project_auditor/risk_analyst) เลือกตำบลอื่นไม่ได้ -->
          <select class="gov-select mt-[5px] cursor-not-allowed bg-zebra" disabled>
            <option>{{ lockedSubdistrictLabel() }}</option>
          </select>
        } @else {
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
        }
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

      @if (showProjectTypeFilter()) {
        <label class="block">
          <span class="text-xs font-semibold text-slate-500">ประเภทโครงการ</span>
          <select
            class="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-900"
            [value]="selectedProjectType() ?? 'all'"
            (change)="onProjectTypeChange($any($event.target).value)"
          >
            <option value="all">ทุกประเภท</option>
            @for (type of projectTypes(); track type) {
              <option [value]="type">{{ type }}</option>
            }
          </select>
        </label>
      }

      @if (showBudgetScopeFilter()) {
        <div class="grid gap-3 sm:grid-cols-2 lg:col-span-2">
          <label class="block">
            <span class="text-xs font-semibold text-slate-500">งบประมาณตั้งแต่</span>
            <input
              type="number"
              inputmode="numeric"
              min="0"
              class="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-900"
              placeholder="0"
              [value]="budgetAmountMin()"
              (input)="budgetAmountMinChange.emit($any($event.target).value)"
            />
          </label>

          <label class="block">
            <span class="text-xs font-semibold text-slate-500">ถึง</span>
            <input
              type="number"
              inputmode="numeric"
              min="0"
              class="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-900"
              placeholder="0"
              [value]="budgetAmountMax()"
              (input)="budgetAmountMaxChange.emit($any($event.target).value)"
            />
          </label>
        </div>
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
  private readonly auth = inject(AuthService);

  readonly subdistricts = input<Subdistrict[]>([]);
  readonly selectedSubdistrictId = input<number | null>(null);
  readonly selectedYear = input<number | null>(null);
  readonly selectedRiskLevel = input<string | null>(null);
  readonly selectedProjectType = input<string | null>(null);
  readonly budgetAmountMin = input('');
  readonly budgetAmountMax = input('');
  readonly showYearFilter = input(true);
  readonly showRiskFilter = input(true);
  readonly showProjectTypeFilter = input(false);
  readonly showBudgetScopeFilter = input(false);
  readonly yearOptions = input<readonly number[]>(FISCAL_YEARS);
  readonly showSearch = input(false);
  readonly searchValue = input('');
  readonly searchPlaceholder = input('ค้นหาชื่อโครงการ หรือ Project ID');
  readonly projectTypes = input<readonly string[]>([]);

  readonly selectedSubdistrictIdChange = output<number | null>();
  readonly selectedYearChange = output<number | null>();
  readonly selectedRiskLevelChange = output<string | null>();
  readonly selectedProjectTypeChange = output<string | null>();
  readonly budgetAmountMinChange = output<string>();
  readonly budgetAmountMaxChange = output<string>();
  readonly reset = output<void>();
  readonly searchChange = output<string>();

  labelFor(subdistrict: Subdistrict): string {
    return subdistrictLabel(subdistrict);
  }

  /** role ถูกจำกัดพื้นที่ → ล็อกตัวกรองตำบล (backend คืน /subdistricts เฉพาะตำบลของตนอยู่แล้ว) */
  scopeLocked(): boolean {
    return this.auth.isScopedRole();
  }

  lockedSubdistrictLabel(): string {
    const rows = this.subdistricts();
    return rows.length ? subdistrictLabel(rows[0]) : 'ตำบลของคุณ';
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

  onProjectTypeChange(value: string): void {
    this.selectedProjectTypeChange.emit(value === 'all' ? null : value);
  }
}
