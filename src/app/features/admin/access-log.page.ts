import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ApiService } from '../../core/api/api.service';
import { I18nService } from '../../core/i18n/i18n.service';
import { AccessLogEntry, AccessLogFilters } from '../../core/models/domain.models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';

const PAGE_SIZE = 100;

@Component({
  selector: 'app-access-log-page',
  standalone: true,
  imports: [FormsModule, EmptyStateComponent],
  template: `
    <section class="page-shell">
      <div>
        <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">{{ t('nav.group.admin') }}</p>
        <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">{{ t('accessLog.title') }}</h1>
        <p class="m-0 mt-1.5 text-sm text-muted">{{ t('accessLog.subtitle') }}</p>
      </div>

      <!-- ตัวกรอง -->
      <div class="grid gap-3.5 rounded-[4px] border-[1.5px] border-line bg-white px-[18px] py-4 sm:grid-cols-2 lg:grid-cols-5">
        <label class="block">
          <span class="text-[12.5px] font-bold text-muted">{{ t('accessLog.filter.username') }}</span>
          <input class="gov-input mt-[5px]" [(ngModel)]="fUsername" [placeholder]="t('accessLog.filter.usernamePlaceholder')" />
        </label>
        <label class="block">
          <span class="text-[12.5px] font-bold text-muted">{{ t('accessLog.filter.action') }}</span>
          <select class="gov-select mt-[5px]" [(ngModel)]="fAction">
            <option value="">{{ t('common.all') }}</option>
            <option value="view_list">{{ t('accessLog.action.view_list') }}</option>
            <option value="view_detail">{{ t('accessLog.action.view_detail') }}</option>
            <option value="export">{{ t('accessLog.action.export') }}</option>
            <option value="write">{{ t('accessLog.action.write') }}</option>
            <option value="login">{{ t('accessLog.action.login') }}</option>
          </select>
        </label>
        <label class="block">
          <span class="text-[12.5px] font-bold text-muted">{{ t('accessLog.filter.resource') }}</span>
          <select class="gov-select mt-[5px]" [(ngModel)]="fResource">
            <option value="">{{ t('common.all') }}</option>
            <option value="project">{{ t('accessLog.resource.project') }}</option>
            <option value="risk">{{ t('accessLog.resource.risk') }}</option>
            <option value="subdistrict">{{ t('accessLog.resource.subdistrict') }}</option>
            <option value="financial">{{ t('accessLog.resource.financial') }}</option>
            <option value="audit">{{ t('accessLog.resource.audit') }}</option>
          </select>
        </label>
        <label class="block">
          <span class="text-[12.5px] font-bold text-muted">{{ t('accessLog.filter.dateFrom') }}</span>
          <input type="date" class="gov-input mt-[5px]" [(ngModel)]="fFrom" />
        </label>
        <label class="block">
          <span class="text-[12.5px] font-bold text-muted">{{ t('accessLog.filter.dateTo') }}</span>
          <input type="date" class="gov-input mt-[5px]" [(ngModel)]="fTo" />
        </label>
        <div class="flex items-end gap-2 sm:col-span-2 lg:col-span-5">
          <button type="button" class="gov-btn-primary h-[38px] px-4 text-[13px] font-bold" (click)="applyFilters()">
            {{ t('accessLog.filter.apply') }}
          </button>
          <button
            type="button"
            class="h-[38px] cursor-pointer rounded-[3px] border-[1.5px] border-line bg-white px-4 text-[13px] font-bold text-slate-700 hover:bg-zebra"
            (click)="resetFilters()"
          >
            {{ t('accessLog.filter.clear') }}
          </button>
        </div>
      </div>

      @if (error()) {
        <p class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high">
          {{ error() }}
        </p>
      }

      @if (loading()) {
        <p class="text-sm text-muted">{{ t('accessLog.loading') }}</p>
      } @else if (entries().length === 0) {
        <app-empty-state
          [title]="t('accessLog.emptyTitle')"
          [message]="t('accessLog.emptyMsg')"
        />
      } @else {
        <section class="panel p-[18px]">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p class="m-0 text-[13px] text-muted">
              {{
                t('accessLog.summary', {
                  total: total(),
                  from: offset() + 1,
                  to: offset() + entries().length,
                })
              }}
            </p>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="h-[34px] rounded-[3px] border-[1.5px] border-line bg-white px-3 text-[13px] font-bold text-slate-700 enabled:hover:bg-zebra disabled:cursor-not-allowed disabled:text-slate-400"
                [disabled]="offset() === 0"
                (click)="prevPage()"
              >
                {{ t('common.prev') }}
              </button>
              <button
                type="button"
                class="h-[34px] rounded-[3px] border-[1.5px] border-line bg-white px-3 text-[13px] font-bold text-slate-700 enabled:hover:bg-zebra disabled:cursor-not-allowed disabled:text-slate-400"
                [disabled]="offset() + entries().length >= total()"
                (click)="nextPage()"
              >
                {{ t('common.next') }}
              </button>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="gov-table">
              <thead>
                <tr>
                  <th>{{ t('accessLog.col.time') }}</th>
                  <th>{{ t('accessLog.col.user') }}</th>
                  <th>{{ t('accessLog.col.role') }}</th>
                  <th>{{ t('accessLog.col.action') }}</th>
                  <th>{{ t('accessLog.col.resource') }}</th>
                  <th>{{ t('accessLog.col.path') }}</th>
                  <th class="text-right!">{{ t('accessLog.col.status') }}</th>
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
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

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
        this.error.set(this.t('accessLog.error'));
        this.loading.set(false);
      },
    });
  }

  actionLabel(action: string): string {
    const key = `accessLog.action.${action}`;
    const label = this.t(key);
    return label === key ? action : label;
  }

  roleLabel(role: string | null): string {
    if (!role) {
      return '—';
    }
    const key = `role.${role}`;
    const label = this.t(key);
    return label === key ? role : label;
  }

  resourceLabel(row: AccessLogEntry): string {
    if (!row.resource_type) {
      return '—';
    }
    const key = `accessLog.resource.${row.resource_type}`;
    const label = this.t(key);
    const base = label === key ? row.resource_type : label;
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
    return new Intl.DateTimeFormat(this.i18n.locale(), {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(d);
  }
}
