/**
 * RiskAnalystMyTasksPageComponent
 * 
 * หน้า Dashboard สำหรับ Risk Analyst (นักตรวจสอบภายใน)
 * แสดงรายการงานที่ถูกมอบหมายจาก Project Auditor
 * รองรับ User Journey: รับแจ้งเตือน → ประเมิน & ตอบรับ → ปฏิบัติงาน → ส่งมอบงานเพื่อสอบทาน
 * 
 * เชื่อมโยงกับ AssignmentWorkflowStatus และ AuditAssignment จากฝั่ง Auditor
 */

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AuditAssignment, Project, Subdistrict } from '../../core/models/domain.models';
import { ConfirmModalComponent } from '../../shared/ui/confirm-modal.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { projectWorkflowStatusBadgeClass, projectWorkflowStatusLabel } from '../assignment-project-auditor/assignment-project-auditor.models';

// ─────────────────────────────────────────────────────────────────────────────
// Types & Constants — เชื่อมโยงกับ AssignmentWorkflowStatus ของฝั่ง Auditor
// ─────────────────────────────────────────────────────────────────────────────

/** Action ที่ Analyst สามารถทำได้อย่างชัดเจน (mirroring ReviewAction ของ Auditor) */
type AnalystAction = 'accept_task' | 'request_clarification' | 'submit_for_review';

/** สถานะที่ Analyst มองเห็นงานของตน (subset ของ AssignmentWorkflowStatus) */
type MyTaskStatus =
  | 'waiting_acceptance'
  | 'in_progress'
  | 'clarification_needed'
  | 'ready_for_review'
  | 'revision_requested'
  | 'completed';

const MY_TASK_STATUS_LABELS: Record<MyTaskStatus, string> = {
  waiting_acceptance: 'รอรับงาน',
  in_progress: 'กำลังดำเนินการ',
  clarification_needed: 'รอตอบกลับคำชี้แจง',
  ready_for_review: 'ส่งตรวจทานแล้ว',
  revision_requested: 'ส่งกลับแก้ไข',
  completed: 'เสร็จสิ้น',
};

const MY_TASK_STATUS_BADGE_CLASS: Record<MyTaskStatus, string> = {
  waiting_acceptance: 'bg-orange-100 text-orange-700',
  in_progress: 'bg-blue-100 text-navy',
  clarification_needed: 'bg-red-100 text-risk-high',
  ready_for_review: 'bg-purple-100 text-purple-700',
  revision_requested: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-risk-low',
};

