/**
 * RiskAnalystMyTasksPageComponent
 *
 * หน้า Dashboard สำหรับ Risk Analyst (นักตรวจสอบภายใน)
 * แสดงรายการงานที่ถูกมอบหมายจาก Project Auditor (อ่านอย่างเดียว — ดึงจาก GET /audit/assignments)
 */

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AuditAssignment, Project, Subdistrict } from '../../core/models/domain.models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import {
  assignmentWorkflowStatusBadgeClass,
  assignmentWorkflowStatusLabel,
} from '../assignment-project-auditor/assignment-project-auditor.models';

/**
 * โครงสร้างข้อมูลแถวงานสำหรับ Analyst
 * — ดึงข้อมูลจาก AuditAssignment + Project + Subdistrict เพื่อแสดงผลที่สมบูรณ์
 */
interface MyTaskRow {
  key: string;
  assignment: AuditAssignment;
  project: Project | null;
  projectName: string;
  assignedBy: string;
  subdistrictName: string;
  dueDateText: string;
  searchText: string;
}

@Component({
  selector: 'app-risk-analyst-my-tasks-page',
  standalone: true,
  imports: [FormsModule, RouterLink, EmptyStateComponent],
  template: `
    <section class="page-shell">
      <!-- Header -->
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 class="m-0 text-[26px] font-extrabold text-ink">งานที่ได้รับมอบหมาย</h1>
          <p class="m-0 mt-1.5 text-sm text-muted">
            รายการโครงการที่ถูกมอบหมายให้คุณตรวจสอบ — ดูรายละเอียดและสถานะงาน
          </p>
        </div>
        <div class="flex gap-2">
          <button type="button" class="gov-btn-outline" (click)="reloadAll()">รีเฟรชรายการ</button>
          <a
            routerLink="/risk-analyst-feedback"
            class="gov-btn-outline inline-flex items-center justify-center text-center no-underline"
          >
            เพิ่มบันทึกความเห็น
          </a>
        </div>
      </div>

      <!-- Error Banner -->
      @if (error()) {
        <div
          class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high"
        >
          {{ error() }}
        </div>
      }

      <!-- KPI Cards -->
      <div class="grid gap-4 md:grid-cols-4">
        <div class="panel p-4">
          <p class="m-0 text-xs font-bold text-muted">งานรอรับ</p>
          <p class="m-0 mt-1 text-[26px] font-extrabold text-orange-600">{{ waitingCount() }}</p>
        </div>
        <div class="panel p-4">
          <p class="m-0 text-xs font-bold text-muted">กำลังดำเนินการ</p>
          <p class="m-0 mt-1 text-[26px] font-extrabold text-navy">{{ inProgressCount() }}</p>
        </div>
        <div class="panel p-4">
          <p class="m-0 text-xs font-bold text-muted">ส่งตรวจทานแล้ว</p>
          <p class="m-0 mt-1 text-[26px] font-extrabold text-purple-700">
            {{ readyForReviewCount() }}
          </p>
        </div>
        <div class="panel p-4">
          <p class="m-0 text-xs font-bold text-muted">แสดงผลตามตัวกรอง</p>
          <p class="m-0 mt-1 text-[26px] font-extrabold text-risk-low">
            {{ filteredRows().length }}
          </p>
        </div>
      </div>

      <!-- Task List Panel -->
      <section class="panel mt-4 overflow-hidden">
        <div class="border-b border-line-soft px-[18px] py-4">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 class="m-0 text-[17px] font-extrabold text-ink">รายการงานที่ได้รับมอบหมาย</h2>
              <p class="m-0 mt-1 text-[13px] text-muted">
                ค้นหาโครงการ รหัสโครงการ หรือคำแนะนำจากผู้มอบหมาย
              </p>
            </div>
            <span class="rounded-full bg-navy px-2.5 py-1 text-xs font-bold text-white"
              >{{ filteredRows().length }} รายการ</span
            >
          </div>

          <div class="mt-3 grid gap-2 md:grid-cols-[1fr_220px]">
            <label>
              <span class="sr-only">ค้นหางาน</span>
              <input
                class="gov-input"
                type="search"
                placeholder="ค้นหาโครงการ รหัสโครงการ หรือคำแนะนำ"
                [ngModel]="search()"
                (ngModelChange)="search.set($event)"
              />
            </label>
            <label>
              <span class="sr-only">กรองสถานะ</span>
              <select
                class="gov-select"
                [ngModel]="statusFilter()"
                (ngModelChange)="statusFilter.set($event)"
              >
                <option value="all">ทุกสถานะ</option>
                <option value="waiting_acceptance">รอผู้รับงานตอบรับ</option>
                <option value="accepted">รับงานแล้ว</option>
                <option value="in_progress">กำลังดำเนินการ</option>
                <option value="clarification_needed">ขอคำชี้แจง</option>
                <option value="ready_for_review">ส่งงานให้ตรวจทาน</option>
                <option value="under_review">อยู่ระหว่างสอบทาน</option>
                <option value="revision_requested">ส่งกลับแก้ไข</option>
                <option value="completed">เสร็จสิ้น</option>
              </select>
            </label>
          </div>
        </div>

        @if (loading()) {
          <p class="px-[18px] py-8 text-center text-sm text-muted">กำลังโหลดรายการงาน...</p>
        } @else if (!filteredRows().length) {
          <div class="p-[18px]">
            <app-empty-state
              title="ไม่มีงานที่ได้รับมอบหมาย"
              message="เมื่อผู้ตรวจสอบโครงการมอบหมายงานให้คุณ รายการจะแสดงที่นี่"
            />
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="gov-table min-w-[1000px]">
              <thead>
                <tr>
                  <th scope="col">สถานะ</th>
                  <th scope="col">โครงการ</th>
                  <th scope="col">ผู้มอบหมาย</th>
                  <th scope="col">รายละเอียดงาน</th>
                  <th scope="col"><span class="sr-only">การดำเนินการ</span></th>
                </tr>
              </thead>
              <tbody>
                @for (row of filteredRows(); track row.key) {
                  <tr>
                    <!-- Status Column -->
                    <td class="align-top">
                      <span
                        class="rounded-full px-2.5 py-1 text-xs font-bold"
                        [class]="statusBadgeClass(row)"
                      >
                        {{ statusLabel(row) }}
                      </span>
                      <p class="m-0 mt-2 text-xs text-muted">
                        มอบหมาย {{ formatAssignedAt(row.assignment.created_at) }}
                      </p>
                      @if (row.assignment.priority === 'high') {
                        <span
                          class="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-risk-high"
                          >สำคัญ</span
                        >
                      }
                    </td>

                    <!-- Project Column -->
                    <td class="align-top">
                      <a
                        routerLink="/risk-factors"
                        [queryParams]="{ projectId: row.assignment.project_id }"
                        class="font-extrabold leading-6 text-ink no-underline hover:text-navy hover:underline"
                      >
                        {{ row.projectName }}
                      </a>
                      <div class="mt-2 flex flex-wrap gap-1.5">
                        <span
                          class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700"
                          >{{ row.subdistrictName }}</span
                        >
                        <span
                          class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700"
                          >รหัส {{ row.assignment.project_id }}</span
                        >
                        @if (row.project && row.project.budget_year) {
                          <span
                            class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700"
                            >ปีงบ {{ row.project.budget_year }}</span
                          >
                        }
                      </div>
                    </td>

                    <!-- Assigner Column -->
                    <td class="align-top">
                      <p class="m-0 font-bold text-ink">{{ row.assignedBy }}</p>
                      <p class="m-0 mt-1 text-xs text-muted">ผู้ตรวจสอบโครงการ</p>
                    </td>

                    <!-- Details Column -->
                    <td class="align-top">
                      <div class="max-w-[320px] space-y-1.5 text-xs leading-5 text-muted">
                        @if (row.assignment.due_date) {
                          <p class="m-0">
                            <span class="font-bold text-ink">Due date:</span>
                            {{ row.dueDateText }}
                          </p>
                        }
                        @if (row.assignment.budget_hours) {
                          <p class="m-0">
                            <span class="font-bold text-ink">Budget:</span>
                            {{ row.assignment.budget_hours }} ชม.
                          </p>
                        }
                        <p class="m-0">
                          <span class="font-bold text-ink">กระบวนการงาน:</span>
                          @if (row.assignment.work_process) {
                            {{ row.assignment.work_process }}
                          } @else {
                            <span class="italic text-slate-400">ยังไม่มีข้อมูล</span>
                          }
                        </p>
                        <p class="m-0">
                          <span class="font-bold text-ink">วัตถุประสงค์:</span>
                          @if (row.assignment.work_objective) {
                            {{ row.assignment.work_objective }}
                          } @else {
                            <span class="italic text-slate-400">ยังไม่มีข้อมูล</span>
                          }
                        </p>
                        @if (row.assignment.note) {
                          <p class="m-0">
                            <span class="font-bold text-ink">หมายเหตุ:</span>
                            {{ row.assignment.note }}
                          </p>
                        }
                      </div>
                    </td>

                    <!-- View Column -->
                    <td class="align-top">
                      <a
                        [routerLink]="['/risk-analyst/task', row.assignment.assignment_id]"
                        class="gov-btn-outline inline-flex w-full min-w-[120px] items-center justify-center no-underline"
                      >
                        ดูรายละเอียด
                      </a>
                    </td>
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
export class RiskAnalystMyTasksPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  // ── State Signals ──
  readonly loading = signal(true);
  readonly error = signal('');
  readonly assignments = signal<AuditAssignment[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly search = signal('');
  readonly statusFilter = signal<string>('all');

  // ── Computed Properties ──

  readonly myTaskRows = computed<MyTaskRow[]>(() =>
    this.assignments()
      .map((assignment) => this.toMyTaskRow(assignment))
      .sort(
        (a, b) => this.dateValue(b.assignment.created_at) - this.dateValue(a.assignment.created_at),
      ),
  );

  readonly filteredRows = computed(() => {
    const search = this.search().trim().toLocaleLowerCase('th');
    const status = this.statusFilter();
    return this.myTaskRows().filter(
      (row) =>
        (!search || row.searchText.includes(search)) &&
        (status === 'all' || row.assignment.status === status),
    );
  });

  readonly waitingCount = computed(
    () => this.assignments().filter((a) => a.status === 'waiting_acceptance').length,
  );
  readonly inProgressCount = computed(
    () => this.assignments().filter((a) => a.status === 'in_progress').length,
  );
  readonly readyForReviewCount = computed(
    () => this.assignments().filter((a) => a.status === 'ready_for_review').length,
  );

  // ── Lifecycle ──

  ngOnInit(): void {
    this.loadAllData();
  }

  reloadAll(): void {
    this.error.set('');
    this.loadAllData();
  }

  loadAllData(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      assignments: this.api.assignments().pipe(catchError(() => of<AuditAssignment[]>([]))),
      projects: this.api.projects().pipe(catchError(() => of<Project[]>([]))),
      subdistricts: this.api.subdistricts().pipe(catchError(() => of<Subdistrict[]>([]))),
    }).subscribe({
      next: ({ assignments, projects, subdistricts }) => {
        this.projects.set(projects);
        this.subdistricts.set(subdistricts);
        // backend สโคปรายการให้ตาม role อยู่แล้ว (risk_analyst เห็นงานตัวเอง, role อื่นเห็นตามตำบล)
        this.assignments.set(assignments);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('ไม่สามารถโหลดข้อมูลงานได้ กรุณาลองใหม่อีกครั้ง');
        this.loading.set(false);
      },
    });
  }

  // ── Display Helpers ──

  statusLabel(row: MyTaskRow): string {
    return assignmentWorkflowStatusLabel(row.assignment.status) ?? 'ไม่ระบุสถานะ';
  }

  statusBadgeClass(row: MyTaskRow): string {
    return (
      assignmentWorkflowStatusBadgeClass(row.assignment.status) ?? 'bg-slate-100 text-slate-600'
    );
  }

  formatAssignedAt(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'ยังไม่มีข้อมูล'
      : new Intl.DateTimeFormat('th-TH', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Bangkok',
        }).format(date);
  }

  formatDueDate(value: string): string {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return value;
    return new Intl.DateTimeFormat('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(year, month - 1, day));
  }

  // ── Private Methods ──

  private toMyTaskRow(assignment: AuditAssignment): MyTaskRow {
    const project =
      this.projects().find((p) => String(p.project_id) === assignment.project_id) ?? null;
    const projectName = project?.project_name || assignment.project_name || 'ไม่ระบุชื่อโครงการ';
    const assignedBy =
      assignment.assigned_by_display_name || assignment.assigned_by_username || 'ไม่ระบุผู้มอบหมาย';
    const subdistrictName = project
      ? this.subdistrictLabel(project.subdistrict_id)
      : 'ยังไม่มีข้อมูล';
    const dueDateText = assignment.due_date ? this.formatDueDate(assignment.due_date) : 'ไม่ระบุ';

    const searchText = [
      projectName,
      assignment.project_id,
      subdistrictName,
      assignedBy,
      assignment.note,
      assignment.audit_steps,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('th');

    return {
      key: this.taskKey(assignment),
      assignment,
      project,
      projectName,
      assignedBy,
      subdistrictName,
      dueDateText,
      searchText,
    };
  }

  private subdistrictLabel(subdistrictId: number | null | undefined): string {
    const sub = this.subdistricts().find((s) => s.subdistrict_id === subdistrictId);
    return sub
      ? `${sub.subdistrict_name} ${sub.district_name} ${sub.province_name}`
      : 'ยังไม่มีข้อมูล';
  }

  private taskKey(assignment: AuditAssignment): string {
    return [
      assignment.assignment_id,
      assignment.project_id,
      assignment.assigned_to,
      assignment.status,
      assignment.created_at,
    ].join('|');
  }

  private dateValue(value: string): number {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
}
