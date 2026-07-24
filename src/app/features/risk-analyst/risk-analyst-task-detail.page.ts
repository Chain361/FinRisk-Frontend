/**
 * RiskAnalystTaskDetailPageComponent
 * 
 * หน้ารายละเอียดงานสำหรับ Risk Analyst (ผู้รับมอบหมาย)
 * ใช้ในการปฏิบัติงาน (Execution), บันทึกหลักฐาน (Evidence), 
 * ขอคำชี้แจง (Clarification), และส่งมอบงานเพื่อสอบทาน (Submit for Review)
 * 
 * เชื่อมโยงกับฝั่ง Auditor ผ่าน:
 * - AuditAssignment model (shared)
 * - AssignmentWorkflowStatus (shared)
 * - ApiService (shared)
 */

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { AuditAssignment, Project, Subdistrict } from '../../core/models/domain.models';
import { ConfirmModalComponent } from '../../shared/ui/confirm-modal.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import {
  ASSIGNMENT_WORKFLOW_STATUS_LABELS,
  ASSIGNMENT_STORAGE_KEY,
  SavedAssignment,
} from '../assignment-project-auditor/assignment-project-auditor.models';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ClarificationMessage {
  id: string;
  sender: 'analyst' | 'auditor';
  senderName: string;
  message: string;
  createdAt: string;
}

interface WorkingPaperSection {
  id: string;
  title: string;
  content: string;
  updatedAt?: string;
}