const MY_TASK_STORAGE_KEY = 'finrisk_risk_analyst_tasks';

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

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-risk-analyst-my-tasks-page',
  standalone: true,
  imports: [FormsModule, RouterLink, ConfirmModalComponent, EmptyStateComponent],
  template: `
    <section class="page-shell">
      <!-- Header -->
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F4.4</p>
          <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">งานของฉัน (My Tasks)</h1>
          <p class="m-0 mt-1.5 text-sm text-muted">
            รายการโครงการที่ถูกมอบหมายให้คุณตรวจสอบ ตรวจสอบสถานะและดำเนินการตามขั้นตอน
          </p>
        </div>
        <button type="button" class="gov-btn-outline" (click)="reloadAll()">รีเฟรชรายการ</button>
      </div>

      <!-- Error Banner -->
      @if (error()) {
        <div class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high">
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
          <p class="m-0 mt-1 text-[26px] font-extrabold text-purple-700">{{ readyForReviewCount() }}</p>
        </div>
        <div class="panel p-4">
          <p class="m-0 text-xs font-bold text-muted">แสดงผลตามตัวกรอง</p>
          <p class="m-0 mt-1 text-[26px] font-extrabold text-risk-low">{{ filteredRows().length }}</p>
        </div>
      </div>

      <!-- Task List Panel -->
      <section class="panel overflow-hidden mt-4">
        <div class="border-b border-line-soft px-[18px] py-4">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 class="m-0 text-[17px] font-extrabold text-ink">รายการงานที่ได้รับมอบหมาย</h2>
              <p class="m-0 mt-1 text-[13px] text-muted">ค้นหาโครงการ รหัสโครงการ หรือคำแนะนำจากผู้มอบหมาย</p>
            </div>
            <span class="rounded-full bg-navy px-2.5 py-1 text-xs font-bold text-white">{{ filteredRows().length }} รายการ</span>
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
              <select class="gov-select" [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event)">
                <option value="all">ทุกสถานะ</option>
                <option value="waiting_acceptance">รอรับงาน</option>
                <option value="in_progress">กำลังดำเนินการ</option>
                <option value="clarification_needed">รอตอบกลับคำชี้แจง</option>
                <option value="ready_for_review">ส่งตรวจทานแล้ว</option>
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
            <table class="gov-table min-w-[1100px]">
              <thead>
                <tr>
                  <th>สถานะ</th>
                  <th>โครงการ</th>
                  <th>ผู้มอบหมาย</th>
                  <th>รายละเอียดงาน</th>
                  <th>การดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                @for (row of filteredRows(); track row.key) {
                  <tr>
                    <!-- Status Column -->
                    <td class="align-top">
                      <span class="rounded-full px-2.5 py-1 text-xs font-bold" [class]="statusBadgeClass(row)">
                        {{ statusLabel(row) }}
                      </span>
                      <p class="m-0 mt-2 text-xs text-muted">มอบหมาย {{ formatAssignedAt(row.assignment.created_at) }}</p>
                      @if (row.assignment.priority === 'high') {
                        <span class="mt-1 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-risk-high">สำคัญ</span>
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
                        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{{ row.subdistrictName }}</span>
                        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">รหัส {{ row.assignment.project_id }}</span>
                        @if (row.project && row.project.budget_year) {
                          <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">ปีงบ {{ row.project.budget_year }}</span>
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
                          <p class="m-0"><span class="font-bold text-ink">Due date:</span> {{ row.dueDateText }}</p>
                        }
                        @if (row.assignment.budget_hours) {
                          <p class="m-0"><span class="font-bold text-ink">Budget:</span> {{ row.assignment.budget_hours }} ชม.</p>
                        }
                        @if (row.assignment.audit_steps) {
                          <p class="m-0"><span class="font-bold text-ink">Audit steps:</span> {{ row.assignment.audit_steps }}</p>
                        } @else {
                          <p class="m-0 italic text-slate-400">ยังไม่มี Audit steps</p>
                        }
                        @if (row.assignment.note) {
                          <p class="m-0"><span class="font-bold text-ink">หมายเหตุ:</span> {{ row.assignment.note }}</p>
                        }
                      </div>
                    </td>

                    <!-- Actions Column -->
                    <td class="align-top">
                      <div class="flex min-w-[200px] flex-col gap-2">
                        @if (row.assignment.status === 'waiting_acceptance') {
                          <button type="button" class="gov-btn-primary w-full" (click)="requestAnalystAction(row, 'accept_task')">
                            รับงาน
                          </button>
                          <button type="button" class="gov-btn-outline w-full" (click)="requestAnalystAction(row, 'request_clarification')">
                            ขอคำชี้แจง
                          </button>
                        } @else if (row.assignment.status === 'in_progress') {
                          <button type="button" class="gov-btn-outline w-full" (click)="goToWorkingPaper(row.assignment.assignment_id)">
                            เข้าปฏิบัติงาน
                          </button>
                          <button type="button" class="gov-btn-primary w-full" (click)="requestAnalystAction(row, 'submit_for_review')">
                            ส่งตรวจทาน
                          </button>
                        } @else if (row.assignment.status === 'clarification_needed') {
                          <button type="button" class="gov-btn-primary w-full" (click)="goToWorkingPaper(row.assignment.assignment_id)">
                            ตอบคำชี้แจง
                          </button>
                        } @else if (row.assignment.status === 'revision_requested') {
                          <button type="button" class="gov-btn-outline w-full" (click)="goToWorkingPaper(row.assignment.assignment_id)">
                            แก้ไขงาน
                          </button>
                        } @else if (row.assignment.status === 'ready_for_review') {
                          <span class="rounded-[4px] border border-purple-100 bg-purple-50 px-3 py-2 text-xs font-bold text-purple-700">
                            รอตรวจทานจาก Auditor
                          </span>
                        } @else if (row.assignment.status === 'completed') {
                          <span class="rounded-[4px] border border-green-100 bg-green-50 px-3 py-2 text-xs font-bold text-risk-low">
                            ปิดงานแล้ว
                          </span>
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
    </section>

    <!-- Confirm Modal -->
    <app-confirm-modal
      [open]="confirmOpen()"
      [title]="confirmTitle()"
      [message]="confirmMessage()"
      [confirmLabel]="confirmLabel()"
      cancelLabel="ยกเลิก"
      (confirmed)="confirmAnalystAction()"
      (cancelled)="cancelAnalystAction()"
    />
  `,
})
export class RiskAnalystMyTasksPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  // ── State Signals ──
  readonly loading = signal(true);
  readonly error = signal('');
  readonly assignments = signal<AuditAssignment[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly search = signal('');
  readonly statusFilter = signal<string>('all');
  readonly pendingAction = signal<{ row: MyTaskRow; action: AnalystAction } | null>(null);
  readonly confirmOpen = signal(false);

  // ── Computed Properties ──

  readonly myTaskRows = computed<MyTaskRow[]>(() =>
    this.assignments()
      .filter((a) => this.isMyTaskStatus(a.status))
      .map((assignment) => this.toMyTaskRow(assignment))
      .sort((a, b) => this.dateValue(b.assignment.created_at) - this.dateValue(a.assignment.created_at)),
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

  // ── Confirm Modal Computed ──

  readonly confirmTitle = computed(() => {
    switch (this.pendingAction()?.action) {
      case 'accept_task': return 'ยืนยันการรับงาน';
      case 'request_clarification': return 'แจ้งขอคำชี้แจง';
      case 'submit_for_review': return 'ส่งมอบงานเพื่อสอบทาน';
      default: return 'ยืนยันการดำเนินการ';
    }
  });

  readonly confirmLabel = computed(() => {
    switch (this.pendingAction()?.action) {
      case 'accept_task': return 'รับงาน';
      case 'request_clarification': return 'ส่งคำขอ';
      case 'submit_for_review': return 'ส่งมอบงาน';
      default: return 'ยืนยัน';
    }
  });

  readonly confirmMessage = computed(() => {
    const pending = this.pendingAction();
    if (!pending) return 'กรุณาตรวจสอบรายการอีกครั้ง';
    const project = pending.row.projectName;
    switch (pending.action) {
      case 'accept_task':
        return `คุณต้องการรับงานตรวจสอบโครงการ "${project}" ใช่หรือไม่? ระบบจะเปลี่ยนสถานะเป็น "กำลังดำเนินการ" และเริ่มนับเวลา`;
      case 'request_clarification':
        return `คุณต้องการสอบถามรายละเอียดเพิ่มเติมของโครงการ "${project}" ใช่หรือไม่? ผู้ตรวจสอบโครงการจะได้รับแจ้งเตือนและตอบกลับคุณ`;
      case 'submit_for_review':
        return `คุณต้องการส่งมอบผลการตรวจสอบโครงการ "${project}" ให้ผู้ตรวจสอบโครงการตรวจทาน ใช่หรือไม่? เอกสารจะถูกล็อกชั่วคราว`;
    }
  });

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
        // กรองเฉพาะงานที่มอบหมายให้ Risk Analyst คนปัจจุบัน
        const currentUser = this.auth.user();
        const currentUserId = (currentUser as { id?: unknown; user_id?: unknown; userId?: unknown } | null)?.id
          ?? (currentUser as { id?: unknown; user_id?: unknown; userId?: unknown } | null)?.user_id
          ?? (currentUser as { id?: unknown; user_id?: unknown; userId?: unknown } | null)?.userId;
        const myAssignments = assignments.filter(
          (a) => String(a.assigned_to) === String(currentUserId),
        );
        this.assignments.set(myAssignments);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('ไม่สามารถโหลดข้อมูลงานได้ กรุณาลองใหม่อีกครั้ง');
        this.loading.set(false);
      },
    });
  }

  // ── Action Handlers ──

  requestAnalystAction(row: MyTaskRow, action: AnalystAction): void {
    this.pendingAction.set({ row, action });
    this.confirmOpen.set(true);
  }

  cancelAnalystAction(): void {
    this.pendingAction.set(null);
    this.confirmOpen.set(false);
  }

  confirmAnalystAction(): void {
    const pending = this.pendingAction();
    if (!pending) return;

    const nextStatus = this.nextStatusForAction(pending.action);

    // ในระยะแรก ใช้ localStorage storage pattern เหมือนฝั่ง Auditor review page
    // เมื่อมี API ฝั่ง backend รองรับ สามารถเปลี่ยนเป็น this.api.updateAssignmentStatus() ได้
    const updated = this.assignments().map((assignment) => {
      if (assignment.assignment_id !== pending.row.assignment.assignment_id) {
        return assignment;
      }
      return {
        ...assignment,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };
    });

    this.writeAssignments(updated);
    this.assignments.set(updated);
    this.cancelAnalystAction();

    // ถ้ามี backend API แล้ว ใช้ดังนี้:
    // this.api.updateAssignmentStatus(pending.row.assignment.assignment_id, {
    //   status: nextStatus,
    //   updated_by: this.auth.user()?.user_id,
    // }).subscribe({
    //   next: () => { this.cancelAnalystAction(); this.loadAllData(); },
    //   error: () => { this.cancelAnalystAction(); this.error.set('อัปเดตสถานะไม่สำเร็จ'); },
    // });
  }

  goToWorkingPaper(assignmentId: number): void {
    this.router.navigate(['/risk-analyst/task', assignmentId]);
  }

  // ── Display Helpers ──

  statusLabel(row: MyTaskRow): string {
    const status = row.assignment.status as MyTaskStatus;
    return MY_TASK_STATUS_LABELS[status] ?? 'ไม่ระบุสถานะ';
  }

  statusBadgeClass(row: MyTaskRow): string {
    const status = row.assignment.status as MyTaskStatus;
    return MY_TASK_STATUS_BADGE_CLASS[status] ?? 'bg-slate-100 text-slate-600';
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

  private isMyTaskStatus(status: string | null | undefined): boolean {
    if (!status) return false;
    const validStatuses: MyTaskStatus[] = [
      'waiting_acceptance',
      'in_progress',
      'clarification_needed',
      'ready_for_review',
      'revision_requested',
      'completed',
    ];
    return (validStatuses as string[]).includes(status);
  }

  private nextStatusForAction(action: AnalystAction): AuditAssignment['status'] {
    switch (action) {
      case 'accept_task':
        return 'in_progress';
      case 'request_clarification':
        return 'clarification_needed';
      case 'submit_for_review':
        return 'ready_for_review';
    }
  }

  private toMyTaskRow(assignment: AuditAssignment): MyTaskRow {
    const project = this.projects().find(
      (p) => String(p.project_id) === assignment.project_id,
    ) ?? null;
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
    return sub ? `${sub.subdistrict_name} ${sub.district_name} ${sub.province_name}` : 'ยังไม่มีข้อมูล';
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

  private readAssignments(): AuditAssignment[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(MY_TASK_STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? (parsed as AuditAssignment[]) : [];
    } catch {
      return [];
    }
  }

  private writeAssignments(assignments: AuditAssignment[]): void {
    if (!assignments.length) {
      localStorage.removeItem(MY_TASK_STORAGE_KEY);
      return;
    }
    localStorage.setItem(MY_TASK_STORAGE_KEY, JSON.stringify(assignments));
  }
}
