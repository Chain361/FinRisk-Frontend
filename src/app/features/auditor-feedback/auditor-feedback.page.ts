import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';

import { ApiService } from '../../core/api/api.service';
import { AuditorFeedback } from '../../core/models/domain.models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
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
 * คลิกแถว → เปิด F3 พร้อมโครงการนั้นผ่าน ?projectId=
 */
@Component({
  selector: 'app-auditor-feedback-page',
  standalone: true,
  imports: [EmptyStateComponent],
  template: `
    <section class="page-shell">
      <div>
        <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F6</p>
        <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">ความเห็นผู้ตรวจสอบ</h1>
        <p class="m-0 mt-1.5 text-sm text-muted">
          รวมความเห็นทุกโครงการในขอบเขตของท่าน — ติดตามสถานะ ฉบับร่าง / ส่งแล้ว / ปิดเรื่องแล้ว
        </p>
      </div>

      @if (error()) {
        <p class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high">
          {{ error() }}
        </p>
      }

      <section class="panel overflow-hidden">
        <div class="border-b-[1.5px] border-line px-4 py-3.5">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div class="flex flex-wrap items-end gap-3">
              <label class="block">
                <span class="text-[12.5px] font-bold text-muted">สถานะ</span>
                <select
                  class="gov-select mt-1 w-auto!"
                  [value]="statusFilter()"
                  (change)="statusFilter.set($any($event.target).value)"
                >
                  <option value="">ทุกสถานะ</option>
                  <option value="draft">ฉบับร่าง</option>
                  <option value="submitted">ส่งแล้ว</option>
                  <option value="resolved">ปิดเรื่องแล้ว</option>
                </select>
              </label>
              <label class="block">
                <span class="text-[12.5px] font-bold text-muted">ระดับความกังวล</span>
                <select
                  class="gov-select mt-1 w-auto!"
                  [value]="concernFilter()"
                  (change)="concernFilter.set($any($event.target).value)"
                >
                  <option value="">ทุกระดับ</option>
                  <option value="high">สูง</option>
                  <option value="medium">ปานกลาง</option>
                  <option value="low">ต่ำ</option>
                </select>
              </label>
              <label class="block w-full max-w-xs">
                <span class="text-[12.5px] font-bold text-muted">ค้นหา</span>
                <input
                  type="search"
                  class="gov-input mt-1"
                  placeholder="Project ID ผู้ให้ความเห็น หรือข้อความ"
                  [value]="searchQuery()"
                  (input)="searchQuery.set($any($event.target).value)"
                />
              </label>
            </div>
            <span class="rounded-[20px] border border-line bg-zebra px-3 py-1 text-xs font-bold text-slate-700">
              {{ filteredItems().length }} / {{ items().length }} รายการ
            </span>
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
                  <th class="px-4 py-3">โครงการ / ความเห็น</th>
                  <th class="px-4 py-3">ผู้ให้ความเห็น</th>
                  <th class="px-4 py-3">ความกังวล</th>
                  <th class="px-4 py-3 text-right">คะแนน</th>
                  <th class="px-4 py-3">สถานะ</th>
                  <th class="px-4 py-3">อัปเดตล่าสุด</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 bg-white">
                @for (item of filteredItems(); track item.feedback_id) {
                  <tr class="cursor-pointer hover:bg-slate-50" (click)="openProject(item)">
                    <td class="max-w-md px-4 py-3">
                      <p class="m-0 text-xs font-bold text-muted">ID {{ item.project_id }}</p>
                      <p class="m-0 mt-0.5 line-clamp-2 text-[13px] text-slate-800">
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
                        >{{ concernLabel(item.concern_level) }}</span>
                      } @else {
                        <span class="text-muted">-</span>
                      }
                    </td>
                    <td class="px-4 py-3 text-right font-semibold">
                      {{ item.risk_score ?? '-' }}
                    </td>
                    <td class="px-4 py-3">
                      <span
                        class="inline-flex items-center rounded-[3px] px-2 py-1 text-[11.5px] font-extrabold"
                        [class]="statusChipClass(item.status)"
                      >{{ statusLabel(item.status) }}</span>
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
    </section>
  `,
})
export class AuditorFeedbackPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly items = signal<AuditorFeedback[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  readonly statusFilter = signal('');
  readonly concernFilter = signal('');
  readonly searchQuery = signal('');

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

  openProject(item: AuditorFeedback): void {
    this.router.navigate(['/risk-factors'], { queryParams: { projectId: item.project_id } });
  }
}
