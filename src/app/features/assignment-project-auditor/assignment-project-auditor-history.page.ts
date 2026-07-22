import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { Project, Subdistrict } from '../../core/models/domain.models';
import { ConfirmModalComponent } from '../../shared/ui/confirm-modal.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { formatMoney, normalizeRiskLevel, subdistrictLabel } from '../../shared/utils/risk-utils';
import {
  ANALYSTS,
  ASSIGNMENT_STORAGE_KEY,
  Analyst,
  SavedAssignment,
} from './assignment-project-auditor.models';

interface AssignmentHistoryRow {
  key: string;
  assignment: SavedAssignment;
  project: Project | null;
  analyst: Analyst | null;
  projectName: string;
  subdistrictName: string;
  assignedAtText: string;
  searchText: string;
}

@Component({
  selector: 'app-assignment-project-auditor-history-page',
  standalone: true,
  imports: [FormsModule, RouterLink, ConfirmModalComponent, EmptyStateComponent],
  template: `
    <section class="page-shell">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F4.2</p>
          <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">ประวัติการมอบหมายงาน</h1>
          <p class="m-0 mt-1.5 text-sm text-muted">
            ตรวจสอบรายการมอบหมายโครงการให้ผู้ตรวจสอบ/นักวิเคราะห์ความเสี่ยงจากข้อมูลที่บันทึกไว้ในเครื่อง
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="gov-btn-outline" (click)="reloadAssignments()">รีเฟรชประวัติ</button>
          @if (isAdmin()) {
            <button
              type="button"
              class="min-h-[42px] cursor-pointer rounded-[3px] border-[1.5px] border-risk-high bg-white px-5 text-sm font-extrabold text-risk-high hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              [disabled]="!selectedCount()"
              (click)="requestDeleteSelected()"
            >
              ลบรายการที่เลือก
            </button>
          }
        </div>
      </div>

      @if (error()) {
        <div class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high">
          {{ error() }}
        </div>
      }

      <div class="grid gap-4 md:grid-cols-2">
        <div class="panel p-4">
          <p class="m-0 text-xs font-bold text-muted">รายการมอบหมายทั้งหมด</p>
          <p class="m-0 mt-1 text-[26px] font-extrabold text-navy">{{ assignments().length }}</p>
        </div>
        <div class="panel p-4">
          <p class="m-0 text-xs font-bold text-muted">มอบหมายล่าสุด</p>
          <p class="m-0 mt-2 text-sm font-extrabold leading-6 text-ink">{{ latestAssignmentText() }}</p>
        </div>
      </div>

      <section class="panel overflow-hidden">
        <div class="border-b border-line-soft px-[18px] py-4">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 class="m-0 text-[17px] font-extrabold text-ink">รายการประวัติ</h2>
              <p class="m-0 mt-1 text-[13px] text-muted">ค้นหาโครงการ ผู้รับมอบหมาย หรือคำแนะนำที่เคยบันทึกไว้</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              @if (isAdmin() && selectedCount()) {
                <span class="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-risk-high">เลือกแล้ว {{ selectedCount() }} รายการ</span>
              }
              <span class="rounded-full bg-navy px-2.5 py-1 text-xs font-bold text-white">{{ filteredRows().length }} รายการ</span>
            </div>
          </div>

          <div class="mt-3 grid gap-2 md:grid-cols-[1fr_220px]">
            <label>
              <span class="sr-only">ค้นหาประวัติการมอบหมายงาน</span>
              <input
                class="gov-input"
                type="search"
                placeholder="ค้นหาโครงการ ผู้รับมอบหมาย หรือหมายเหตุ"
                [ngModel]="search()"
                (ngModelChange)="search.set($event)"
              />
            </label>
            <label>
              <span class="sr-only">กรองผู้รับมอบหมาย</span>
              <select class="gov-select" [ngModel]="analystFilter()" (ngModelChange)="analystFilter.set($event)">
                <option value="all">ทุกผู้รับมอบหมาย</option>
                @for (analyst of analysts; track analyst.id) {
                  <option [value]="analyst.id">{{ analyst.name }}</option>
                }
              </select>
            </label>
          </div>
        </div>

        @if (loading()) {
          <p class="px-[18px] py-8 text-center text-sm text-muted">กำลังโหลดประวัติการมอบหมายงาน...</p>
        } @else if (!filteredRows().length) {
          <div class="p-[18px]">
            <app-empty-state
              title="ยังไม่มีประวัติการมอบหมายงาน"
              message="เมื่อยืนยันการมอบหมายจากเมนู F4.1 รายการจะถูกบันทึกและแสดงในหน้านี้"
            />
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="gov-table min-w-[1040px]">
              <thead>
                <tr>
                  @if (isAdmin()) {
                    <th class="w-[54px] text-center">
                      <input
                        type="checkbox"
                        class="h-4 w-4 cursor-pointer accent-navy"
                        aria-label="เลือกประวัติที่แสดงทั้งหมด"
                        [ngModel]="allFilteredRowsSelected()"
                        [indeterminate]="someFilteredRowsSelected()"
                        (ngModelChange)="setFilteredRowsSelected($event)"
                      />
                    </th>
                  }
                  <th>วันที่มอบหมาย</th>
                  <th>โครงการ</th>
                  <th>ผู้รับมอบหมาย</th>
                  <th>ความเสี่ยง</th>
                  <th>คำแนะนำ</th>
                </tr>
              </thead>
              <tbody>
                @for (row of filteredRows(); track row.key) {
                  <tr>
                    @if (isAdmin()) {
                      <td class="text-center align-top">
                        <input
                          type="checkbox"
                          class="h-4 w-4 cursor-pointer accent-navy"
                          aria-label="เลือกประวัติรายการนี้"
                          [ngModel]="isSelected(row.key)"
                          (ngModelChange)="setSelection(row.key, $event)"
                        />
                      </td>
                    }
                    <td class="align-top">
                      <p class="m-0 font-bold text-ink">{{ row.assignedAtText }}</p>
                      <p class="m-0 mt-1 text-xs text-muted">
                        โดย
                        @if (row.assignment.assignedBy) {
                          {{ row.assignment.assignedBy }}
                        } @else {
                          <span class="italic text-slate-400">ยังไม่มีข้อมูล</span>
                        }
                      </p>
                    </td>
                    <td class="align-top">
                      <a
                        routerLink="/risk-factors"
                        [queryParams]="{ projectId: row.assignment.projectId }"
                        class="font-extrabold leading-6 text-ink no-underline hover:text-navy hover:underline"
                      >
                        {{ row.projectName }}
                      </a>
                      <div class="mt-2 flex flex-wrap gap-1.5">
                        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{{ row.subdistrictName }}</span>
                        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                          ปีงบ
                          @if (row.project?.budget_year) {
                            {{ row.project?.budget_year }}
                          } @else {
                            <span class="font-normal italic text-slate-400">ยังไม่มีข้อมูล</span>
                          }
                        </span>
                        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">รหัส {{ row.assignment.projectId }}</span>
                      </div>
                    </td>
                    <td class="align-top">
                      <p class="m-0 font-bold text-ink">{{ row.analyst?.name || row.assignment.analystId }}</p>
                      @if (row.analyst?.team) {
                        <p class="m-0 mt-1 text-xs text-muted">{{ row.analyst?.team }}</p>
                      } @else {
                        <p class="m-0 mt-1 text-xs italic text-slate-400">ยังไม่มีข้อมูล</p>
                      }
                    </td>
                    <td class="align-top">
                      <span class="rounded-full px-2.5 py-1 text-xs font-bold" [class]="riskBadgeClass(row.project)">
                        {{ riskLabel(row.project) }}
                      </span>
                    </td>
                    <td class="align-top">
                      @if (row.assignment.note) {
                        <p class="m-0 max-w-[280px] text-sm leading-6 text-ink">{{ row.assignment.note }}</p>
                      } @else {
                        <p class="m-0 text-sm italic text-slate-400">ยังไม่มีข้อมูล</p>
                      }
                      @if (row.assignment.dueDate || row.assignment.budgetHours || row.assignment.auditSteps) {
                        <div class="mt-2 max-w-[320px] rounded-[4px] bg-slate-50 p-2 text-xs leading-5 text-muted">
                          @if (row.assignment.dueDate) {
                            <p class="m-0"><span class="font-bold text-ink">Due date:</span> {{ row.assignment.dueDate }}</p>
                          }
                          @if (row.assignment.budgetHours) {
                            <p class="m-0"><span class="font-bold text-ink">Budget:</span> {{ row.assignment.budgetHours }} ชม.</p>
                          }
                          @if (row.assignment.auditSteps) {
                            <p class="m-0"><span class="font-bold text-ink">Audit steps:</span> {{ row.assignment.auditSteps }}</p>
                          }
                        </div>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </section>

    <app-confirm-modal
      [open]="deleteConfirmOpen()"
      title="ยืนยันการลบรายการที่เลือก"
      [message]="deleteConfirmMessage()"
      confirmLabel="ลบรายการที่เลือก"
      cancelLabel="ยกเลิก"
      (confirmed)="deleteSelectedHistory()"
      (cancelled)="deleteConfirmOpen.set(false)"
    />
  `,
})
export class AssignmentProjectAuditorHistoryPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly analysts = ANALYSTS;
  readonly loading = signal(true);
  readonly error = signal('');
  readonly deleteConfirmOpen = signal(false);
  readonly selectedKeys = signal<string[]>([]);
  readonly assignments = signal<SavedAssignment[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly search = signal('');
  readonly analystFilter = signal('all');

  readonly historyRows = computed<AssignmentHistoryRow[]>(() =>
    this.assignments()
      .map((assignment) => this.toHistoryRow(assignment))
      .sort((a, b) => this.dateValue(b.assignment.assignedAt) - this.dateValue(a.assignment.assignedAt)),
  );

  readonly filteredRows = computed(() => {
    const search = this.search().trim().toLocaleLowerCase('th');
    const analystId = this.analystFilter();
    return this.historyRows().filter(
      (row) =>
        (!search || row.searchText.includes(search)) &&
        (analystId === 'all' || row.assignment.analystId === analystId),
    );
  });

  readonly latestAssignmentText = computed(() => this.historyRows()[0]?.assignedAtText ?? 'ยังไม่มีข้อมูล');
  readonly isAdmin = computed(() => this.auth.hasRole('admin'));
  readonly selectedKeySet = computed(() => new Set(this.selectedKeys()));
  readonly selectedCount = computed(
    () => this.historyRows().filter((row) => this.selectedKeySet().has(row.key)).length,
  );
  readonly allFilteredRowsSelected = computed(() => {
    const rows = this.filteredRows();
    const selectedKeys = this.selectedKeySet();
    return rows.length > 0 && rows.every((row) => selectedKeys.has(row.key));
  });
  readonly someFilteredRowsSelected = computed(() => {
    const rows = this.filteredRows();
    const selectedKeys = this.selectedKeySet();
    return rows.some((row) => selectedKeys.has(row.key)) && !this.allFilteredRowsSelected();
  });
  readonly deleteConfirmMessage = computed(
    () =>
      `ต้องการลบประวัติการมอบหมายงานที่เลือก ${this.selectedCount()} รายการใช่หรือไม่? รายการที่บันทึกไว้ในเครื่องนี้จะถูกลบออก`,
  );

  ngOnInit(): void {
    this.reloadAssignments();
    forkJoin({
      projects: this.api.projects().pipe(catchError(() => of<Project[]>([]))),
      subdistricts: this.api.subdistricts().pipe(catchError(() => of<Subdistrict[]>([]))),
    }).subscribe({
      next: ({ projects, subdistricts }) => {
        this.projects.set(projects);
        this.subdistricts.set(subdistricts);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('โหลดข้อมูลประกอบประวัติการมอบหมายงานไม่สำเร็จ');
        this.loading.set(false);
      },
    });
  }

  reloadAssignments(): void {
    const assignments = this.readAssignments();
    this.assignments.set(assignments);
    this.syncSelectedKeys(assignments);
  }

  requestDeleteSelected(): void {
    if (!this.isAdmin() || !this.selectedCount()) {
      return;
    }
    this.deleteConfirmOpen.set(true);
  }

  deleteSelectedHistory(): void {
    if (!this.isAdmin()) {
      this.deleteConfirmOpen.set(false);
      return;
    }

    const selectedKeys = this.selectedKeySet();
    const remaining = this.assignments().filter(
      (assignment) => !selectedKeys.has(this.assignmentKey(assignment)),
    );
    this.writeAssignments(remaining);
    this.assignments.set(remaining);
    this.selectedKeys.set([]);
    this.deleteConfirmOpen.set(false);
  }

  isSelected(key: string): boolean {
    return this.selectedKeySet().has(key);
  }

  setSelection(key: string, selected: boolean): void {
    const keys = new Set(this.selectedKeys());
    if (selected) {
      keys.add(key);
    } else {
      keys.delete(key);
    }
    this.selectedKeys.set([...keys]);
  }

  setFilteredRowsSelected(selected: boolean): void {
    const keys = new Set(this.selectedKeys());
    this.filteredRows().forEach((row) => {
      if (selected) {
        keys.add(row.key);
      } else {
        keys.delete(row.key);
      }
    });
    this.selectedKeys.set([...keys]);
  }

  riskLabel(project: Project | null): string {
    const risk = normalizeRiskLevel(project?.risk_level);
    return risk === 'high'
      ? 'ความเสี่ยงสูง'
      : risk === 'medium'
        ? 'ความเสี่ยงปานกลาง'
        : risk === 'low'
          ? 'ความเสี่ยงต่ำ'
          : 'ไม่ระบุระดับ';
  }

  riskBadgeClass(project: Project | null): string {
    const risk = normalizeRiskLevel(project?.risk_level);
    return risk === 'high'
      ? 'bg-red-100 text-risk-high'
      : risk === 'medium'
        ? 'bg-orange-100 text-risk-medium'
        : risk === 'low'
          ? 'bg-green-100 text-risk-low'
          : 'bg-slate-100 text-slate-600';
  }

  money(value: number | string | null | undefined): string {
    return value === null || value === undefined ? '-' : formatMoney(value);
  }

  private toHistoryRow(assignment: SavedAssignment): AssignmentHistoryRow {
    const key = this.assignmentKey(assignment);
    const project = this.projects().find((item) => String(item.project_id) === assignment.projectId) ?? null;
    const analyst = ANALYSTS.find((item) => item.id === assignment.analystId) ?? null;
    const subdistrictName = project
      ? subdistrictLabel(this.subdistricts().find((item) => item.subdistrict_id === project.subdistrict_id))
      : 'ยังไม่มีข้อมูล';
    const projectName = project?.project_name || 'ไม่พบข้อมูลโครงการ';
    const assignedAtText = this.formatAssignedAt(assignment.assignedAt);
    const searchText = [
      projectName,
      assignment.projectId,
      subdistrictName,
      analyst?.name,
      analyst?.team,
      assignment.analystId,
      assignment.note,
      assignment.assignedBy,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('th');

    return {
      key,
      assignment,
      project,
      analyst,
      projectName,
      subdistrictName,
      assignedAtText,
      searchText,
    };
  }

  private formatAssignedAt(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '-'
      : new Intl.DateTimeFormat('th-TH', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(date);
  }

  private dateValue(value: string): number {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private readAssignments(): SavedAssignment[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(ASSIGNMENT_STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? (parsed as SavedAssignment[]) : [];
    } catch {
      return [];
    }
  }

  private writeAssignments(assignments: SavedAssignment[]): void {
    if (!assignments.length) {
      localStorage.removeItem(ASSIGNMENT_STORAGE_KEY);
      return;
    }
    localStorage.setItem(ASSIGNMENT_STORAGE_KEY, JSON.stringify(assignments));
  }

  private syncSelectedKeys(assignments: SavedAssignment[]): void {
    const availableKeys = new Set(assignments.map((assignment) => this.assignmentKey(assignment)));
    this.selectedKeys.set(this.selectedKeys().filter((key) => availableKeys.has(key)));
  }

  private assignmentKey(assignment: SavedAssignment): string {
    return [
      assignment.assignedAt,
      assignment.projectId,
      assignment.analystId,
      assignment.workflowStatus,
      assignment.note,
    ].join('|');
  }
}
