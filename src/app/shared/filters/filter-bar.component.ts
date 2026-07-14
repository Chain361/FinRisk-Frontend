import { Component, input, output } from '@angular/core';
import { LucideRotateCcw } from '@lucide/angular';

import { Subdistrict } from '../../core/models/domain.models';
import { FISCAL_YEARS, subdistrictLabel } from '../utils/risk-utils';

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  imports: [LucideRotateCcw],
  template: `
    <div class="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      <label class="block">
        <span class="text-xs font-semibold text-slate-500">ตำบล</span>
        <select
          class="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-900"
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
          <span class="text-xs font-semibold text-slate-500">ปีงบประมาณ</span>
          <select
            class="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-900"
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
          <span class="text-xs font-semibold text-slate-500">ระดับความเสี่ยง</span>
          <select
            class="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-900"
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
          class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          (click)="reset.emit()"
        >
          <svg lucideRotateCcw class="size-4"></svg>
          รีเซ็ต
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
  readonly selectedProjectType = input<string | null>(null);
  readonly budgetAmountMin = input('');
  readonly budgetAmountMax = input('');
  readonly showYearFilter = input(true);
  readonly showRiskFilter = input(true);
  readonly showProjectTypeFilter = input(false);
  readonly showBudgetScopeFilter = input(false);
  readonly yearOptions = input<readonly number[]>(FISCAL_YEARS);
  readonly projectTypes = input<readonly string[]>([]);

  readonly selectedSubdistrictIdChange = output<number | null>();
  readonly selectedYearChange = output<number | null>();
  readonly selectedRiskLevelChange = output<string | null>();
  readonly selectedProjectTypeChange = output<string | null>();
  readonly budgetAmountMinChange = output<string>();
  readonly budgetAmountMaxChange = output<string>();
  readonly reset = output<void>();

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

  onProjectTypeChange(value: string): void {
    this.selectedProjectTypeChange.emit(value === 'all' ? null : value);
  }
}
