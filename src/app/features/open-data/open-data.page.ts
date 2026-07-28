import { Component, inject, signal } from '@angular/core';
import {
  LucideDownload,
  LucideFileJson,
  LucideFileSpreadsheet,
  LucideShieldCheck,
} from '@lucide/angular';
import { finalize } from 'rxjs';

import { ApiService } from '../../core/api/api.service';

type ExportFormat = 'csv' | 'json';

@Component({
  selector: 'app-open-data-page',
  standalone: true,
  imports: [LucideDownload, LucideFileJson, LucideFileSpreadsheet, LucideShieldCheck],
  template: `
    <section class="page-shell">
      <div class="flex flex-col gap-2">
        <p class="m-0 text-sm font-bold text-navy">ข้อมูลเปิดภาครัฐ (Open Data)</p>
        <h1 class="m-0 text-[26px] font-extrabold text-ink">
          ดาวน์โหลดข้อมูลโครงการเพื่อการวิเคราะห์
        </h1>
        <p class="m-0 max-w-3xl text-sm leading-6 text-muted">
          ดาวน์โหลดข้อมูลโครงการและผลประเมินความเสี่ยงที่เผยแพร่บนแดชบอร์ด เพื่อให้ประชาชน สื่อมวลชน
          และนักวิเคราะห์นำไปตรวจสอบหรือวิเคราะห์ต่อได้
        </p>
      </div>

      <section class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <article class="panel flex flex-col p-5">
          <div class="flex items-start gap-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-navy"
            >
              <svg lucideFileSpreadsheet class="size-5" aria-hidden="true"></svg>
            </span>
            <div>
              <h2 class="m-0 text-lg font-bold text-ink">CSV</h2>
              <p class="m-0 mt-1 text-sm leading-6 text-muted">
                เหมาะสำหรับเปิดใน Excel หรือ Google Sheets และนำไปวิเคราะห์ในโปรแกรมตารางคำนวณ
              </p>
            </div>
          </div>
          <button
            type="button"
            class="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-[4px] bg-navy px-4 py-2 text-sm font-bold text-white transition hover:bg-[#102e56] disabled:cursor-not-allowed disabled:opacity-60"
            [disabled]="downloading() !== null"
            (click)="download('csv')"
          >
            <svg lucideDownload class="size-4" aria-hidden="true"></svg>
            {{ downloading() === 'csv' ? 'กำลังเตรียมไฟล์…' : 'ดาวน์โหลด CSV' }}
          </button>
        </article>

        <article class="panel flex flex-col p-5">
          <div class="flex items-start gap-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-navy"
            >
              <svg lucideFileJson class="size-5" aria-hidden="true"></svg>
            </span>
            <div>
              <h2 class="m-0 text-lg font-bold text-ink">JSON</h2>
              <p class="m-0 mt-1 text-sm leading-6 text-muted">
                เหมาะสำหรับนักพัฒนาและการประมวลผลด้วยโปรแกรม โดยมีเมทาดาทาของชุดข้อมูลแนบมาด้วย
              </p>
            </div>
          </div>
          <button
            type="button"
            class="mt-5 inline-flex min-h-10 items-center justify-center gap-2 rounded-[4px] bg-navy px-4 py-2 text-sm font-bold text-white transition hover:bg-[#102e56] disabled:cursor-not-allowed disabled:opacity-60"
            [disabled]="downloading() !== null"
            (click)="download('json')"
          >
            <svg lucideDownload class="size-4" aria-hidden="true"></svg>
            {{ downloading() === 'json' ? 'กำลังเตรียมไฟล์…' : 'ดาวน์โหลด JSON' }}
          </button>
        </article>
      </section>

      @if (errorMessage()) {
        <p
          class="m-0 rounded-[4px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {{ errorMessage() }}
        </p>
      }

      <section class="panel p-5">
        <div class="flex items-start gap-3">
          <svg lucideShieldCheck class="mt-0.5 size-5 shrink-0 text-navy" aria-hidden="true"></svg>
          <div>
            <h2 class="m-0 text-base font-bold text-ink">ขอบเขตและการใช้ข้อมูล</h2>
            <p class="m-0 mt-1.5 text-sm leading-6 text-muted">
              ชุดข้อมูลมีเฉพาะรหัสและชื่อโครงการ ตำบล ปีงบประมาณ งบประมาณ คะแนนความเสี่ยง
              และระดับความเสี่ยง ข้อมูลการตรวจสอบหรือข้อมูลภายใน เช่น ความเห็นผู้ตรวจสอบ หลักฐาน
              และบันทึกการเข้าถึง ไม่รวมอยู่ในไฟล์นี้
            </p>
            <p class="m-0 mt-2 text-sm leading-6 text-muted">
              เผยแพร่ภายใต้ Open Government License ตามมาตรฐาน data.go.th โปรดอ้างอิงแหล่งที่มา
              “FinRisk” เมื่อนำข้อมูลไปใช้หรือเผยแพร่ต่อ
            </p>
          </div>
        </div>
      </section>
    </section>
  `,
})
export class OpenDataPageComponent {
  private readonly api = inject(ApiService);

  readonly downloading = signal<ExportFormat | null>(null);
  readonly errorMessage = signal('');

  download(format: ExportFormat): void {
    if (this.downloading()) {
      return;
    }

    this.downloading.set(format);
    this.errorMessage.set('');

    this.api
      .downloadPublicProjects(format)
      .pipe(finalize(() => this.downloading.set(null)))
      .subscribe({
        next: (response) => this.saveFile(response.body, format),
        error: () => {
          this.errorMessage.set('ไม่สามารถดาวน์โหลดข้อมูลได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง');
        },
      });
  }

  private saveFile(blob: Blob | null, format: ExportFormat): void {
    if (!blob) {
      this.errorMessage.set('ไม่พบไฟล์ข้อมูลสำหรับดาวน์โหลด กรุณาลองใหม่อีกครั้ง');
      return;
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `finrisk_projects_open_data_${new Date().toISOString().slice(0, 10)}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
