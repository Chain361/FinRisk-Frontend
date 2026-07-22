import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  DEFAULT_ASSIGNMENT_WORKFLOW_STATUS,
  SavedAssignment,
} from './assignment-project-auditor.models';

@Component({
  selector: 'app-assignment-project-auditor-page',
  standalone: true,
  imports: [FormsModule, ConfirmModalComponent, EmptyStateComponent],
  template: `
    <section class="page-shell">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F4</p>
          <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">มอบหมายงาน</h1>
          <p class="m-0 mt-1.5 text-sm text-muted">
            ส่งต่อโครงการที่มีความเสี่ยงให้นักวิเคราะห์ภายในตรวจสอบเชิงลึก
          </p>
        </div>
      </div>

      <div class="rounded-[4px] border-l-4 border-gold bg-gold-bg px-4 py-3 text-sm leading-6 text-[#66511b]">
        เลือกโครงการ เลือกผู้รับผิดชอบ และระบุคำแนะนำก่อนยืนยันการมอบหมาย ระบบจะบันทึกการมอบหมายไว้ในเครื่องในระยะแรก
      </div>

      @if (error()) {
        <div class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high">
          {{ error() }}
        </div>
      }

      <div class="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
        <section class="panel overflow-hidden">
          <div class="border-b border-line-soft px-[18px] py-4">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 class="m-0 text-[17px] font-extrabold text-ink">เลือกโครงการที่ต้องการมอบหมาย</h2>
                <p class="m-0 mt-1 text-[13px] text-muted">แสดงโครงการเรียงตามระดับความเสี่ยง</p>
              </div>
              <span class="rounded-full bg-navy px-2.5 py-1 text-xs font-bold text-white">{{ filteredProjects().length }} โครงการ</span>
            </div>
            <div class="mt-3 grid gap-2 md:grid-cols-[1fr_180px]">
              <label>
                <span class="sr-only">ค้นหาโครงการ</span>
                <input
                  class="gov-input"
                  type="search"
                  placeholder="ค้นหาชื่อโครงการ หรือหน่วยงาน"
                  [ngModel]="projectSearch()"
                  (ngModelChange)="projectSearch.set($event)"
                />
              </label>
              <label>
                <span class="sr-only">กรองระดับความเสี่ยง</span>
                <select class="gov-select" [ngModel]="riskFilter()" (ngModelChange)="riskFilter.set($event)">
                  <option value="all">ทุกระดับความเสี่ยง</option>
                  <option value="high">ความเสี่ยงสูง</option>
                  <option value="medium">ความเสี่ยงปานกลาง</option>
                  <option value="low">ความเสี่ยงต่ำ</option>
                </select>
              </label>
            </div>
          </div>

          @if (loading()) {
            <p class="px-[18px] py-8 text-center text-sm text-muted">กำลังโหลดรายการโครงการ…</p>
          } @else if (!filteredProjects().length) {
            <div class="p-[18px]"><app-empty-state title="ไม่พบโครงการ" message="ลองปรับคำค้นหาหรือตัวกรองระดับความเสี่ยง" /></div>
          } @else {
            <div class="max-h-[580px] overflow-y-auto p-2.5">
              @for (project of filteredProjects(); track project.project_id) {
                <button
                  type="button"
                  class="mb-2 w-full cursor-pointer rounded-[4px] border p-3 text-left transition hover:border-navy hover:bg-[#f8fafc]"
                  [class]="selectedProjectId() === projectId(project) ? 'border-navy bg-[#edf4fb] ring-1 ring-navy' : 'border-line-soft bg-white'"
                  (click)="selectProject(project)"
                >
                  <div class="flex items-start justify-between gap-3">
                    <p class="m-0 text-sm font-extrabold leading-6 text-ink">{{ project.project_name || 'ไม่ระบุชื่อโครงการ' }}</p>
                    <span class="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" [class]="riskBadgeClass(project)">{{ riskLabel(project) }}</span>
                  </div>
                  <div class="mt-2 grid gap-1 text-[13px] text-muted sm:grid-cols-2">
                    <span>
                      ปีงบประมาณ
                      @if (project.budget_year) {
                        {{ project.budget_year }}
                      } @else {
                        <span class="italic text-slate-400">ยังไม่มีข้อมูล</span>
                      }
                    </span>
                    <span>{{ projectSubdistrict(project) }}</span>
                    <span>งบประมาณ {{ money(project.budget_amount) }}</span>
                    <span>
                      คะแนนความเสี่ยง
                      @if (project.risk_score !== null && project.risk_score !== undefined) {
                        {{ project.risk_score }}
                      } @else {
                        <span class="italic text-slate-400">ยังไม่มีข้อมูล</span>
                      }
                    </span>
                  </div>
                </button>
              }
            </div>
          }
        </section>

        <section class="panel p-[18px]">
          <h2 class="m-0 text-[17px] font-extrabold text-ink">รายละเอียดการมอบหมาย</h2>
          <p class="m-0 mt-1 text-[13px] text-muted">ระบุผู้รับผิดชอบและแนวทางการตรวจสอบ</p>

          <div class="mt-4 rounded-[4px] border border-line-soft bg-zebra p-3">
            <p class="m-0 text-xs font-bold text-muted">โครงการที่เลือก</p>
            @if (selectedProject()) {
              <p class="m-0 mt-1 text-sm font-extrabold leading-6 text-ink">{{ selectedProject()!.project_name }}</p>
              <p class="m-0 mt-1 text-[13px] text-muted">{{ projectSubdistrict(selectedProject()!) }} · ปีงบประมาณ {{ selectedProject()!.budget_year }}</p>
            } @else {
              <p class="m-0 mt-1 text-sm text-muted">ยังไม่ได้เลือกโครงการ</p>
            }
          </div>

          <label class="mt-4 block">
            <span class="mb-1.5 block text-sm font-bold text-ink">ค้นหานักวิเคราะห์</span>
            <input
              class="gov-input"
              type="search"
              placeholder="พิมพ์ชื่อหรือความเชี่ยวชาญ"
              [ngModel]="analystSearch()"
              (ngModelChange)="analystSearch.set($event)"
            />
          </label>

          <div class="mt-2 max-h-[210px] space-y-2 overflow-y-auto pr-1">
            @for (analyst of filteredAnalysts(); track analyst.id) {
              <button
                type="button"
                class="w-full cursor-pointer rounded-[4px] border p-3 text-left hover:border-navy"
                [class]="selectedAnalystId() === analyst.id ? 'border-navy bg-[#edf4fb] ring-1 ring-navy' : 'border-line-soft bg-white'"
                (click)="selectedAnalystId.set(analyst.id)"
              >
                <div class="flex items-start justify-between gap-2">
                  <span class="text-sm font-extrabold text-ink">{{ analyst.name }}</span>
                  <span class="shrink-0 text-xs font-bold text-muted">งานคงค้าง {{ analyst.activeCases }}</span>
                </div>
                <p class="m-0 mt-1 text-xs text-muted">{{ analyst.team }}</p>
                <p class="m-0 mt-1.5 text-xs text-navy">{{ analyst.specialties.join(' · ') }}</p>
              </button>
            } @empty {
              <p class="rounded-[4px] bg-zebra px-3 py-4 text-center text-sm text-muted">ไม่พบนักวิเคราะห์ที่ตรงกับคำค้นหา</p>
            }
          </div>

          <div class="mt-4 rounded-[4px] border border-line-soft bg-[#f8fafc] px-3 py-2.5 text-xs leading-5 text-muted">
            ระบบจะบันทึกผู้มอบหมาย ผู้รับมอบหมาย เวลา Due date, Budget hours, Audit steps และคำแนะนำเพื่อรองรับ audit trail
          </div>

          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <label>
              <span class="mb-1.5 block text-sm font-bold text-ink">Due date <span class="text-risk-high">*</span></span>
              <input
                class="gov-input"
                type="date"
                [ngModel]="dueDate()"
                (ngModelChange)="dueDate.set($event)"
              />
            </label>
            <label>
              <span class="mb-1.5 block text-sm font-bold text-ink">Budget hours <span class="text-risk-high">*</span></span>
              <input
                class="gov-input"
                type="number"
                min="0.5"
                step="0.5"
                placeholder="เช่น 16"
                [ngModel]="budgetHours()"
                (ngModelChange)="setBudgetHours($event)"
              />
            </label>
          </div>

          <label class="mt-4 block">
            <span class="mb-1.5 block text-sm font-bold text-ink">Audit steps <span class="text-risk-high">*</span></span>
            <textarea
              class="min-h-[104px] w-full rounded-[3px] border-[1.5px] border-line bg-white p-2.5 text-sm"
              placeholder="ระบุขั้นตอนการตรวจ เช่น ตรวจเอกสารสัญญา, ตรวจพื้นที่, สรุปประเด็นความเสี่ยง"
              [ngModel]="auditSteps()"
              (ngModelChange)="auditSteps.set($event)"
            ></textarea>
          </label>

          <label class="mt-4 block">
            <span class="mb-1.5 block text-sm font-bold text-ink">คำแนะนำหรือรายละเอียดการตรวจสอบ <span class="text-risk-high">*</span></span>
            <textarea
              class="min-h-[112px] w-full rounded-[3px] border-[1.5px] border-line bg-white p-2.5 text-sm"
              placeholder="ระบุประเด็นที่ต้องการให้นักวิเคราะห์ตรวจสอบ…"
              [ngModel]="assignmentNote()"
              (ngModelChange)="assignmentNote.set($event)"
            ></textarea>
          </label>

          @if (formError()) {
            <p class="m-0 mt-3 text-sm font-semibold text-risk-high">{{ formError() }}</p>
          }

          <button type="button" class="gov-btn-primary mt-5 w-full" (click)="requestConfirmation()">ยืนยันการมอบหมายโครงการ</button>
        </section>
      </div>
    </section>

    <app-confirm-modal
      [open]="confirmOpen()"
      title="ยืนยันการมอบหมายงาน"
      [message]="confirmationMessage()"
      confirmLabel="ยืนยันการมอบหมาย"
      cancelLabel="กลับไปแก้ไข"
      (confirmed)="confirmAssignment()"
      (cancelled)="confirmOpen.set(false)"
    />

    @if (successOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center"
        style="background: rgba(11, 49, 100, 0.55);"
        (click)="successOpen.set(false)"
      >
        <div
          class="w-[90%] max-w-[420px] rounded-[4px] border-2 border-navy bg-white p-[26px] text-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="assignment-success-title"
          (click)="$event.stopPropagation()"
        >
          <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-2xl font-extrabold text-risk-low" aria-hidden="true">✓</div>
          <h3 id="assignment-success-title" class="m-0 mt-4 text-xl font-extrabold text-navy">มอบหมายงานเสร็จสิ้น</h3>
          <p class="m-0 mt-2 text-sm leading-6 text-slate-700">ระบบบันทึกการมอบหมายงานเรียบร้อยแล้ว</p>
          <button type="button" class="gov-btn-primary mt-6 min-w-28" (click)="successOpen.set(false)">ตกลง</button>
        </div>
      </div>
    }
  `,
})
export class AssignmentProjectAuditorPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly projects = signal<Project[]>([]);
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly projectSearch = signal('');
  readonly riskFilter = signal('high');
  readonly analystSearch = signal('');
  readonly selectedProjectId = signal<string | null>(null);
  readonly selectedAnalystId = signal<string | null>(null);
  readonly dueDate = signal('');
  readonly budgetHours = signal<number | null>(null);
  readonly auditSteps = signal('');
  readonly assignmentNote = signal('');
  readonly formError = signal('');
  readonly confirmOpen = signal(false);
  readonly successOpen = signal(false);

  readonly filteredProjects = computed(() => {
    const search = this.projectSearch().trim().toLocaleLowerCase('th');
    const risk = this.riskFilter();
    return this.projects()
      .filter((project) => {
        const text = `${project.project_name ?? ''} ${project.dept_name ?? ''} ${project.project_type ?? ''}`.toLocaleLowerCase('th');
        return (!search || text.includes(search)) && (risk === 'all' || normalizeRiskLevel(project.risk_level) === risk);
      })
      .sort((a, b) => this.riskRank(b) - this.riskRank(a) || Number(b.risk_score ?? 0) - Number(a.risk_score ?? 0));
  });

  readonly selectedProject = computed(() =>
    this.projects().find((project) => this.projectId(project) === this.selectedProjectId()) ?? null,
  );

  readonly filteredAnalysts = computed(() => {
    const search = this.analystSearch().trim().toLocaleLowerCase('th');
    return ANALYSTS.filter((analyst) =>
      !search || `${analyst.name} ${analyst.team} ${analyst.specialties.join(' ')}`.toLocaleLowerCase('th').includes(search),
    );
  });

  readonly confirmationMessage = computed(() => {
    const project = this.selectedProject();
    const analyst = ANALYSTS.find((item) => item.id === this.selectedAnalystId());
    const assignmentScope =
      this.dueDate() && this.budgetHours()
        ? ` Due date ${this.dueDate()} · Budget ${this.budgetHours()} ชม.`
        : '';
    return project && analyst
      ? `ต้องการมอบหมาย “${project.project_name}” ให้ ${analyst.name} ใช่หรือไม่?${assignmentScope} ระบบจะบันทึกการมอบหมายและแจ้งผลสำเร็จทันที`
      : 'กรุณาตรวจสอบข้อมูลการมอบหมายอีกครั้ง';
  });

  ngOnInit(): void {
    forkJoin({
      projects: this.api.projects().pipe(catchError(() => of<Project[]>([]))),
      subdistricts: this.api.subdistricts().pipe(catchError(() => of<Subdistrict[]>([]))),
    }).subscribe({
      next: ({ projects, subdistricts }) => {
        this.projects.set(projects);
        this.subdistricts.set(subdistricts);
        this.selectedProjectId.set(this.filteredProjects()[0] ? this.projectId(this.filteredProjects()[0]) : null);
        this.loading.set(false);
        if (!projects.length) this.error.set('ไม่สามารถโหลดรายการโครงการได้ กรุณาตรวจสอบการเชื่อมต่อ FinRisk Backend');
      },
      error: () => {
        this.error.set('ไม่สามารถโหลดข้อมูลการมอบหมายได้ กรุณาลองใหม่อีกครั้ง');
        this.loading.set(false);
      },
    });
  }

  selectProject(project: Project): void {
    this.selectedProjectId.set(this.projectId(project));
    this.formError.set('');
  }

  setBudgetHours(value: string | number | null): void {
    if (value === '' || value === null) {
      this.budgetHours.set(null);
      return;
    }
    this.budgetHours.set(Number(value));
  }

  requestConfirmation(): void {
    this.formError.set('');
    if (!this.selectedProject()) {
      this.formError.set('กรุณาเลือกโครงการที่ต้องการมอบหมาย');
      return;
    }
    if (!this.selectedAnalystId()) {
      this.formError.set('กรุณาเลือกนักวิเคราะห์ผู้รับผิดชอบ');
      return;
    }
    if (!this.dueDate()) {
      this.formError.set('กรุณาระบุ Due date');
      return;
    }
    if (!this.budgetHours() || !Number.isFinite(this.budgetHours()) || Number(this.budgetHours()) <= 0) {
      this.formError.set('กรุณาระบุ Budget hours มากกว่า 0');
      return;
    }
    if (!this.auditSteps().trim()) {
      this.formError.set('กรุณาระบุ Audit steps');
      return;
    }
    if (!this.assignmentNote().trim()) {
      this.formError.set('กรุณาระบุคำแนะนำหรือรายละเอียดการตรวจสอบ');
      return;
    }
    this.confirmOpen.set(true);
  }

  confirmAssignment(): void {
    const project = this.selectedProject();
    const analystId = this.selectedAnalystId();
    if (!project || !analystId) return;

    const entry: SavedAssignment = {
      projectId: this.projectId(project),
      analystId,
      note: this.assignmentNote().trim(),
      dueDate: this.dueDate(),
      budgetHours: Number(this.budgetHours()),
      auditSteps: this.auditSteps().trim(),
      workflowStatus: DEFAULT_ASSIGNMENT_WORKFLOW_STATUS,
      assignedAt: new Date().toISOString(),
      assignedBy:
        this.auth.user()?.display_name ??
        this.auth.user()?.full_name ??
        this.auth.user()?.username ??
        this.auth.token() ??
        undefined,
    };
    const stored = this.readAssignments();
    localStorage.setItem(ASSIGNMENT_STORAGE_KEY, JSON.stringify([entry, ...stored]));
    this.dueDate.set('');
    this.budgetHours.set(null);
    this.auditSteps.set('');
    this.assignmentNote.set('');
    this.confirmOpen.set(false);
    this.successOpen.set(true);
  }

  projectId(project: Project): string {
    return String(project.project_id);
  }

  projectSubdistrict(project: Project): string {
    return subdistrictLabel(this.subdistricts().find((item) => item.subdistrict_id === project.subdistrict_id));
  }

  money(value: number | string | null | undefined): string {
    return value === null || value === undefined ? '-' : formatMoney(value);
  }

  riskLabel(project: Project): string {
    const risk = normalizeRiskLevel(project.risk_level);
    return risk === 'high' ? 'ความเสี่ยงสูง' : risk === 'medium' ? 'ความเสี่ยงปานกลาง' : risk === 'low' ? 'ความเสี่ยงต่ำ' : 'ไม่ระบุระดับ';
  }

  riskBadgeClass(project: Project): string {
    const risk = normalizeRiskLevel(project.risk_level);
    return risk === 'high'
      ? 'bg-red-100 text-risk-high'
      : risk === 'medium'
        ? 'bg-orange-100 text-risk-medium'
        : risk === 'low'
          ? 'bg-green-100 text-risk-low'
          : 'bg-slate-100 text-slate-600';
  }

  private riskRank(project: Project): number {
    const risk = normalizeRiskLevel(project.risk_level);
    return risk === 'high' ? 3 : risk === 'medium' ? 2 : risk === 'low' ? 1 : 0;
  }

  private readAssignments(): SavedAssignment[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(ASSIGNMENT_STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? (parsed as SavedAssignment[]) : [];
    } catch {
      return [];
    }
  }
}
