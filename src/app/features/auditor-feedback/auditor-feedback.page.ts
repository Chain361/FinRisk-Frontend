import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AuditAssignment, AuditorFeedback, ProjectDetail } from '../../core/models/domain.models';
import { ProjectFeedbackPanelComponent } from '../risk-factors/project-feedback-panel.component';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { formatMoney } from '../../shared/utils/risk-utils';
import {
  concernColor,
  concernLabel,
  feedbackStatusChipClass,
  feedbackStatusLabel,
  formatFeedbackDate,
} from '../../shared/utils/feedback-utils';

/**
 * F6 — กล่องรวมความเห็นผู้ตรวจสอบทุกโครงการในขอบเขตของผู้ใช้
 * (backend scope ตามตำบลให้แล้ว — role แบบ scoped เห็นเฉพาะตำบลตัวเอง)
 * เป็นหน้าแยกอิสระ — คลิกแถวแล้วเปิดรายละเอียดโครงการ (แบบย่อ) + feedback panel อยู่ในหน้านี้เลย
 * ไม่พาไปหน้า F3
 */
@Component({
  selector: 'app-auditor-feedback-page',
  standalone: true,
  imports: [EmptyStateComponent, ProjectFeedbackPanelComponent],
  template: `
    <section class="page-shell">
      <div>
        <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F6</p>
        <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">ความเห็นผู้ตรวจสอบ</h1>
        <p class="m-0 mt-1.5 text-sm text-muted">
          รวมความเห็นทุกโครงการในขอบเขตของท่าน — ติดตามสถานะ ฉบับร่าง / ส่งแล้ว / อนุมัติแล้ว
        </p>
      </div>

      @if (error()) {
        <p
          class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high"
        >
          {{ error() }}
        </p>
      }

      @if (!selectedProjectId()) {
        <section class="panel overflow-hidden">
          <div class="border-b-[1.5px] border-line px-4 py-3.5">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div class="flex flex-wrap items-end gap-4">
                <label class="block">
                  <p class="text-[12.5px] font-bold text-muted">สถานะ</p>
                  <select
                    class="gov-select mt-1 w-40!"
                    [value]="statusFilter()"
                    (change)="statusFilter.set($any($event.target).value)"
                  >
                    <option value="">ทุกสถานะ</option>
                    <option value="draft">ฉบับร่าง</option>
                    <option value="submitted">ส่งแล้ว</option>
                    <option value="resolved">อนุมัติแล้ว</option>
                  </select>
                </label>
                <label class="block">
                  <p class="text-[12.5px] font-bold text-muted">ระดับความกังวล</p>
                  <select
                    class="gov-select mt-1 w-40!"
                    [value]="concernFilter()"
                    (change)="concernFilter.set($any($event.target).value)"
                  >
                    <option value="">ทุกระดับ</option>
                    <option value="high">สูง</option>
                    <option value="medium">ปานกลาง</option>
                    <option value="low">ต่ำ</option>
                  </select>
                </label>
              </div>
              <label class="w-76">
                <input
                  type="search"
                  class="gov-input mt-1 w-24"
                  placeholder="ค้นหา Project ID ผู้ให้ความเห็น หรือข้อความ"
                  [value]="searchQuery()"
                  (input)="searchQuery.set($any($event.target).value)"
                />
              </label>
            </div>
          </div>

          @if (loading()) {
            <div class="p-6 text-sm text-muted">กำลังโหลดความเห็น...</div>
          } @else if (!filteredItems().length) {
            <div class="px-4 py-12">
              <app-empty-state
                title="ไม่พบความเห็น"
                message="ลองเปลี่ยนตัวกรองสถานะ ระดับความกังวล หรือคำค้น"
              />
            </div>
          } @else {
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-slate-200 text-sm">
                <thead class="bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th scope="col" class="px-4 py-3">โครงการ / ความเห็น</th>
                    <th scope="col" class="px-4 py-3">ผู้ให้ความเห็น</th>
                    <th scope="col" class="px-4 py-3">ความกังวล</th>
                    <th scope="col" class="px-4 py-3">คะแนน</th>
                    <th scope="col" class="px-4 py-3">สถานะ</th>
                    <th scope="col" class="px-4 py-3">อัปเดตล่าสุด</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 bg-white">
                  @for (item of filteredItems(); track item.feedback_id) {
                    <tr
                      class="cursor-pointer hover:bg-slate-50"
                      (click)="openProject(item.project_id)"
                    >
                      <td class="max-w-md px-4 py-3">
                        <p class="m-0 text-xs font-bold text-muted">ID {{ item.project_id }}</p>
                        <p class="m-0 mt-0.5 line-clamp-2 text-[13px] text-slate-800">
                          <span class="font-bold text-slate-900">ความคิดเห็น:</span>
                          {{ item.feedback_text }}
                        </p>
                      </td>
                      <td class="whitespace-nowrap px-4 py-3">
                        {{ item.auditor_name || item.auditor_username }}
                      </td>
                      <td class="px-4 py-3">
                        @if (item.concern_level) {
                          <span
                            class="inline-flex items-center rounded-[3px] px-2 py-1 text-[11.5px] font-extrabold text-white"
                            [style.background]="concernColor(item.concern_level)"
                            >{{ concernLabel(item.concern_level) }}</span
                          >
                        } @else {
                          <span class="text-muted">-</span>
                        }
                      </td>
                      <td class="px-4 py-3 text-left font-semibold">
                        {{ item.risk_score ?? '-' }}
                      </td>
                      <td class="px-4 py-3">
                        <span
                          class="inline-flex items-center rounded-[3px] px-2 py-1 text-[11.5px] font-extrabold"
                          [class]="statusChipClass(item.status)"
                          >{{ statusLabel(item.status) }}</span
                        >
                      </td>
                      <td class="whitespace-nowrap px-4 py-3 text-[12.5px] text-muted">
                        {{ date(item.updated_at) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      } @else {
        <div class="grid gap-4">
          <button
            type="button"
            class="inline-flex h-10 w-fit items-center justify-center rounded-[3px] border-[1.5px] border-line bg-white px-3 text-[13.5px] font-bold text-slate-700 hover:bg-zebra"
            (click)="backToList()"
          >
            ← กลับไปรายการ
          </button>

          @if (loadingDetail()) {
            <div class="panel p-6 text-sm text-muted">กำลังโหลดรายละเอียดโครงการ...</div>
          } @else if (projectDetail()) {
            <article class="panel p-[18px]">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p class="m-0 text-[12.5px] font-bold text-muted">
                    Project ID {{ projectDetail()?.project_id }}
                  </p>
                  <h2 class="m-0 mt-1 text-[19px] font-extrabold text-ink">
                    {{ projectDetail()?.project_name }}
                  </h2>
                  <p class="m-0 mt-1.5 text-[13px] text-muted">
                    ปี {{ projectDetail()?.budget_year }} ·
                    {{
                      projectDetail()?.project_type || projectDetail()?.purchase_method_group || '-'
                    }}
                  </p>
                </div>
                <span class="text-[11px] font-bold text-muted"
                  >คะแนนความเสี่ยง {{ projectDetail()?.risk_score ?? '-' }}/100</span
                >
              </div>

              @if (projectDetail()?.source_file || projectDetail()?.data_quality_note) {
                <div
                  class="mt-3 rounded-[3px] border border-line-soft bg-[#fbfcfd] px-3 py-2 text-[11.5px] text-muted"
                >
                  @if (projectDetail()?.source_file) {
                    <p class="m-0">
                      <span class="font-bold text-slate-600">ที่มาข้อมูล:</span>
                      {{ projectDetail()?.source_file }}
                    </p>
                  }
                  @if (projectDetail()?.data_quality_note) {
                    <p class="m-0 mt-0.5">
                      <span class="font-bold text-[#8a2a1f]">ข้อจำกัดข้อมูล:</span>
                      {{ projectDetail()?.data_quality_note }}
                    </p>
                  }
                </div>
              }

              <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                  <p class="m-0 text-[11.5px] font-bold text-muted">หน่วยงาน</p>
                  <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">{{ deptName() }}</p>
                </div>
                <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                  <p class="m-0 text-[11.5px] font-bold text-muted">งบประมาณ</p>
                  <p class="m-0 mt-1 text-[15px] font-extrabold text-ink">
                    {{ money(projectDetail()?.budget_amount) }}
                  </p>
                </div>
                <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                  <p class="m-0 text-[11.5px] font-bold text-muted">ประเภทจัดซื้อจัดจ้าง</p>
                  <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">{{ purchaseMethod() }}</p>
                </div>
                <div class="rounded-[3px] border border-line-soft bg-zebra p-[11px]">
                  <p class="m-0 text-[11.5px] font-bold text-muted">สถานะโครงการ</p>
                  <p class="m-0 mt-1 text-[13.5px] font-bold text-ink">{{ projectStatus() }}</p>
                </div>
              </div>

              <div class="mt-4 border-t border-line-soft pt-4">
                <p class="m-0 text-[11px] font-extrabold uppercase tracking-wide text-navy">
                  ขอบเขตงานตรวจสอบ
                </p>
                <div class="mt-1 grid gap-3 text-sm leading-6 sm:grid-cols-2">
                  <div>
                    <p class="m-0 text-xs font-bold text-navy">กระบวนการงาน</p>
                    @if (selectedAssignment()?.work_process) {
                      <p class="m-0 text-ink">{{ selectedAssignment()!.work_process }}</p>
                    } @else {
                      <p class="m-0 italic text-muted">ยังไม่มีข้อมูล</p>
                    }
                  </div>
                  <div
                    class="border-t border-line-soft pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0"
                  >
                    <p class="m-0 text-xs font-bold text-navy">วัตถุประสงค์</p>
                    @if (selectedAssignment()?.work_objective) {
                      <p class="m-0 text-ink">{{ selectedAssignment()!.work_objective }}</p>
                    } @else {
                      <p class="m-0 italic text-muted">ยังไม่มีข้อมูล</p>
                    }
                  </div>
                </div>
                <div class="mt-3 border-t border-line-soft pt-3">
                  <p class="m-0 text-xs font-bold text-navy">คำแนะนำ</p>
                  @if (selectedAssignment()?.note) {
                    <p class="m-0 mt-0.5 whitespace-pre-line text-sm leading-6 text-ink">
                      {{ selectedAssignment()!.note }}
                    </p>
                  } @else {
                    <p class="m-0 mt-0.5 text-sm italic text-muted">ยังไม่มีคำแนะนำ</p>
                  }
                </div>
              </div>
            </article>

            <app-project-feedback-panel [projectId]="selectedProjectId()!" />
          }
        </div>
      }
    </section>
  `,
})
export class AuditorFeedbackPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly items = signal<AuditorFeedback[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly statusFilter = signal('');
  readonly concernFilter = signal('');
  readonly searchQuery = signal('');

  readonly selectedProjectId = signal<string | null>(null);
  readonly projectDetail = signal<ProjectDetail | null>(null);
  readonly selectedAssignment = signal<AuditAssignment | null>(null);
  readonly loadingDetail = signal(false);

  readonly filteredItems = computed(() => {
    const status = this.statusFilter();
    const concern = this.concernFilter();
    const query = this.searchQuery().trim().toLowerCase();

    return this.items().filter((item) => {
      const matchesStatus = !status || item.status === status;
      const matchesConcern = !concern || item.concern_level === concern;
      const matchesQuery =
        !query ||
        item.project_id.toLowerCase().includes(query) ||
        (item.auditor_name ?? '').toLowerCase().includes(query) ||
        item.auditor_username.toLowerCase().includes(query) ||
        item.feedback_text.toLowerCase().includes(query);
      return matchesStatus && matchesConcern && matchesQuery;
    });
  });

  readonly concernColor = concernColor;
  readonly concernLabel = concernLabel;
  readonly statusLabel = feedbackStatusLabel;
  readonly statusChipClass = feedbackStatusChipClass;
  readonly date = formatFeedbackDate;
  readonly money = formatMoney;

  ngOnInit(): void {
    this.loading.set(true);
    this.api.feedbackList().subscribe({
      next: (rows) => {
        this.items.set(rows);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('โหลดความเห็นผู้ตรวจสอบไม่สำเร็จ');
        this.loading.set(false);
      },
    });
  }

  openProject(projectId: string): void {
    this.selectedProjectId.set(projectId);
    this.loadingDetail.set(true);
    this.error.set('');
    forkJoin({
      detail: this.api.project(projectId),
      assignments: this.api.assignments().pipe(catchError(() => of<AuditAssignment[]>([]))),
    }).subscribe({
      next: ({ detail, assignments }) => {
        this.projectDetail.set(detail);
        this.selectedAssignment.set(
          assignments
            .filter((assignment) => assignment.project_id === projectId)
            .sort(
              (first, second) =>
                new Date(second.created_at).getTime() - new Date(first.created_at).getTime(),
            )[0] ?? null,
        );
        this.loadingDetail.set(false);
      },
      error: () => {
        this.error.set('โหลดรายละเอียดโครงการไม่สำเร็จ');
        this.loadingDetail.set(false);
      },
    });
  }

  backToList(): void {
    this.selectedProjectId.set(null);
    this.projectDetail.set(null);
    this.selectedAssignment.set(null);
  }

  deptName(): string {
    const detail = this.projectDetail();
    return detail?.dept_name || detail?.dept_sub_name || 'ไม่ระบุ';
  }

  purchaseMethod(): string {
    const detail = this.projectDetail();
    return detail?.purchase_method || detail?.purchase_method_group || '-';
  }

  projectStatus(): string {
    const detail = this.projectDetail();
    return detail?.project_status || detail?.status || 'ไม่ระบุ';
  }
}
