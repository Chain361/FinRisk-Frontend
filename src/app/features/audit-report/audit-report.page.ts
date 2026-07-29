import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiService } from '../../core/api/api.service';
import { AuditReport } from '../../core/models/domain.models';
import { triggerBlobDownload } from '../../shared/utils/file-download-utils';

@Component({
  selector: 'app-audit-report-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page-shell">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">WP</p>
          <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">บันทึกผลตรวจโครงการ</h1>
          <p class="m-0 mt-1.5 text-sm text-muted">
            สร้างจากความคิดเห็นที่ผู้ตรวจสอบโครงการอนุมัติแล้ว
          </p>
        </div>
        <a routerLink="/risk-factors" class="gov-btn-outline no-underline"
          >กลับหน้าความเสี่ยงโครงการ</a
        >
      </div>

      @if (loading()) {
        <p class="mt-6 text-sm text-muted">กำลังโหลดข้อมูลรายงาน...</p>
      } @else if (error()) {
        <div
          class="mt-5 rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high"
        >
          {{ error() }}
        </div>
      } @else if (report(); as item) {
        @if (saved()) {
          <div
            class="mt-5 rounded-[4px] border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            บันทึกรายงานผลตรวจเรียบร้อยแล้ว เลขที่รายงาน FINRISK-{{ item.report_id }}
          </div>
        }

        <article class="panel mt-5 overflow-hidden p-0">
          <div class="border-b border-line px-5 py-4">
            <h2 class="m-0 text-center text-[17px] font-extrabold text-ink">
              การประเมินความเสี่ยงเบื้องต้นเกี่ยวกับกิจกรรมการตรวจสอบ
            </h2>
            <div class="mt-3 grid gap-1 text-sm leading-6 text-ink">
              <p class="m-0">
                <span class="font-bold">โครงการ/งานที่เข้าตรวจสอบ:</span> {{ item.project_name }}
              </p>
              <p class="m-0">
                <span class="font-bold">หน่วยงาน:</span> {{ item.dept_name || 'ไม่ระบุ' }}
              </p>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="min-w-[920px] w-full border-collapse text-sm text-ink">
              <thead class="bg-zebra text-center">
                <tr>
                  <th rowspan="2" class="border border-line px-3 py-2">
                    กระบวนการงาน/<br />ภารกิจงาน
                  </th>
                  <th rowspan="2" class="border border-line px-3 py-2">
                    วัตถุประสงค์<br />ของกระบวนงาน
                  </th>
                  <th rowspan="2" class="border border-line px-3 py-2">
                    ความเสี่ยง/<br />ปัจจัยเสี่ยง
                  </th>
                  <th colspan="4" class="border border-line px-3 py-2">การประเมินความเสี่ยง</th>
                  <th rowspan="2" class="border border-line px-3 py-2">ลำดับ<br />ความเสี่ยง</th>
                </tr>
                <tr>
                  <th class="border border-line px-3 py-2">โอกาส</th>
                  <th class="border border-line px-3 py-2">ผลกระทบ</th>
                  <th class="border border-line px-3 py-2">ระดับคะแนน</th>
                  <th class="border border-line px-3 py-2">ระดับความเสี่ยง</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colspan="8" class="border border-line bg-zebra px-3 py-2 font-bold">
                    กิจกรรม
                  </td>
                </tr>
                <tr class="align-top">
                  <td class="border border-line px-3 py-3 leading-6">
                    {{ item.work_process || 'ไม่ระบุ' }}
                  </td>
                  <td class="border border-line px-3 py-3 leading-6">
                    {{ item.objective || 'ไม่ระบุ' }}
                  </td>
                  <td class="border border-line px-3 py-3 leading-6 whitespace-pre-line">
                    {{ item.findings }}
                  </td>
                  <td class="border border-line px-3 py-3 text-center">
                    {{ item.likelihood ?? '-' }}
                  </td>
                  <td class="border border-line px-3 py-3 text-center">{{ item.impact ?? '-' }}</td>
                  <td class="border border-line px-3 py-3 text-center">{{ riskScore(item) }}</td>
                  <td class="border border-line px-3 py-3 text-center">
                    {{ concernLabel(item.concern_level) }}
                  </td>
                  <td class="border border-line px-3 py-3 text-center">1</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="border-t border-line px-5 py-4">
            <p class="m-0 text-sm font-bold text-navy">ข้อเสนอแนะ</p>
            <p class="m-0 mt-1 whitespace-pre-line text-sm leading-6 text-ink">
              {{ item.suggestions || 'ไม่มีข้อเสนอแนะเพิ่มเติม' }}
            </p>
          </div>
        </article>

        <div class="mt-5 flex flex-wrap justify-end gap-2">
          @if (!item.report_id) {
            <button type="button" class="gov-btn-primary" [disabled]="saving()" (click)="save()">
              {{ saving() ? 'กำลังบันทึก...' : 'บันทึกผลตรวจโครงการ' }}
            </button>
          } @else {
            <button type="button" class="gov-btn-outline" (click)="download(item.report_id, 'pdf')">
              ดาวน์โหลด PDF
            </button>
            <button
              type="button"
              class="gov-btn-outline"
              (click)="download(item.report_id, 'xlsx')"
            >
              ดาวน์โหลด Excel
            </button>
          }
        </div>
      }
    </section>
  `,
})
export class AuditReportPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly saved = signal(false);
  readonly error = signal('');
  readonly report = signal<AuditReport | null>(null);

  ngOnInit(): void {
    const feedbackId = Number(this.route.snapshot.paramMap.get('feedbackId'));
    if (!Number.isInteger(feedbackId) || feedbackId <= 0) {
      this.loading.set(false);
      this.error.set('รหัสความคิดเห็นไม่ถูกต้อง');
      return;
    }
    this.api.auditReportFromFeedback(feedbackId).subscribe({
      next: (report) => {
        this.report.set(report);
        this.saved.set(report.report_id !== null);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.detail ?? 'ไม่สามารถโหลดข้อมูลรายงานได้');
        this.loading.set(false);
      },
    });
  }

  riskScore(item: AuditReport): string {
    return item.likelihood && item.impact ? `${item.likelihood * item.impact}/25` : '-';
  }

  concernLabel(value: AuditReport['concern_level']): string {
    return (
      ({ low: 'ต่ำ', medium: 'ปานกลาง', high: 'สูง' } as Record<string, string>)[String(value)] ??
      '-'
    );
  }

  save(): void {
    const feedbackId = this.report()?.feedback_id;
    if (!feedbackId) return;
    this.saving.set(true);
    this.error.set('');
    this.api.createAuditReportFromFeedback(feedbackId).subscribe({
      next: (report) => {
        this.report.set(report);
        this.saved.set(true);
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.detail ?? 'บันทึกผลตรวจไม่สำเร็จ');
        this.saving.set(false);
      },
    });
  }

  download(reportId: number, format: 'pdf' | 'xlsx'): void {
    this.api.downloadAuditReport(reportId, format).subscribe({
      next: (blob) => triggerBlobDownload(blob, `finrisk_audit_report_${reportId}.${format}`),
      error: () => this.error.set('ดาวน์โหลดรายงานไม่สำเร็จ'),
    });
  }
}
