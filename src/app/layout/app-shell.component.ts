import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import {
  LucideClipboardList,
  LucideFolderKanban,
  LucideFileText,
  LucideKeyRound,
  LucideLandmark,
  LucideLayoutDashboard,
  LucideMessageSquareText,
  LucideShieldCheck,
} from '@lucide/angular';
import { catchError, filter, map, of } from 'rxjs';

import { ApiService } from '../core/api/api.service';
import { AuthService } from '../core/auth/auth.service';
import { I18nService } from '../core/i18n/i18n.service';
import { ASSIGNMENT_ROLES, CHATBOT_ROLES } from '../core/auth/roles';
import { SystemMeta } from '../core/models/domain.models';
import { ChatbotWidgetComponent } from '../features/chatbot/chatbot-widget.component';
import { GuardrailBannerComponent } from '../shared/ui/guardrail-banner.component';
import { PrototypeBannerComponent } from '../shared/ui/prototype-banner.component';
import { NAV_GROUPS, NavGroup, NavItem } from './nav-groups';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    ChatbotWidgetComponent,
    GuardrailBannerComponent,
    PrototypeBannerComponent,
    LucideLayoutDashboard,
    LucideLandmark,
    LucideFolderKanban,
    LucideClipboardList,
    LucideFileText,
    LucideMessageSquareText,
    LucideShieldCheck,
    LucideKeyRound,
  ],
  template: `
    <a class="skip-link" href="#main-content">{{ t('a11y.skipToContent') }}</a>
    <app-prototype-banner />
    <div class="flex min-h-screen bg-page text-ink">
      <aside class="hidden w-[264px] shrink-0 flex-col bg-navy text-white lg:flex">
        <div class="border-b border-white/20 px-5 py-[22px]">
          <p class="m-0 text-[16px] font-bold leading-normal">
            ระบบวิเคราะห์ความเสี่ยง<br />งบประมาณตำบล
          </p>
          <p class="m-0 mt-2 text-xs tracking-wide text-[#c9d4e3]">
            Local Budget Financial Risk System
          </p>
        </div>

        <nav
          class="flex flex-1 flex-col overflow-y-auto py-2.5"
          [attr.aria-label]="t('a11y.mainNav')"
        >
          @for (group of visibleNavGroups(); track group.id) {
            <div>
              <div class="flex flex-col pb-1.5">
                @for (item of group.items; track item.label) {
                  @if (item.children?.length) {
                    <div>
                      <a
                        [routerLink]="item.path"
                        [attr.aria-current]="isActive(item.path) ? 'page' : null"
                        class="flex items-center gap-2.5 border-l-4 px-5 py-[11px] pl-[26px] text-sm font-semibold no-underline hover:bg-white/[.08]"
                        [class]="
                          isActiveGroup(item)
                            ? 'border-gold bg-white/10 text-white'
                            : 'border-transparent text-[#e6ecf5]'
                        "
                      >
                        @switch (item.code) {
                          @case ('risk_dashboard') {
                            <svg
                              lucideLayoutDashboard
                              class="size-[18px] shrink-0"
                              aria-hidden="true"
                            ></svg>
                          }
                          @case ('fiscal_dashboard') {
                            <svg
                              lucideLandmark
                              class="size-[18px] shrink-0"
                              aria-hidden="true"
                            ></svg>
                          }
                          @case ('projects_view') {
                            <svg
                              lucideFolderKanban
                              class="size-[18px] shrink-0"
                              aria-hidden="true"
                            ></svg>
                          }
                          @case ('assign_audit_tasks') {
                            <svg
                              lucideClipboardList
                              class="size-[18px] shrink-0"
                              aria-hidden="true"
                            ></svg>
                          }
                          @case ('team_reports') {
                            <svg
                              lucideFileCheck
                              class="size-[18px] shrink-0"
                              aria-hidden="true"
                            ></svg>
                          }
                          @case ('audit_feedback') {
                            <svg
                              lucideMessageSquareText
                              class="size-[18px] shrink-0"
                              aria-hidden="true"
                            ></svg>
                          }
                          @case ('auditor_feedback') {
                            <svg
                              lucideShieldCheck
                              class="size-[18px] shrink-0"
                              aria-hidden="true"
                            ></svg>
                          }
                          @case ('access_logs') {
                            <svg
                              lucideKeyRound
                              class="size-[18px] shrink-0"
                              aria-hidden="true"
                            ></svg>
                          }
                        }
                        <span>{{ item.label }}</span>
                      </a>

                      <div class="ml-6 flex flex-col">
                        @for (child of item.children; track child.path) {
                          <a
                            [routerLink]="child.path"
                            [attr.aria-current]="isActive(child.path, child.exact) ? 'page' : null"
                            class="flex items-center gap-2 border-l-2 px-4 py-2 text-[13px] no-underline hover:bg-white/[.08]"
                            [class]="
                              isActive(child.path, child.exact)
                                ? 'border-gold text-white bg-white/10'
                                : 'border-transparent text-[#c9d4e3]'
                            "
                          >
                            <span aria-hidden="true">•</span>
                            <span>{{ child.label }}</span>
                          </a>
                        }
                      </div>
                    </div>
                  } @else {
                    <a
                      [routerLink]="item.path"
                      [attr.aria-current]="isActive(item.path) ? 'page' : null"
                      class="flex items-center gap-2.5 border-l-4 px-5 py-[11px] pl-[26px] text-sm font-semibold no-underline hover:bg-white/[.08]"
                      [class]="
                        isActive(item.path)
                          ? 'border-gold bg-white/10 text-white'
                          : 'border-transparent text-[#e6ecf5]'
                      "
                    >
                      @switch (item.code) {
                        @case ('risk_dashboard') {
                          <svg
                            lucideLayoutDashboard
                            class="size-[18px] shrink-0"
                            aria-hidden="true"
                          ></svg>
                        }
                        @case ('fiscal_dashboard') {
                          <svg lucideLandmark class="size-[18px] shrink-0" aria-hidden="true"></svg>
                        }
                        @case ('projects_view') {
                          <svg
                            lucideFolderKanban
                            class="size-[18px] shrink-0"
                            aria-hidden="true"
                          ></svg>
                        }
                        @case ('assign_audit_tasks') {
                          <svg
                            lucideClipboardList
                            class="size-[18px] shrink-0"
                            aria-hidden="true"
                          ></svg>
                        }
                        @case ('team_reports') {
                          <svg lucideFileText class="size-[18px] shrink-0" aria-hidden="true"></svg>
                        }
                        @case ('audit_feedback') {
                          <svg
                            lucideMessageSquareText
                            class="size-[18px] shrink-0"
                            aria-hidden="true"
                          ></svg>
                        }
                        @case ('auditor_feedback') {
                          <svg
                            lucideShieldCheck
                            class="size-[18px] shrink-0"
                            aria-hidden="true"
                          ></svg>
                        }
                        @case ('access_logs') {
                          <svg lucideKeyRound class="size-[18px] shrink-0" aria-hidden="true"></svg>
                        }
                      }
                      <span>{{ item.label }}</span>
                    </a>
                  }
                }
              </div>
            </div>
          }
        </nav>

        <div class="border-t border-white/20 px-5 py-[18px]">
          <p class="m-0 text-xs text-[#9fb0c8]">ข้อมูลจากระบบ FinRisk Backend</p>
          <p class="m-0 mt-1 text-xs text-[#9fb0c8]">ข้อมูล ณ วันที่: {{ dataAsOf() }}</p>
          @if (fiscalYearRange()) {
            <p class="m-0 mt-1 text-xs text-[#9fb0c8]">
              ครอบคลุมปีงบประมาณ {{ fiscalYearRange() }}
            </p>
          }
          <div class="mt-2.5 flex flex-col gap-1 border-t border-white/10 pt-2.5">
            <a
              routerLink="/data-sources"
              class="text-xs text-[#c9d4e3] no-underline hover:text-white hover:underline"
            >
              ที่มาของข้อมูล
            </a>
            <a
              routerLink="/contact"
              class="text-xs text-[#c9d4e3] no-underline hover:text-white hover:underline"
            >
              ติดต่อ / แจ้งข้อมูลไม่ถูกต้อง
            </a>
          </div>
        </div>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <header
          class="flex flex-wrap items-center justify-between gap-4 border-b-2 border-navy bg-white px-4 py-3.5 lg:px-[30px]"
        >
          <div>
            <nav [attr.aria-label]="t('a11y.breadcrumb')">
              <p class="m-0 text-[12.5px] text-muted">
                หน้าหลัก /
                <span class="font-bold text-navy" aria-current="page">{{
                  currentPageLabel()
                }}</span>
              </p>
            </nav>
            <p class="m-0 mt-1 text-[13px] font-semibold text-slate-700">
              แดชบอร์ดวิเคราะห์ความเสี่ยงงบประมาณท้องถิ่น
            </p>
          </div>

          <div class="flex items-center gap-3.5">
            <div class="rounded-[3px] border-[1.5px] border-line px-3.5 py-[7px] text-right">
              <p class="m-0 text-[13px] font-bold text-ink">
                {{ auth.user()?.display_name ?? auth.user()?.username ?? auth.token() }}
              </p>
              <p class="m-0 mt-0.5 text-[11px] text-muted">
                {{ auth.roleLabel() }} ·
                <span
                  [class]="auth.isScopedRole() ? 'font-bold text-[#8a2a1f]' : 'font-bold text-navy'"
                >
                  {{ auth.isScopedRole() ? 'ขอบเขต: ตำบลของตน' : 'ขอบเขต: ทุกตำบล' }}
                </span>
              </p>
            </div>
            <button
              type="button"
              class="h-[38px] cursor-pointer rounded-[3px] border-[1.5px] border-line bg-white px-4 text-[13px] font-bold text-slate-700 hover:bg-zebra"
              (click)="auth.logout()"
            >
              ออกจากระบบ
            </button>
          </div>
        </header>

        <main
          id="main-content"
          tabindex="-1"
          [attr.aria-label]="t('a11y.mainContent')"
          class="flex flex-1 flex-col gap-[22px] px-4 pb-[60px] pt-[26px] lg:px-[30px]"
        >
          <app-guardrail-banner />
          <router-outlet />
        </main>
      </div>
    </div>

    @if (auth.hasRole(...chatbotRoles)) {
      <app-chatbot-widget />
    }
  `,
})
export class AppShellComponent {
  readonly auth = inject(AuthService);
  protected readonly t = inject(I18nService).t;
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);

  readonly navGroups = NAV_GROUPS;
  /** mirror ของ require_roles บน POST /chatbot (FinRisk-Backend routers/chatbot.py) */
  readonly chatbotRoles = CHATBOT_ROLES;

  /** เมทาดาทาระบบจาก /meta — data-as-of จริง (ไม่ใช่วันที่เครื่องผู้ใช้) */
  private readonly meta = toSignal<SystemMeta | null>(
    this.api.meta().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  /** "ข้อมูล ณ วันที่ …" — แปลงเป็น th-TH; ระหว่างโหลด/โหลดไม่ได้แสดง "—" (ห้าม fallback เป็นวันปัจจุบัน) */
  readonly dataAsOf = computed(() => {
    const raw = this.meta()?.data_seeded_at;
    if (!raw) {
      return '—';
    }
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime())
      ? '—'
      : new Intl.DateTimeFormat('th-TH', { dateStyle: 'long' }).format(parsed);
  });

  /** ช่วงปีงบที่ครอบคลุม เช่น "2566–2568" (ว่างเมื่อไม่มีข้อมูล) */
  readonly fiscalYearRange = computed(() => {
    const m = this.meta();
    return m?.fiscal_year_min && m?.fiscal_year_max
      ? `${m.fiscal_year_min}–${m.fiscal_year_max}`
      : '';
  });

  /**
   * เมนูที่ผู้ใช้ปัจจุบันเห็นได้ — item ที่ระบุ `roles` จะแสดงเฉพาะ role ในรายการ (รวม children)
   * เมนูระดับบนสุด (F1-F7/A1-A3/T1-T2) ต้องอยู่ใน allowedFeatures ของผู้ใช้คนนั้นด้วย
   * (ปรับรายคนได้จากหน้าจัดการผู้ใช้งาน) — children ไม่มีรหัสฟีเจอร์แยก จึงอิงสิทธิ์ตาม parent
   */
  readonly visibleNavGroups = computed<NavGroup[]>(() => {
    const canSeeByRole = (item: NavItem): boolean =>
      !item.roles || this.auth.hasRole(...item.roles);
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items
        .filter((item) => canSeeByRole(item) && this.auth.canAccessFeature(item.code))
        .map((item) =>
          item.children ? { ...item, children: item.children.filter(canSeeByRole) } : item,
        ),
    })).filter((group) => group.items.length > 0);
  });

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly currentPageLabel = computed(() => {
    const url = this.currentUrl();
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        const child = item.children?.find((navItem) =>
          this.matchesUrl(url, navItem.path, navItem.exact),
        );
        if (child) {
          return child.label;
        }
        if (this.matchesUrl(url, item.path, item.exact)) {
          return item.label;
        }
      }
    }
    return 'Project Risk Dashboard';
  });

  isActive(path: string, exact = false): boolean {
    return this.matchesUrl(this.currentUrl(), path, exact);
  }

  /** header ของกลุ่มติดไฮไลต์ด้วย ถ้า path ตัวเองตรง หรือ child คนไหนคนหนึ่งกำลังเปิดอยู่
   * (child บาง path เช่น F4.4 อยู่คนละ prefix กับ item.path ของ header จึงต้องเช็คแยก) */
  isActiveGroup(item: NavItem): boolean {
    if (this.isActive(item.path)) {
      return true;
    }
    return !!item.children?.some((child) => this.isActive(child.path, child.exact));
  }

  private matchesUrl(url: string, path: string, exact = false): boolean {
    return exact ? url === path : url.startsWith(path);
  }
}
