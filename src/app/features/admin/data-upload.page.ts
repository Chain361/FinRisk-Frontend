import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api/api.service';
import { DataUploadResult, RiskEngineRunResult, Subdistrict } from '../../core/models/domain.models';

@Component({
  selector: 'app-data-upload-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <section class="page-shell">
      <div>
        <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">ผู้ดูแลระบบ</p>
        <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">นำเข้าข้อมูล & รัน Risk Engine</h1>
        <p class="m-0 mt-1.5 text-sm text-muted">
          นำเข้าโครงการ/งบการเงินรอบใหม่ของตำบลที่มีอยู่แล้ว หรือสั่งคำนวณคะแนนความเสี่ยงใหม่จากข้อมูลปัจจุบัน
          — ทั้งสองอย่างเป็นสิทธิ์ admin เท่านั้น
        </p>
      </div>

      <!-- สั่งรัน risk engine ใหม่ -->
      <section class="panel p-[18px]">
        <h2 class="m-0 text-[16px] font-extrabold text-ink">สั่งรัน risk engine ใหม่</h2>
        <p class="m-0 mt-1.5 text-[12.5px] text-muted">
          คำนวณคะแนนความเสี่ยงใหม่จากข้อมูล projects/financial_statements ปัจจุบันในฐานข้อมูล
          (ไม่อ่าน CSV ใหม่ — ใช้หลังนำเข้าข้อมูลด้านล่าง หรือหลังแก้เกณฑ์ปัจจัยเสี่ยง)
        </p>

        <button
          type="button"
          class="gov-btn-primary mt-3.5 h-[38px] px-4 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-60"
          [disabled]="engineRunning()"
          (click)="runEngine()"
        >
          {{ engineRunning() ? 'กำลังคำนวณ…' : 'รัน risk engine ใหม่' }}
        </button>

        @if (engineError()) {
          <p class="mt-3 rounded-[3px] border-[1.5px] border-risk-high bg-red-50 px-3 py-2 text-sm text-risk-high">
            {{ engineError() }}
          </p>
        }

        @if (engineResult(); as result) {
          <p class="mt-3 rounded-[3px] border-[1.5px] border-risk-low bg-green-50 px-3 py-2 text-sm text-ink">
            คำนวณเสร็จแล้ว (run #{{ result.run_id }}, {{ result.run_at }}) — โครงการ
            {{ result.project_count }} รายการ, ผลรายปี {{ result.annual_count }} รายการ
          </p>
        }
      </section>

      <!-- นำเข้าข้อมูลรอบใหม่ -->
      <section class="panel p-[18px]">
        <h2 class="m-0 text-[16px] font-extrabold text-ink">นำเข้าข้อมูลรอบใหม่</h2>
        <p class="m-0 mt-1.5 text-[12.5px] text-muted">
          นำเข้าได้เฉพาะตำบลที่มีอยู่แล้วในระบบ ไฟล์ต้องเป็นตำบลเดียวกันทั้งไฟล์ และต้องมีฟอร์แมตคอลัมน์ตรงตาม
          <code class="rounded-[3px] bg-zebra px-1 py-0.5 text-[11.5px]">_schema_dictionary.md</code>
          — ข้อมูลใหม่จะยังไม่ขึ้นบน dashboard จนกว่าจะกด "รัน risk engine ใหม่" ด้านบนต่อ
        </p>

        <form class="mt-3.5 grid gap-3.5 sm:grid-cols-2" (ngSubmit)="submitUpload()">
          <label class="block sm:col-span-2">
            <span class="text-[12.5px] font-bold text-muted">ตำบล</span>
            <select class="gov-select mt-[5px]" [(ngModel)]="subdistrictId" name="subdistrictId" required>
              <option [ngValue]="null" disabled>เลือกตำบล</option>
              @for (sub of subdistricts(); track sub.subdistrict_id) {
                <option [ngValue]="sub.subdistrict_id">{{ sub.name_th ?? sub.subdistrict_name }}</option>
              }
            </select>
          </label>

          <label class="block">
            <span class="text-[12.5px] font-bold text-muted">ไฟล์โครงการ (projects_csv)</span>
            <input
              type="file"
              accept=".csv"
              class="gov-input mt-[5px]"
              (change)="onFileChange($event, 'projects')"
            />
          </label>

          <label class="block">
            <span class="text-[12.5px] font-bold text-muted">ไฟล์งบการเงิน (financial_csv)</span>
            <input
              type="file"
              accept=".csv"
              class="gov-input mt-[5px]"
              (change)="onFileChange($event, 'financial')"
            />
          </label>

          <div class="sm:col-span-2">
            <button
              type="submit"
              class="gov-btn-primary h-[38px] px-4 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-60"
              [disabled]="uploading() || !canSubmit()"
            >
              {{ uploading() ? 'กำลังนำเข้า…' : 'นำเข้าข้อมูล' }}
            </button>
          </div>
        </form>

        @if (uploadError()) {
          <p class="mt-3 rounded-[3px] border-[1.5px] border-risk-high bg-red-50 px-3 py-2 text-sm text-risk-high">
            {{ uploadError() }}
          </p>
        }

        @if (uploadResult(); as result) {
          <div class="mt-3 rounded-[3px] border-[1.5px] border-risk-low bg-green-50 px-3 py-2 text-sm text-ink">
            <p class="m-0">
              นำเข้าสำเร็จ — โครงการใหม่ {{ result.projects_inserted }} รายการ,
              งบการเงินใหม่ {{ result.financial_rows_inserted }} แถว
            </p>
            @if (result.projects_skipped_duplicate.length > 0) {
              <p class="m-0 mt-1 text-[12.5px] text-muted">
                ข้ามโครงการซ้ำ {{ result.projects_skipped_duplicate.length }} รายการ:
                {{ result.projects_skipped_duplicate.join(', ') }}
              </p>
            }
            <button
              type="button"
              class="mt-2 h-[32px] cursor-pointer rounded-[3px] border-[1.5px] border-line bg-white px-3 text-[12.5px] font-bold text-slate-700 hover:bg-zebra"
              (click)="runEngine()"
            >
              รัน risk engine ใหม่ตอนนี้
            </button>
          </div>
        }
      </section>
    </section>
  `,
})
export class DataUploadPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly subdistricts = signal<Subdistrict[]>([]);
  subdistrictId: number | null = null;

  private projectsFile: File | null = null;
  private financialFile: File | null = null;

  readonly uploading = signal(false);
  readonly uploadError = signal('');
  readonly uploadResult = signal<DataUploadResult | null>(null);

  readonly engineRunning = signal(false);
  readonly engineError = signal('');
  readonly engineResult = signal<RiskEngineRunResult | null>(null);

  ngOnInit(): void {
    this.api.subdistricts().subscribe({ next: (list) => this.subdistricts.set(list) });
  }

  onFileChange(event: Event, kind: 'projects' | 'financial'): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (kind === 'projects') {
      this.projectsFile = file;
    } else {
      this.financialFile = file;
    }
  }

  canSubmit(): boolean {
    return this.subdistrictId !== null && (this.projectsFile !== null || this.financialFile !== null);
  }

  submitUpload(): void {
    if (!this.canSubmit() || this.uploading()) {
      return;
    }
    this.uploading.set(true);
    this.uploadError.set('');
    this.uploadResult.set(null);

    this.api.uploadAdminData(this.subdistrictId!, this.projectsFile, this.financialFile).subscribe({
      next: (result) => {
        this.uploadResult.set(result);
        this.uploading.set(false);
      },
      error: (response: { error?: { detail?: string } }) => {
        this.uploadError.set(response.error?.detail ?? 'นำเข้าข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        this.uploading.set(false);
      },
    });
  }

  runEngine(): void {
    if (this.engineRunning()) {
      return;
    }
    this.engineRunning.set(true);
    this.engineError.set('');
    this.engineResult.set(null);

    this.api.runRiskEngine().subscribe({
      next: (result) => {
        this.engineResult.set(result);
        this.engineRunning.set(false);
      },
      error: (response: { error?: { detail?: string } }) => {
        this.engineError.set(response.error?.detail ?? 'รัน risk engine ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        this.engineRunning.set(false);
      },
    });
  }
}
