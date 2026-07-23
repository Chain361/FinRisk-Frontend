import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AssignmentAssignee, AuditAssignment, Project, Subdistrict } from '../../core/models/domain.models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { formatMoney, normalizeRiskLevel, subdistrictLabel } from '../../shared/utils/risk-utils';
import {
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
  imports: [FormsModule, RouterLink, EmptyStateComponent],
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
                @for (analyst of analysts(); track analyst.id) {
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
            <table class="gov-table min-w-[1180px]">
              <thead>
                <tr>
                  <th class="w-[116px]">วันที่มอบหมาย</th>
                  <th class="w-[390px]">โครงการ</th>
                  <th class="w-[128px]">Due date</th>
                  <th class="w-[140px]">ผู้รับมอบหมาย</th>
                  <th class="w-[112px]">ความเสี่ยง</th>
                  <th>คำแนะนำ</th>
                  @if (canDeleteHistory()) {
                    <th class="w-[92px] text-right">จัดการ</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of filteredRows(); track row.key) {
                  <tr>
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
                        class="line-clamp-3 max-w-[380px] font-extrabold leading-6 text-ink no-underline hover:text-navy hover:underline"
                        [title]="row.projectName"
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
                      @if (row.assignment.dueDate) {
                        <div class="inline-flex min-w-[104px] flex-col rounded-[4px] border border-blue-100 bg-blue-50 px-3 py-2 text-sm leading-5 text-navy">
                          <span class="text-[11px] font-extrabold uppercase tracking-wide text-muted">Due date</span>
                          <span class="mt-0.5 font-extrabold">{{ formatDueDate(row.assignment.dueDate) }}</span>
                        </div>
                      } @else {
                        <span class="text-sm italic text-slate-400">ยังไม่ระบุ</span>
                      }
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
                      @if (row.assignment.budgetHours || row.assignment.auditSteps) {
                        <div class="mt-2 max-w-[320px] rounded-[4px] bg-slate-50 p-2 text-xs leading-5 text-muted">
                          @if (row.assignment.budgetHours) {
                            <p class="m-0"><span class="font-bold text-ink">Budget:</span> {{ row.assignment.budgetHours }} ชม.</p>
                          }
                          @if (row.assignment.auditSteps) {
                            <p class="m-0"><span class="font-bold text-ink">Audit steps:</span> {{ row.assignment.auditSteps }}</p>
                          }
                        </div>
                      }
                    </td>
                    @if (canDeleteHistory()) {
                      <td class="align-top text-right">
                        <button
                          type="button"
                          class="gov-btn-outline border-risk-high px-3 py-2 text-xs text-risk-high disabled:cursor-not-allowed disabled:opacity-60"
                          [disabled]="deletingAssignmentId() === row.assignment.assignmentId"
                          (click)="deleteHistory(row)"
                        >
                          @if (deletingAssignmentId() === row.assignment.assignmentId) {
                            กำลังลบ...
                          } @else {
                            ลบ
                          }
                        </button>
                      </td>
                    }
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
export class AssignmentProjectAuditorHistoryPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly analysts = signal<Analyst[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly assignments = signal<SavedAssignment[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly search = signal('');
  readonly analystFilter = signal('all');
  readonly deletingAssignmentId = signal<number | null>(null);
  readonly canDeleteHistory = computed(() => this.auth.hasRole('admin'));

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

  ngOnInit(): void {
    this.reloadAssignments();
    forkJoin({
      projects: this.api.projects().pipe(catchError(() => of<Project[]>([]))),
      subdistricts: this.api.subdistricts().pipe(catchError(() => of<Subdistrict[]>([]))),
      analysts: this.api.assignmentAssignees().pipe(catchError(() => of<AssignmentAssignee[]>([]))),
    }).subscribe({
      next: ({ projects, subdistricts, analysts }) => {
        this.projects.set(projects);
        this.subdistricts.set(subdistricts);
        this.analysts.set(analysts.map((analyst) => this.toAnalyst(analyst)));
        this.loading.set(false);
      },
      error: () => {
        this.error.set('โหลดข้อมูลประกอบประวัติการมอบหมายงานไม่สำเร็จ');
        this.loading.set(false);
      },
    });
  }

  reloadAssignments(): void {
    this.error.set('');
    this.api.assignments().subscribe({
      next: (assignments) => this.assignments.set(assignments.map((assignment) => this.toSavedAssignment(assignment))),
      error: () => this.error.set('โหลดประวัติการมอบหมายงานจากระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'),
    });
  }

  deleteHistory(row: AssignmentHistoryRow): void {
    const assignmentId = row.assignment.assignmentId;
    if (!assignmentId) {
      this.error.set('ไม่พบรหัสรายการประวัติที่จะลบ กรุณารีเฟรชหน้าแล้วลองใหม่');
      return;
    }
    const confirmed = window.confirm(`ต้องการลบประวัติการมอบหมายงานของโครงการ "${row.projectName}" ใช่หรือไม่?`);
    if (!confirmed) {
      return;
    }
    this.error.set('');
    this.deletingAssignmentId.set(assignmentId);
    this.api.deleteAssignment(assignmentId).subscribe({
      next: () => {
        this.deletingAssignmentId.set(null);
        this.reloadAssignments();
      },
      error: () => {
        this.deletingAssignmentId.set(null);
        this.error.set('ลบประวัติจากระบบไม่สำเร็จ กรุณาตรวจสิทธิ์หรือโหลดข้อมูลใหม่อีกครั้ง');
      },
    });
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
    const analyst = this.analysts().find((item) => item.id === assignment.analystId) ?? null;
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
    const date = this.parseBackendDate(value);
    return Number.isNaN(date.getTime())
      ? '-'
      : new Intl.DateTimeFormat('th-TH', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Bangkok',
        }).format(date);
  }

  formatDueDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
      return value;
    }
    return new Intl.DateTimeFormat('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(year, month - 1, day));
  }

  private dateValue(value: string): number {
    const date = this.parseBackendDate(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private parseBackendDate(value: string): Date {
    if (!value) {
      return new Date(Number.NaN);
    }
    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(normalized);
    return new Date(hasTimezone ? normalized : `${normalized}Z`);
  }

  private toAnalyst(analyst: AssignmentAssignee): Analyst {
    return {
      id: String(analyst.user_id),
      name: analyst.display_name || analyst.username,
      team: 'นักวิเคราะห์ความเสี่ยง',
      activeCases: analyst.active_cases,
      specialties: [],
    };
  }

  private toSavedAssignment(assignment: AuditAssignment): SavedAssignment {
    return {
      assignmentId: assignment.assignment_id,
      projectId: assignment.project_id,
      analystId: String(assignment.assigned_to),
      assignedAt: assignment.created_at,
      priority: assignment.priority,
      note: assignment.note,
      dueDate: assignment.due_date ?? undefined,
      budgetHours: assignment.budget_hours ?? undefined,
      auditSteps: assignment.audit_steps,
      workflowStatus: assignment.status,
      assignedBy: assignment.assigned_by_display_name || assignment.assigned_by_username || undefined,
    };
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