type DetailAction = 'accept_task' | 'submit_for_review' | 'send_clarification';

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-risk-analyst-task-detail-page',
  standalone: true,
  imports: [FormsModule, RouterLink, ConfirmModalComponent, EmptyStateComponent],
  template: `
    <section class="page-shell">
      <!-- Header -->
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F4.5</p>
          <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">รายละเอียดงาน</h1>
          <p class="m-0 mt-1.5 text-sm text-muted">ตรวจสอบขอบเขตงาน บันทึกหลักฐาน และส่งมอบผลตรวจทาน</p>
        </div>
        <div class="flex gap-2">
          <button type="button" class="gov-btn-outline" (click)="reloadData()">รีเฟรชข้อมูล</button>
          <a routerLink="/risk-analyst/my-tasks" class="gov-btn-outline">กลับหน้างานของฉัน</a>
        </div>
      </div>

      @if (error()) {
        <div class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high">
          {{ error() }}
        </div>
      }

      @if (loading()) {
        <p class="px-[18px] py-8 text-center text-sm text-muted">กำลังโหลดรายละเอียดงาน...</p>
      } @else if (!assignment()) {
        <div class="p-[18px]">
          <app-empty-state title="ไม่พบรายละเอียดงาน" message="งานนี้อาจถูกลบหรือคุณไม่มีสิทธิ์เข้าถึง" />
        </div>
      } @else {
        <div class="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]">

          <!-- Left Panel: Working Paper -->
          <div class="space-y-5">
            <!-- Assignment Info Banner -->
            <div class="panel p-[18px]">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 class="m-0 text-[17px] font-extrabold text-ink">{{ assignment()!.project_name || 'ไม่ระบุชื่อโครงการ' }}</h2>
                  <p class="m-0 mt-1 text-[13px] text-muted">รหัส {{ assignment()!.project_id }} · มอบหมาย {{ formatAssignedAt(assignment()!.created_at) }}</p>
                </div>
                <span class="rounded-full px-3 py-1.5 text-xs font-bold" [class]="statusBadgeClass()">
                  {{ statusLabel() }}
                </span>
              </div>

              <div class="mt-4 grid gap-3 sm:grid-cols-3">
                <div class="rounded-[4px] border border-line-soft bg-zebra p-3">
                  <p class="m-0 text-[11px] font-extrabold uppercase tracking-wide text-muted">ผู้มอบหมาย</p>
                  <p class="m-0 mt-1 text-sm font-bold text-ink">{{ assignerName() }}</p>
                </div>
                <div class="rounded-[4px] border border-line-soft bg-zebra p-3">
                  <p class="m-0 text-[11px] font-extrabold uppercase tracking-wide text-muted">Due Date</p>
                  <p class="m-0 mt-1 text-sm font-bold" [class]="isOverdue() ? 'text-risk-high' : 'text-ink'">{{ dueDateDisplay() }}</p>
                </div>
                <div class="rounded-[4px] border border-line-soft bg-zebra p-3">
                  <p class="m-0 text-[11px] font-extrabold uppercase tracking-wide text-muted">Budget Hours</p>
                  <p class="m-0 mt-1 text-sm font-bold text-ink">{{ budgetHoursDisplay() }}</p>
                </div>
              </div>

              @if (assignment()!.note) {
                <div class="mt-4 rounded-[4px] border-l-4 border-navy bg-[#edf4fb] px-4 py-3">
                  <p class="m-0 text-[11px] font-extrabold uppercase tracking-wide text-navy">คำแนะนำจากผู้ตรวจสอบโครงการ</p>
                  <p class="m-0 mt-1 text-sm leading-6 text-ink">{{ assignment()!.note }}</p>
                </div>
              }

              @if (assignment()!.audit_steps) {
                <div class="mt-3 rounded-[4px] border border-blue-100 bg-blue-50 px-4 py-3">
                  <p class="m-0 text-[11px] font-extrabold uppercase tracking-wide text-navy">Audit Steps</p>
                  <p class="m-0 mt-1 text-sm leading-6 text-ink">{{ assignment()!.audit_steps }}</p>
                </div>
              }
            </div>

            <!-- Working Paper Section -->
            <div class="panel p-[18px]">
              <h2 class="m-0 text-[17px] font-extrabold text-ink">กระดาษทำการ (Working Paper)</h2>
              <p class="m-0 mt-1 text-[13px] text-muted">บันทึกผลการตรวจสอบและข้อค้นพบของคุณ</p>

              <div class="mt-4 space-y-4">
                @for (section of workingPaperSections(); track section.id) {
                  <div class="rounded-[4px] border border-line-soft p-4">
                    <div class="flex items-center justify-between">
                      <p class="m-0 text-sm font-bold text-ink">{{ section.title }}</p>
                      @if (section.updatedAt) {
                        <span class="text-[11px] text-muted">บันทึก {{ formatLastUpdated(section.updatedAt) }}</span>
                      }
                    </div>
                    <textarea
                      class="mt-3 min-h-[120px] w-full rounded-[3px] border-[1.5px] border-line bg-white p-2.5 text-sm"
                      [placeholder]="'บันทึกผลการตรวจสอบ ' + section.title + '...'"
                      [ngModel]="section.content"
                      (ngModelChange)="updateWorkingPaperSection(section.id, $event)"
                      [readonly]="isLocked()"
                    ></textarea>
                  </div>
                }
              </div>

              @if (isLocked()) {
                <div class="mt-4 rounded-[4px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  เอกสารถูกล็อกชั่วคราว รอผลการตรวจทานจากผู้ตรวจสอบโครงการ
                </div>
              }
            </div>

            <!-- Evidence Upload Section -->
            <div class="panel p-[18px]">
              <h2 class="m-0 text-[17px] font-extrabold text-ink">หลักฐานการตรวจสอบ (Evidence)</h2>
              <p class="m-0 mt-1 text-[13px] text-muted">อัปโหลดไฟล์หลักฐานที่เกี่ยวข้องกับการตรวจสอบ</p>

              <div class="mt-4">
                <label
                  class="flex cursor-pointer flex-col items-center justify-center rounded-[4px] border-2 border-dashed border-line-soft bg-zebra p-6 text-center transition hover:border-navy"
                >
                  <p class="m-0 text-sm font-bold text-ink">คลิกเพื่ออัปโหลดไฟล์</p>
                  <p class="m-0 mt-1 text-xs text-muted">รองรับ PDF, JPG, PNG, XLSX (สูงสุด 10MB)</p>
                  <input
                    type="file"
                    class="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls"
                    (change)="onFileUpload($event)"
                  />
                </label>

                @if (uploadedFiles().length) {
                  <div class="mt-3 space-y-2">
                    @for (file of uploadedFiles(); track file.name) {
                      <div class="flex items-center justify-between rounded-[4px] border border-line-soft bg-white px-3 py-2">
                        <div class="flex items-center gap-2">
                          <span class="text-lg">📄</span>
                          <div>
                            <p class="m-0 text-sm font-bold text-ink">{{ file.name }}</p>
                            <p class="m-0 text-[11px] text-muted">{{ file.size }} KB · อัปโหลด {{ file.uploadedAt }}</p>
                          </div>
                        </div>
                        <button type="button" class="text-xs font-bold text-risk-high hover:underline" (click)="removeFile(file.name)">
                          ลบ
                        </button>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Clarification Thread -->
            <div class="panel p-[18px]">
              <h2 class="m-0 text-[17px] font-extrabold text-ink">บทสนทนาขอคำชี้แจง</h2>
              <p class="m-0 mt-1 text-[13px] text-muted">สอบถามข้อสงสัยกับผู้ตรวจสอบโครงการ</p>

              @if (clarificationMessages().length) {
                <div class="mt-4 max-h-[400px] space-y-3 overflow-y-auto">
                  @for (msg of clarificationMessages(); track msg.id) {
                    <div class="rounded-[4px] border border-line-soft p-3" [class.bg-blue-50]="msg.sender === 'analyst'">
                      <div class="flex items-center gap-2">
                        <span class="rounded-full bg-navy px-2 py-0.5 text-[10px] font-bold text-white">
                          {{ msg.sender === 'analyst' ? 'คุณ' : 'ผู้ตรวจฯ' }}
                        </span>
                        <span class="text-[11px] text-muted">{{ msg.senderName }}</span>
                        <span class="text-[11px] text-muted">· {{ formatLastUpdated(msg.createdAt) }}</span>
                      </div>
                      <p class="m-0 mt-2 text-sm leading-6 text-ink">{{ msg.message }}</p>
                    </div>
                  }
                </div>
              } @else {
                <p class="mt-4 text-center text-sm italic text-slate-400">ยังไม่มีข้อความ ขอคำชี้แจง</p>
              }

              <div class="mt-4 flex gap-2">
                <input
                  class="gov-input flex-1"
                  type="text"
                  placeholder="พิมพ์คำถามหรือข้อสงสัย..."
                  [ngModel]="clarificationInput()"
                  (ngModelChange)="clarificationInput.set($event)"
                  (keydown.enter)="sendClarification()"
                />
                <button type="button" class="gov-btn-primary" [disabled]="!clarificationInput().trim()" (click)="sendClarification()">
                  ส่ง
                </button>
              </div>
            </div>
          </div>

          <!-- Right Panel: Status & Actions -->
          <div class="space-y-4">
            <!-- Status Summary -->
            <div class="panel p-[18px]">
              <h2 class="m-0 text-[15px] font-extrabold text-ink">สถานะงาน</h2>
              <div class="mt-3 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-muted">สถานะปัจจุบัน</span>
                  <span class="rounded-full px-2.5 py-1 text-xs font-bold" [class]="statusBadgeClass()">
                    {{ statusLabel() }}
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm text-muted">Due Date</span>
                  <span class="text-sm font-bold" [class]="isOverdue() ? 'text-risk-high' : 'text-ink'">{{ dueDateDisplay() }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm text-muted">Priority</span>
                  <span class="text-sm font-bold text-ink">{{ priorityDisplay() }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-sm text-muted">มอบหมายเมื่อ</span>
                  <span class="text-sm text-ink">{{ formatAssignedAt(assignment()!.created_at) }}</span>
                </div>
              </div>
            </div>

            <!-- Action Buttons -->
            <div class="panel p-[18px]">
              <h2 class="m-0 text-[15px] font-extrabold text-ink">ดำเนินการ</h2>
              <div class="mt-4 space-y-3">
                @if (assignment()!.status === 'waiting_acceptance') {
                  <button type="button" class="gov-btn-primary w-full" (click)="requestDetailAction('accept_task')">
                    รับงานและเริ่มปฏิบัติงาน
                  </button>
                  <button type="button" class="gov-btn-outline w-full" (click)="scrollToClarification()">
                    ขอคำชี้แจงจากผู้มอบหมาย
                  </button>
                } @else if (assignment()!.status === 'in_progress') {
                  <button type="button" class="gov-btn-primary w-full" (click)="requestDetailAction('submit_for_review')">
                    ส่งมอบงานเพื่อสอบทาน
                  </button>
                } @else if (assignment()!.status === 'clarification_needed') {
                  <button type="button" class="gov-btn-primary w-full" (click)="scrollToClarification()">
                    ตอบกลับคำชี้แจง
                  </button>
                } @else if (assignment()!.status === 'ready_for_review') {
                  <div class="rounded-[4px] border border-purple-100 bg-purple-50 px-4 py-3 text-center text-sm font-bold text-purple-700">
                    รอตรวจทานจากผู้ตรวจสอบโครงการ
                  </div>
                } @else if (assignment()!.status === 'completed') {
                  <div class="rounded-[4px] border border-green-100 bg-green-50 px-4 py-3 text-center text-sm font-bold text-risk-low">
                    งานปิดเรียบร้อย
                  </div>
                }
              </div>
            </div>

            <!-- Timesheet -->
            <div class="panel p-[18px]">
              <h2 class="m-0 text-[15px] font-extrabold text-ink">บันทึกเวลา (Timesheet)</h2>
              <p class="m-0 mt-1 text-[11px] text-muted">Log Actual Hours ที่ใช้ในการปฏิบัติงาน</p>

              <div class="mt-3 flex items-center gap-2">
                <input
                  class="gov-input w-24"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="ชั่วโมง"
                  [ngModel]="actualHours()"
                  (ngModelChange)="actualHours.set($event)"
                />
                <button type="button" class="gov-btn-outline text-xs" (click)="logHours()">
                  บันทึก
                </button>
              </div>

              @if (timeLogEntries().length) {
                <div class="mt-3 space-y-1">
                  @for (entry of timeLogEntries(); track entry.date) {
                    <div class="flex justify-between text-xs">
                      <span class="text-muted">{{ entry.date }}</span>
                      <span class="font-bold text-ink">{{ entry.hours }} ชม.</span>
                    </div>
                  }
                  <div class="mt-2 border-t border-line-soft pt-2 text-xs font-bold text-ink">
                    รวม {{ totalHours() }} ชม.
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </section>

    <!-- Confirm Modal -->
    <app-confirm-modal
      [open]="confirmOpen()"
      [title]="detailConfirmTitle()"
      [message]="detailConfirmMessage()"
      [confirmLabel]="detailConfirmLabel()"
      cancelLabel="ยกเลิก"
      (confirmed)="confirmDetailAction()"
      (cancelled)="cancelDetailAction()"
    />
  `,
})
export class RiskAnalystTaskDetailPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // ── State Signals ──
  readonly loading = signal(true);
  readonly error = signal('');
  readonly assignment = signal<AuditAssignment | null>(null);
  readonly project = signal<Project | null>(null);
  readonly subdistrict = signal<Subdistrict | null>(null);

  // Working Paper
  readonly workingPaperSections = signal<WorkingPaperSection[]>([
    { id: 'scope_review', title: 'ขอบเขตการตรวจสอบ', content: '' },
    { id: 'findings', title: 'ข้อค้นพบ (Findings)', content: '' },
    { id: 'recommendations', title: 'ข้อเสนอแนะ', content: '' },
    { id: 'conclusion', title: 'บทสรุป', content: '' },
  ]);
  readonly isLocked = signal(false);

  // Evidence
  readonly uploadedFiles = signal<Array<{ name: string; size: number; uploadedAt: string }>>([]);

  // Clarification
  readonly clarificationMessages = signal<ClarificationMessage[]>([]);
  readonly clarificationInput = signal('');

  // Timesheet
  readonly actualHours = signal(0);
  readonly timeLogEntries = signal<Array<{ date: string; hours: number }>>([]);

  // Action
  readonly pendingAction = signal<{ action: DetailAction } | null>(null);
  readonly confirmOpen = signal(false);

  // ── Computed ──

  readonly assignerName = computed(() => {
    const a = this.assignment();
    return a?.assigned_by_display_name || a?.assigned_by_username || 'ไม่ระบุ';
  });

  readonly statusLabel = computed(() => {
    const status = this.assignment()?.status;
    return status ? ASSIGNMENT_WORKFLOW_STATUS_LABELS[status] : 'ไม่ระบุสถานะ';
  });

  readonly statusBadgeClass = computed(() => {
    const status = this.assignment()?.status;
    switch (status) {
      case 'waiting_acceptance': return 'bg-orange-100 text-orange-700';
      case 'in_progress': return 'bg-blue-100 text-navy';
      case 'clarification_needed': return 'bg-red-100 text-risk-high';
      case 'ready_for_review': return 'bg-purple-100 text-purple-700';
      case 'completed': return 'bg-green-100 text-risk-low';
      default: return 'bg-slate-100 text-slate-600';
    }
  });

  readonly dueDateDisplay = computed(() => {
    const due = this.assignment()?.due_date;
    if (!due) return 'ไม่ระบุ';
    const [y, m, d] = due.split('-').map(Number);
    if (!y || !m || !d) return due;
    return new Intl.DateTimeFormat('th-TH', {
      day: '2-digit', month: 'short', year: 'numeric',
    }).format(new Date(y, m - 1, d));
  });

  readonly isOverdue = computed(() => {
    const due = this.assignment()?.due_date;
    if (!due) return false;
    return new Date(due) < new Date();
  });

  readonly budgetHoursDisplay = computed(() => {
    const hours = this.assignment()?.budget_hours;
    return hours ? `${hours} ชั่วโมง` : 'ไม่ระบุ';
  });

  readonly priorityDisplay = computed(() => {
    const p = this.assignment()?.priority;
    return p === 'high' ? 'สำคัญ' : p === 'normal' ? 'ปกติ' : p === 'low' ? 'ต่ำ' : 'ไม่ระบุ';
  });

  readonly totalHours = computed(() =>
    this.timeLogEntries().reduce((sum, entry) => sum + entry.hours, 0),
  );

  // Confirm Modal
  readonly detailConfirmTitle = computed(() => {
    switch (this.pendingAction()?.action) {
      case 'accept_task': return 'ยืนยันการรับงาน';
      case 'submit_for_review': return 'ส่งมอบงานเพื่อสอบทาน';
      default: return 'ยืนยัน';
    }
  });

  readonly detailConfirmLabel = computed(() => {
    switch (this.pendingAction()?.action) {
      case 'accept_task': return 'รับงาน';
      case 'submit_for_review': return 'ส่งมอบงาน';
      default: return 'ยืนยัน';
    }
  });

  readonly detailConfirmMessage = computed(() => {
    const action = this.pendingAction()?.action;
    const project = this.assignment()?.project_name || 'โครงการนี้';
    if (action === 'accept_task') {
      return `คุณพร้อมรับงานตรวจสอบ "${project}" และเริ่มปฏิบัติงาน ใช่หรือไม่?`;
    }
    if (action === 'submit_for_review') {
      return `คุณต้องการส่งมอบผลการตรวจสอบ "${project}" ให้ผู้ตรวจสอบโครงการตรวจทานใช่หรือไม่? เอกสารจะถูกล็อกชั่วคราว`;
    }
    return 'กรุณาตรวจสอบการดำเนินการอีกครั้ง';
  });

  // ── Lifecycle ──

  ngOnInit(): void {
    const assignmentId = this.route.snapshot.paramMap.get('id');
    if (assignmentId) {
      this.loadData(Number(assignmentId));
    } else {
      this.error.set('ไม่พบรหัสงาน');
      this.loading.set(false);
    }
  }

  loadData(assignmentId: number): void {
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
        const found = assignments.find((a) => a.assignment_id === assignmentId);
        this.assignment.set(found ?? null);
        if (found) {
          const project = projects.find((p) => String(p.project_id) === found.project_id);
          this.project.set(project ?? null);
          if (project) {
            const sub = subdistricts.find((s) => s.subdistrict_id === project.subdistrict_id);
            this.subdistrict.set(sub ?? null);
          }
          // Lock if ready_for_review or completed
          this.isLocked.set(found.status === 'ready_for_review' || found.status === 'completed');
          // Load time logs and working paper from localStorage
          this.loadTaskData(found.assignment_id);
        } else {
          this.error.set('ไม่พบงานที่ระบุ');
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('โหลดข้อมูลไม่สำเร็จ');
        this.loading.set(false);
      },
    });
  }

  reloadData(): void {
    const id = this.assignment()?.assignment_id;
    if (id) this.loadData(id);
  }

  // ── Working Paper ──

  updateWorkingPaperSection(sectionId: string, content: string): void {
    const sections = this.workingPaperSections().map((s) =>
      s.id === sectionId ? { ...s, content, updatedAt: new Date().toISOString() } : s,
    );
    this.workingPaperSections.set(sections);
    // Auto-save to localStorage
    this.saveWorkingPaper();
  }

  // ── File Upload ──

  onFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const sizeKB = Math.round(file.size / 1024);
    const newFile = {
      name: file.name,
      size: sizeKB,
      uploadedAt: new Intl.DateTimeFormat('th-TH', {
        dateStyle: 'short', timeStyle: 'short',
      }).format(new Date()),
    };
    this.uploadedFiles.set([...this.uploadedFiles(), newFile]);
    input.value = '';
  }

  removeFile(fileName: string): void {
    this.uploadedFiles.set(this.uploadedFiles().filter((f) => f.name !== fileName));
  }

  // ── Clarification ──

  sendClarification(): void {
    const message = this.clarificationInput().trim();
    if (!message) return;

    const newMsg: ClarificationMessage = {
      id: crypto.randomUUID(),
      sender: 'analyst',
      senderName: this.auth.user()?.display_name || this.auth.user()?.username || 'Analyst',
      message,
      createdAt: new Date().toISOString(),
    };

    this.clarificationMessages.set([...this.clarificationMessages(), newMsg]);
    this.clarificationInput.set('');
    this.saveClarification();
  }

  scrollToClarification(): void {
    // Scroll to clarification section
    document.querySelector('.clarification-section')?.scrollIntoView({ behavior: 'smooth' });
  }

  // ── Timesheet ──

  logHours(): void {
    const hours = this.actualHours();
    if (hours <= 0) return;
    const entry = {
      date: new Intl.DateTimeFormat('th-TH', {
        dateStyle: 'short',
      }).format(new Date()),
      hours,
    };
    this.timeLogEntries.set([...this.timeLogEntries(), entry]);
    this.actualHours.set(0);
    this.saveTimesheet();
  }

  // ── Actions ──

  requestDetailAction(action: DetailAction): void {
    this.pendingAction.set({ action });
    this.confirmOpen.set(true);
  }

  cancelDetailAction(): void {
    this.pendingAction.set(null);
    this.confirmOpen.set(false);
  }

  confirmDetailAction(): void {
    const action = this.pendingAction()?.action;
    if (!action) return;

    const assignmentId = this.assignment()?.assignment_id;
    if (!assignmentId) return;

    let newStatus: AuditAssignment['status'];
    if (action === 'accept_task') newStatus = 'in_progress';
    else if (action === 'submit_for_review') newStatus = 'ready_for_review';
    else return;

    // Update status (prototype: localStorage; production: API)
    const allAssignments = this.readAllAssignments();
    const updated = allAssignments.map((a) =>
      a.assignment_id === assignmentId ? { ...a, status: newStatus, updated_at: new Date().toISOString() } : a,
    );
    localStorage.setItem(ASSIGNMENT_STORAGE_KEY, JSON.stringify(updated));

    // Update local signal
    if (this.assignment()) {
      this.assignment.update((a) => a ? { ...a, status: newStatus, updated_at: new Date().toISOString() } : null);
    }

    this.isLocked.set(newStatus === 'ready_for_review');
    this.cancelDetailAction();
  }

  // ── Helpers ──

  formatAssignedAt(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'ยังไม่มีข้อมูล'
      : new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Bangkok' }).format(date);
  }

  formatLastUpdated(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? ''
      : new Intl.DateTimeFormat('th-TH', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  // ── LocalStorage Persistence ──

  private loadTaskData(assignmentId: number): void {
    const key = `finrisk_task_${assignmentId}`;
    try {
      const data = JSON.parse(localStorage.getItem(key) ?? '{}');
      if (data.workingPaper) this.workingPaperSections.set(data.workingPaper);
      if (data.files) this.uploadedFiles.set(data.files);
      if (data.clarifications) this.clarificationMessages.set(data.clarifications);
      if (data.timesheet) this.timeLogEntries.set(data.timesheet);
    } catch {
      // No stored data
    }
  }

  private saveWorkingPaper(): void {
    this.saveTaskData({ workingPaper: this.workingPaperSections() });
  }

  private saveClarification(): void {
    this.saveTaskData({ clarifications: this.clarificationMessages() });
  }

  private saveTimesheet(): void {
    this.saveTaskData({ timesheet: this.timeLogEntries() });
  }

  private saveTaskData(partial: Record<string, unknown>): void {
    const assignmentId = this.assignment()?.assignment_id;
    if (!assignmentId) return;
    const key = `finrisk_task_${assignmentId}`;
    try {
      const existing = JSON.parse(localStorage.getItem(key) ?? '{}');
      localStorage.setItem(key, JSON.stringify({ ...existing, ...partial }));
    } catch {
      localStorage.setItem(key, JSON.stringify(partial));
    }
  }

  private readAllAssignments(): AuditAssignment[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(ASSIGNMENT_STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? (parsed as AuditAssignment[]) : [];
    } catch {
      return [];
    }
  }

  // Placeholder for signal assignment
  private readonly projects = signal<Project[]>([]);
  private readonly subdistricts = signal<Subdistrict[]>([]);
}
