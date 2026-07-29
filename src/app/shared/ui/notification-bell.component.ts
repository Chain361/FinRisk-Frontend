import {
  Component,
  DestroyRef,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { LucideBell, LucideCheck, LucideCheckCheck } from '@lucide/angular';
import { interval } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AppNotification } from '../../core/models/domain.models';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [LucideBell, LucideCheck, LucideCheckCheck],
  template: `
    <div class="relative" data-notification-bell>
      <button
        type="button"
        class="relative inline-flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-[3px] border-[1.5px] border-line bg-white text-slate-700 hover:bg-zebra"
        [attr.aria-label]="bellLabel()"
        [attr.aria-expanded]="open()"
        aria-haspopup="menu"
        (click)="toggle()"
      >
        <svg lucideBell class="size-5" aria-hidden="true"></svg>
        @if (unreadCount() > 0) {
          <span
            class="absolute -right-1.5 -top-1.5 flex min-w-[20px] items-center justify-center rounded-full bg-risk-high px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-white"
            aria-hidden="true"
          >
            {{ unreadBadge() }}
          </span>
        }
      </button>

      @if (open()) {
        <section
          class="absolute right-0 z-50 mt-2 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[4px] border-[1.5px] border-line bg-white shadow-xl"
          role="menu"
          aria-label="การแจ้งเตือน"
        >
          <div class="flex items-center justify-between gap-3 border-b border-line-soft px-4 py-3">
            <div>
              <h2 class="m-0 text-sm font-extrabold text-ink">การแจ้งเตือน</h2>
              <p class="m-0 mt-0.5 text-xs text-muted">{{ unreadCount() }} รายการยังไม่ได้อ่าน</p>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                class="inline-flex h-8 items-center gap-1.5 rounded-[3px] border border-line bg-white px-2.5 text-xs font-bold text-slate-700 hover:bg-zebra disabled:cursor-not-allowed disabled:opacity-50"
                [disabled]="loading() || unreadCount() === 0 || markingAll()"
                (click)="markAllRead($event)"
              >
                <svg lucideCheckCheck class="size-3.5" aria-hidden="true"></svg>
                อ่านทั้งหมด
              </button>
            </div>
          </div>

          @if (error()) {
            <div class="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-risk-high">
              {{ error() }}
            </div>
          }

          @if (loading()) {
            <div class="px-4 py-6 text-center text-sm text-muted">กำลังโหลดการแจ้งเตือน...</div>
          } @else if (!notifications().length) {
            <div class="px-4 py-6 text-center text-sm text-muted">ยังไม่มีการแจ้งเตือน</div>
          } @else {
            <div class="max-h-[420px] overflow-y-auto">
              @for (notification of notifications(); track notification.notification_id) {
                <div
                  class="grid grid-cols-[1fr_auto] gap-2 border-b border-line-soft px-4 py-3 last:border-b-0"
                  [class.bg-[#f7fbff]]="!notification.read_at"
                >
                  <button
                    type="button"
                    class="min-w-0 cursor-pointer bg-transparent p-0 text-left"
                    role="menuitem"
                    (click)="openNotification(notification)"
                  >
                    <div class="flex items-start gap-2">
                      @if (!notification.read_at) {
                        <span
                          class="mt-1.5 size-2 shrink-0 rounded-full bg-risk-high"
                          aria-hidden="true"
                        ></span>
                      }
                      <div class="min-w-0">
                        <p class="m-0 text-[11px] font-extrabold uppercase text-navy">
                          {{ notificationTypeLabel(notification) }}
                        </p>
                        <p class="m-0 mt-1 line-clamp-2 text-sm font-bold leading-5 text-ink">
                          {{ notification.message }}
                        </p>
                        <p class="m-0 mt-1 text-xs text-muted">
                          {{ formatCreatedAt(notification.created_at) }}
                        </p>
                      </div>
                    </div>
                  </button>

                  @if (!notification.read_at) {
                    <button
                      type="button"
                      class="mt-0.5 inline-flex size-8 cursor-pointer items-center justify-center rounded-[3px] border border-line bg-white text-slate-700 hover:bg-zebra disabled:cursor-wait disabled:opacity-60"
                      aria-label="ทำเครื่องหมายว่าอ่านแล้ว"
                      [disabled]="markingId() === notification.notification_id"
                      (click)="markReadOnly(notification, $event)"
                    >
                      <svg lucideCheck class="size-4" aria-hidden="true"></svg>
                    </button>
                  }
                </div>
              }
            </div>
          }
        </section>
      }
    </div>
  `,
})
export class NotificationBellComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly open = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notifications = signal<AppNotification[]>([]);
  readonly unreadCount = signal(0);
  readonly markingId = signal<number | null>(null);
  readonly markingAll = signal(false);

  readonly unreadBadge = computed(() =>
    this.unreadCount() > 99 ? '99+' : String(this.unreadCount()),
  );
  readonly bellLabel = computed(() =>
    this.unreadCount() > 0
      ? `การแจ้งเตือน มี ${this.unreadCount()} รายการยังไม่ได้อ่าน`
      : 'การแจ้งเตือน',
  );

  ngOnInit(): void {
    this.loadNotifications(true);
    interval(60_000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadNotifications(false));
  }

  @HostListener('document:keydown.escape')
  close(): void {
    this.open.set(false);
  }

  @HostListener('document:click', ['$event'])
  closeOnOutsideClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;
    if (this.open() && target && !target.closest('[data-notification-bell]')) {
      this.close();
    }
  }

  toggle(): void {
    const nextOpen = !this.open();
    this.open.set(nextOpen);
    if (nextOpen) {
      this.loadNotifications(false);
    }
  }

  loadNotifications(showLoading: boolean): void {
    if (showLoading) {
      this.loading.set(true);
    }
    this.error.set('');
    this.api.notifications().subscribe({
      next: (response) => {
        this.notifications.set(response.notifications);
        this.unreadCount.set(response.unread_count);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('โหลดการแจ้งเตือนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
        this.loading.set(false);
      },
    });
  }

  openNotification(notification: AppNotification): void {
    if (notification.read_at) {
      this.navigateToReference(notification);
      return;
    }

    this.markAsRead(notification, true);
  }

  markReadOnly(notification: AppNotification, event: MouseEvent): void {
    event.stopPropagation();
    this.markAsRead(notification, false);
  }

  markAllRead(event: MouseEvent): void {
    event.stopPropagation();
    if (this.unreadCount() === 0 || this.markingAll()) {
      return;
    }

    this.markingAll.set(true);
    this.error.set('');
    this.api.markAllNotificationsRead().subscribe({
      next: () => {
        const readAt = new Date().toISOString();
        this.notifications.update((items) =>
          items.map((item) => ({ ...item, read_at: item.read_at ?? readAt })),
        );
        this.unreadCount.set(0);
        this.markingAll.set(false);
      },
      error: () => {
        this.error.set('ทำเครื่องหมายอ่านทั้งหมดไม่สำเร็จ');
        this.markingAll.set(false);
      },
    });
  }

  notificationTypeLabel(notification: AppNotification): string {
    if (notification.type === 'assignment') {
      return 'งานที่ได้รับมอบหมาย';
    }
    if (notification.type === 'high_risk') {
      return 'พบความเสี่ยงสูง';
    }
    return 'แจ้งเตือนระบบ';
  }

  formatCreatedAt(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'ไม่ระบุเวลา'
      : new Intl.DateTimeFormat('th-TH', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Bangkok',
        }).format(date);
  }

  private markAsRead(notification: AppNotification, navigateAfterRead: boolean): void {
    if (this.markingId()) {
      return;
    }

    this.markingId.set(notification.notification_id);
    this.error.set('');
    this.api.markNotificationRead(notification.notification_id).subscribe({
      next: () => {
        this.setNotificationRead(notification.notification_id);
        this.markingId.set(null);
        if (navigateAfterRead) {
          this.navigateToReference(notification);
        }
      },
      error: () => {
        this.error.set('ทำเครื่องหมายอ่านแล้วไม่สำเร็จ');
        this.markingId.set(null);
      },
    });
  }

  private setNotificationRead(notificationId: number): void {
    const readAt = new Date().toISOString();
    this.notifications.update((items) =>
      items.map((item) =>
        item.notification_id === notificationId
          ? { ...item, read_at: item.read_at ?? readAt }
          : item,
      ),
    );
    this.unreadCount.set(this.notifications().filter((item) => !item.read_at).length);
  }

  private navigateToReference(notification: AppNotification): void {
    this.close();
    if (notification.ref_type === 'assignment' && notification.ref_id) {
      void this.router.navigate(['/risk-analyst/task', notification.ref_id]);
      return;
    }

    if (notification.ref_type === 'project' && notification.ref_id) {
      void this.router.navigate(['/risk-factors'], {
        queryParams: { projectId: notification.ref_id },
      });
    }
  }
}
