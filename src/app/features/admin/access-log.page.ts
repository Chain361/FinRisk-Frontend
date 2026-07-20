import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api/api.service';
import { ROLE_LABELS } from '../../core/auth/roles';
import { AccessLogEntry, AccessLogFilters } from '../../core/models/domain.models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';

/** ป้ายภาษาไทยของ action (map จากค่าที่ backend derive) */
const ACTION_LABELS: Record<string, string> = {
  login: 'เข้าสู่ระบบ',
  view_list: 'ดูรายการ',
  view_detail: 'ดูรายละเอียด',
  export: 'ส่งออกข้อมูล',
  write: 'แก้ไขข้อมูล',
  other: 'อื่น ๆ',
};

const RESOURCE_LABELS: Record<string, string> = {
  project: 'โครงการ',
  risk: 'ความเสี่ยง',
  subdistrict: 'ตำบล',
  financial: 'การเงิน',
  audit: 'การตรวจสอบ',
  auth: 'การยืนยันตัวตน',
};

const PAGE_SIZE = 100;

@Component({
  selector: 'app-access-log-page',
  standalone: true,
  imports: [FormsModule, EmptyStateComponent],
  template: `
    <section class="page-shell">
      <div>
        <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">ผู้ดูแลระบบ</p>
        <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">บันทึกการเข้าถึงระบบ (Access Log)</h1>
        <p class="m-0 mt-1.5 text-sm text-muted">
          บันทึกว่าใครเข้าดูหรือทำอะไรกับข้อมูลใด เมื่อไหร่ — เพื่อความรับผิดชอบและตรวจสอบย้อนหลังได้
          (บันทึกทั้งที่สำเร็จและที่ถูกปฏิเสธสิทธิ์)
        </p>
      </div>

      <!-- ตัวกรอง -->
      <div class="grid gap-3.5 rounded-[4px] border-[1.5px] border-line bg-white px-[18px] py-4 sm:grid-cols-2 lg:grid-cols-5">
        <label class="block">
          <span class="text-[12.5px] font-bold text-muted">ชื่อผู้ใช้</span>
          <input class="gov-input mt-[5px]" [(ngModel)]="fUsername" placeholder="เช่น analyst1" />
        </label>
        <label class="block">
          <span class="text-[12.5px] font-bold text-muted">การกระทำ</span>
          <select class="gov-select mt-[5px]" [(ngModel)]="fAction">
            <option value="">ทั้งหมด</option>
            <option value="view_list">ดูรายการ</option>
            <option value="view_detail">ดูรายละเอียด</option>
            <option value="export">ส่งออกข้อมูล</option>
            <option value="write">แก้ไขข้อมูล</option>
            <option value="login">เข้าสู่ระบบ</option>
          </select>
        </label>
        <label class="block">
          <span class="text-[12.5px] font-bold text-muted">ประเภทข้อมูล</span>
          <select class="gov-select mt-[5px]" [(ngModel)]="fResource">
            <option value="">ทั้งหมด</option>
            <option value="project">โครงการ</option>
            <option value="risk">ความเสี่ยง</option>
            <option value="subdistrict">ตำบล</option>
            <option value="financial">การเงิน</option>
            <option value="audit">การตรวจสอบ</option>
          </select>
        </label>
        <label class="block">
          <span class="text-[12.5px] font-bold text-muted">ตั้งแต่วันที่</span>
          <input type="date" class="gov-input mt-[5px]" [(ngModel)]="fFrom" />
        </label>
        <label class="block">
          <span class="text-[12.5px] font-bold text-muted">ถึงวันที่</span>
          <input type="date" class="gov-input mt-[5px]" [(ngModel)]="fTo" />
        </label>
        <div class="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
          <button type="button" class="gov-btn-primary h-[38px] px-4 text-[13px] font-bold" (click)="applyFilters()">
            กรองข้อมูล
          </button>
          <button
            type="button"
            class="h-[38px] cursor-pointer rounded-[3px] border-[1.5px] border-line bg-white px-4 text-[13px] font-bold text-slate-700 hover:bg-zebra"
            (click)="resetFilters()"
          >
            ล้างตัวกรอง
          </button>
        </div>
      </div>

      @if (error()) {
        <p class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high">
          {{ error() }}
        </p>
      }

      @if (loading()) {
        <p class="text-sm text-muted">กำลังโหลดบันทึก…</p>
      } @else if (entries().length === 0) {
        <app-empty-state
          title="ยังไม่มีบันทึกการเข้าถึง"
          message="ยังไม่มีเหตุการณ์ที่ตรงกับตัวกรอง หรือระบบยังไม่ได้บันทึก (บนโฮสต์ที่ฐานข้อมูลเขียนไม่ได้ เช่น serverless บันทึกจะว่าง)"
        />
      } @else {
        <section class="panel p-[18px]">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p class="m-0 text-[13px] text-muted">
              พบ {{ total() }} รายการ · แสดง {{ offset() + 1 }}–{{ offset() + entries().length }}
            </p>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="h-[34px] rounded-[3px] border-[1.5px] border-line bg-white px-3 text-[13px] font-bold text-slate-700 enabled:hover:bg-zebra disabled:cursor-not-allowed disabled:text-slate-400"
                [disabled]="offset() === 0"
                (click)="prevPage()"
              >
                ก่อนหน้า
              </button>
              <button
                type="button"
                class="h-[34px] rounded-[3px] border-[1.5px] border-line bg-white px-3 text-[13px] font-bold text-slate-700 enabled:hover:bg-zebra disabled:cursor-not-allowed disabled:text-slate-400"
                [disabled]="offset() + entries().length >= total()"
                (click)="nextPage()"
              >
                ถัดไป
              </button>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="gov-table">
              <thead>
                <tr>
                  <th>เวลา</th>
                  <th>ผู้ใช้</th>
                  <th>บทบาท</th>
                  <th>การกระทำ</th>
                  <th>ประเภทข้อมูล</th>
                  <th>เส้นทาง (endpoint)</th>
                  <th class="text-right!">สถานะ</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                @for (row of entries(); track row.log_id) {
                  <tr>
                    <td class="whitespace-nowrap text-[12.5px]">{{ formatTime(row.created_at) }}</td>
                    <td class="font-bold">{{ row.username ?? '—' }}</td>
                    <td class="text-[12.5px] text-muted">{{ roleLabel(row.role) }}</td>
                    <td>
                      <span class="rounded-[3px] bg-zebra px-2 py-0.5 text-[12px] font-bold text-slate-700">
                        {{ actionLabel(row.action) }}
                      </span>
                    </td>
                    <td class="text-[12.5px]">{{ resourceLabel(row) }}</td>
                    <td class="font-mono text-[11.5px] text-slate-600">{{ row.method }} {{ row.path }}</td>
                    <td class="text-right">
                      <span class="font-bold" [class]="statusClass(row.status_code)">
                        {{ row.status_code ?? '—' }}
                      </span>
                    </td>
                    <td class="text-[12px] text-muted">{{ row.ip ?? '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    </section>
  `,
})
export class AccessLogPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly loading = signal(false);
  readonly error = signal('');
  readonly entries = signal<AccessLogEntry[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);

  // ค่าในช่องกรอง (ผูกกับ ngModel) — จะถูกนำไปใช้เมื่อกด "กรองข้อมูล"
  fUsername = '';
  fAction = '';
  fResource = '';
  fFrom = '';
  fTo = '';

  private readonly applied = signal<AccessLogFilters>({});

  readonly activeFilters = computed<AccessLogFilters>(() => ({
    ...this.applied(),
    limit: PAGE_SIZE,
    offset: this.offset(),
  }));

  ngOnInit(): void {
    this.load();
  }

  applyFilters(): void {
    this.offset.set(0);
    this.applied.set({
      username: this.fUsername.trim() || null,
      action: this.fAction || null,
      resource_type: this.fResource || null,
      date_from: this.fFrom || null,
      date_to: this.fTo || null,
    });
    this.load();
  }

  resetFilters(): void {
    this.fUsername = '';
    this.fAction = '';
    this.fResource = '';
    this.fFrom = '';
    this.fTo = '';
    this.offset.set(0);
    this.applied.set({});
    this.load();
  }

  prevPage(): void {
    this.offset.set(Math.max(0, this.offset() - PAGE_SIZE));
    this.load();
  }

  nextPage(): void {
    this.offset.set(this.offset() + PAGE_SIZE);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.accessLog(this.activeFilters()).subscribe({
      next: (page) => {
        this.entries.set(page.items ?? []);
        this.total.set(page.total ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.entries.set([]);
        this.total.set(0);
        this.error.set('โหลดบันทึกไม่สำเร็จ — ต้องเป็นผู้ดูแลระบบ (admin) และเชื่อมต่อ backend ได้');
        this.loading.set(false);
      },
    });
  }

  actionLabel(action: string): string {
    return ACTION_LABELS[action] ?? action;
  }

  roleLabel(role: string | null): string {
    return role ? (ROLE_LABELS[role] ?? role) : '—';
  }

  resourceLabel(row: AccessLogEntry): string {
    if (!row.resource_type) {
      return '—';
    }
    const base = RESOURCE_LABELS[row.resource_type] ?? row.resource_type;
    return row.resource_id ? `${base} · ${row.resource_id}` : base;
  }

  statusClass(status?: number | null): string {
    if (status == null) {
      return 'text-muted';
    }
    if (status >= 200 && status < 300) {
      return 'text-risk-low';
    }
    if (status === 401 || status === 403) {
      return 'text-risk-high';
    }
    return 'text-slate-700';
  }

  formatTime(value: string): string {
    const d = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
    if (Number.isNaN(d.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'medium' }).format(d);
  }
}
