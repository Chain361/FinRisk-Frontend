/**
 * RiskAnalystSidebarComponent
 * 
 * Sidebar component สำหรับหน้า Risk Analyst
 * แสดงรายการงานที่มอบหมายให้ Analyst คนปัจจุบัน
 * ใช้ร่วมกับ My Tasks Page และ Task Detail Page
 */

import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { catchError, of } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AuditAssignment, Project, Subdistrict } from '../../core/models/domain.models';

interface SidebarTaskItem {
  key: string;
  assignment: AuditAssignment;
  projectName: string;
  statusLabel: string;
  statusBadgeClass: string;
  isActive: boolean;
}

const TASK_STATUS_LABELS: Record<string, string> = {
  waiting_acceptance: 'รอรับงาน',
  in_progress: 'กำลังดำเนินการ',
  clarification_needed: 'รอตอบกลับคำชี้แจง',
  ready_for_review: 'ส่งตรวจทานแล้ว',
  revision_requested: 'ส่งกลับแก้ไข',
  completed: 'เสร็จสิ้น',
};

const TASK_STATUS_BADGE_CLASS: Record<string, string> = {
  waiting_acceptance: 'bg-orange-100 text-orange-700',
  in_progress: 'bg-blue-100 text-navy',
  clarification_needed: 'bg-red-100 text-risk-high',
  ready_for_review: 'bg-purple-100 text-purple-700',
  revision_requested: 'bg-amber-100 text-amber-700',
  completed: 'bg-green-100 text-risk-low',
};

@Component({
  selector: 'app-risk-analyst-sidebar',
  standalone: true,
  imports: [RouterLink],
  template: `
    <aside class="flex h-full flex-col overflow-hidden border-r border-line-soft bg-zebra">
      <!-- Header -->
      <div class="border-b border-line-soft px-4 py-3.5">
        <h2 class="m-0 text-[15px] font-extrabold text-ink">งานของฉัน</h2>
        <p class="m-0 mt-1 text-[12px] text-muted">{{ taskCount() }} งาน</p>
      </div>

      <!-- Task List -->
      <div class="flex-1 overflow-y-auto">
        @if (loading()) {
          <div class="px-4 py-8 text-center text-sm text-muted">กำลังโหลด...</div>
        } @else if (!tasks().length) {
          <div class="px-4 py-8 text-center text-sm text-muted">ไม่มีงานที่มอบหมาย</div>
        } @else {
          <div class="flex flex-col divide-y divide-line-soft">
            @for (task of tasks(); track task.key) {
              <a
                [routerLink]="['/risk-analyst/task', task.assignment.assignment_id]"
                class="block border-l-4 px-4 py-3 no-underline transition hover:bg-white"
                [class.border-navy]="task.isActive"
                [class.border-transparent]="!task.isActive"
                [class.bg-white]="task.isActive"
              >
                <div class="flex flex-col gap-2">
                  <div class="flex items-start justify-between gap-2">
                    <p class="m-0 line-clamp-2 flex-1 text-[13px] font-bold text-ink">
                      {{ task.projectName }}
                    </p>
                    @if (task.assignment.priority === 'high') {
                      <span class="inline-block shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-risk-high">
                        สำคัญ
                      </span>
                    }
                  </div>
                  <span class="inline-block w-fit rounded-full px-2 py-0.5 text-[11px] font-bold" [class]="task.statusBadgeClass">
                    {{ task.statusLabel }}
                  </span>
                  <p class="m-0 text-[11px] text-muted">
                    รหัส {{ task.assignment.project_id }}
                  </p>
                </div>
              </a>
            }
          </div>
        }
      </div>

      <!-- Footer -->
      <div class="border-t border-line-soft px-4 py-3">
        <button
          type="button"
          class="w-full rounded-[3px] border-[1.5px] border-line bg-white px-3 py-2 text-[13px] font-bold text-slate-700 hover:bg-white"
          (click)="goToMyTasks()"
        >
          ดูทั้งหมด
        </button>
      </div>
    </aside>
  `,
})
export class RiskAnalystSidebarComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly currentAssignmentId = input<number | null>(null);

  // ── State Signals ──
  readonly loading = signal(true);
  readonly assignments = signal<AuditAssignment[]>([]);
  readonly projects = signal<Project[]>([]);

  // ── Computed Properties ──

  readonly tasks = computed<SidebarTaskItem[]>(() => {
    const currentId = this.currentAssignmentId();
    return this.assignments()
      .map((assignment) => this.toSidebarTaskItem(assignment, currentId))
      .sort((a, b) => this.dateValue(b.assignment.created_at) - this.dateValue(a.assignment.created_at));
  });

  readonly taskCount = computed(() => this.tasks().length);

  // ── Lifecycle ──

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    const currentUser = this.auth.user();
    const currentUserId = (currentUser as { id?: unknown; user_id?: unknown; userId?: unknown } | null)?.id
      ?? (currentUser as { id?: unknown; user_id?: unknown; userId?: unknown } | null)?.user_id
      ?? (currentUser as { id?: unknown; user_id?: unknown; userId?: unknown } | null)?.userId;

    this.api.assignments().pipe(
      catchError(() => of<AuditAssignment[]>([]))
    ).subscribe((assignments) => {
      const myAssignments = assignments.filter(
        (a) => String(a.assigned_to) === String(currentUserId)
      );
      this.assignments.set(myAssignments);
      this.loading.set(false);
    });

    this.api.projects().pipe(
      catchError(() => of<Project[]>([]))
    ).subscribe((projects) => {
      this.projects.set(projects);
    });
  }

  goToMyTasks(): void {
    this.router.navigate(['/risk-analyst/my-tasks']);
  }

  // ── Private Methods ──

  private toSidebarTaskItem(assignment: AuditAssignment, currentId: number | null): SidebarTaskItem {
    const project = this.projects().find(
      (p) => String(p.project_id) === assignment.project_id,
    );
    const projectName = project?.project_name || assignment.project_name || 'ไม่ระบุชื่อโครงการ';
    const status = assignment.status || 'waiting_acceptance';
    const statusLabel = TASK_STATUS_LABELS[status] ?? 'ไม่ระบุสถานะ';
    const statusBadgeClass = TASK_STATUS_BADGE_CLASS[status] ?? 'bg-slate-100 text-slate-600';

    return {
      key: [assignment.assignment_id, assignment.project_id, assignment.assigned_to, status].join('|'),
      assignment,
      projectName,
      statusLabel,
      statusBadgeClass,
      isActive: assignment.assignment_id === currentId,
    };
  }

  private dateValue(value: string): number {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
}
