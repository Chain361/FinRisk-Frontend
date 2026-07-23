import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { catchError, filter, map, of } from 'rxjs';

import { ApiService } from '../core/api/api.service';
import { AuthService } from '../core/auth/auth.service';
import { I18nService } from '../core/i18n/i18n.service';
import { SystemMeta } from '../core/models/domain.models';
import { GuardrailBannerComponent } from '../shared/ui/guardrail-banner.component';
import { LanguageToggleComponent } from '../shared/ui/language-toggle.component';
import { PrototypeBannerComponent } from '../shared/ui/prototype-banner.component';

interface NavItem {
  code: string;
  labelKey: string;
  path: string;
  children?: NavItem[];
  exact?: boolean;
  /** จำกัดเมนูเฉพาะบาง role (ตาม roles.md) — ไม่ระบุ = ทุก role เห็น */
  roles?: string[];
}

interface NavGroup {
  id: string;
  labelKey: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    labelKey: 'nav.group.overview',
    items: [
      {
        code: 'F1',
        labelKey: 'nav.projectRiskDashboard',
        path: '/project-risk',
        children: [
          {
            code: 'F1.1',
            labelKey: 'nav.projectRiskOverview',
            path: '/project-risk/overview',
          },
          {
            code: 'F1.2',
            labelKey: 'nav.projectRiskInsights',
            path: '/project-risk/insights',
          },
        ],
      },
    ],
  },
  {
    id: 'finance',
    labelKey: 'nav.group.finance',
    items: [
      {
        code: 'F2',
        labelKey: 'nav.financialHealth',
        path: '/financial-health',
        children: [
          {
            code: 'F2.1',
            labelKey: 'nav.financialOverview',
            path: '/financial-health/overview',
          },
          {
            code: 'F2.2',
            labelKey: 'nav.financialBenchmarking',
            path: '/financial-health/benchmarking',
          },
          {
            code: 'F2.3',
            labelKey: 'nav.financialInvestment',
            path: '/financial-health/investment-trends',
          },
          {
            code: 'F2.4',
            labelKey: 'nav.financialRiskIndicators',
            path: '/financial-health/risk-indicators',
          },
        ],
      },
      {
        code: 'F3',
        labelKey: 'nav.allProjects',
        path: '/risk-factors',
        children: [
          {
            code: 'F3.1',
            labelKey: 'nav.projectDetail',
            path: '/risk-factors',
            exact: true,
          },
          {
            code: 'F3.2',
            labelKey: 'nav.projectStatus',
            path: '/risk-factors/status',
          },
        ],
      },
      {
        code: 'F4',
        labelKey: 'nav.assignment',
        path: '/assignment-project-auditor',
        children: [
          {
            code: 'F4.1',
            labelKey: 'nav.assignmentMain',
            path: '/assignment-project-auditor',
            exact: true,
          },
          {
            code: 'F4.2',
            labelKey: 'nav.assignmentHistory',
            path: '/assignment-project-auditor/history',
          },
          {
            code: 'F4.3',
            labelKey: 'nav.assignmentReview',
            path: '/assignment-project-auditor/review',
          },
        ],
      },
      {
        code: 'F5',
        labelKey: 'nav.riskAnalystFeedback',
        path: '/risk-analyst-feedback',
      },
    ],
  },
  {
    id: 'admin',
    labelKey: 'nav.group.admin',
    items: [
      {
        code: 'A1',
        labelKey: 'nav.accessLog',
        path: '/admin/access-log',
        roles: ['admin'], // เห็นเฉพาะ admin — ตรงกับ roleGuard('admin') ที่ route
      },
    ],
  },
  {
    id: 'audit',
    label: 'งานตรวจสอบ',
    items: [
      {
        code: 'F6',
        label: 'ความเห็นผู้ตรวจสอบ',
        path: '/auditor-feedback',
        // mirror FEEDBACK_ROLES (core/auth/roles.ts) — ซ่อนจาก public_user
        roles: ['admin', 'regional_supervisor', 'local_executive', 'project_auditor', 'risk_analyst'],
      },
    ],
  },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    GuardrailBannerComponent,
    LanguageToggleComponent,
    PrototypeBannerComponent,
  ],
  template: `
    <app-prototype-banner />
    <div class="flex min-h-screen bg-page text-ink">
      <aside class="hidden w-[264px] shrink-0 flex-col bg-navy text-white lg:flex">
        <div class="border-b border-white/20 px-5 py-[22px]">
          <p class="m-0 text-[16px] font-bold leading-normal">
            {{ t('shell.brand.line1') }}<br />{{ t('shell.brand.line2') }}
          </p>
          <p class="m-0 mt-2 text-xs tracking-wide text-[#c9d4e3]">
            {{ t('shell.brand.subtitle') }}
          </p>
        </div>

        <nav class="flex flex-1 flex-col overflow-y-auto py-2.5">
          @for (group of visibleNavGroups(); track group.id) {
            <div>
              <div class="flex flex-col pb-1.5">
                @for (item of group.items; track item.labelKey) {
                  @if (item.children?.length) {
                    <div>
                      <a
                        [routerLink]="item.path"
                        class="flex items-center gap-2.5 border-l-4 px-5 py-[11px] pl-[26px] text-sm font-semibold no-underline hover:bg-white/[.08]"
                        [class]="
                          isActive(item.path)
                            ? 'border-gold bg-white/10 text-white'
                            : 'border-transparent text-[#e6ecf5]'
                        "
                      >
                        <span class="text-[12.5px] opacity-85">{{ item.code }}</span>
                        <span>{{ t(item.labelKey) }}</span>
                      </a>

                      <div class="ml-6 flex flex-col">
                        @for (child of item.children; track child.path) {
                          <a
                            [routerLink]="child.path"
                            class="flex items-center gap-2 border-l-2 px-4 py-2 text-[13px] no-underline hover:bg-white/[.08]"
                            [class]="
                              isActive(child.path, child.exact)
                                ? 'border-gold text-white bg-white/10'
                                : 'border-transparent text-[#c9d4e3]'
                            "
                          >
                            <span>•</span>
                            <span>{{ t(child.labelKey) }}</span>
                          </a>
                        }
                      </div>
                    </div>
                  } @else {
                    <a
                      [routerLink]="item.path"
                      class="flex items-center gap-2.5 border-l-4 px-5 py-[11px] pl-[26px] text-sm font-semibold no-underline hover:bg-white/[.08]"
                      [class]="
                        isActive(item.path)
                          ? 'border-gold bg-white/10 text-white'
                          : 'border-transparent text-[#e6ecf5]'
                      "
                    >
                      <span class="text-[12.5px] opacity-85">{{ item.code }}</span>
                      <span>{{ t(item.labelKey) }}</span>
                    </a>
                  }
                }
              </div>
            </div>
          }
        </nav>

        <div class="border-t border-white/20 px-5 py-[18px]">
          <p class="m-0 text-xs text-[#9fb0c8]">{{ t('shell.footer.source') }}</p>
          <p class="m-0 mt-1 text-xs text-[#9fb0c8]">
            {{ t('shell.footer.dataAsOf', { date: dataAsOf() }) }}
          </p>
          @if (fiscalYearRange()) {
            <p class="m-0 mt-1 text-xs text-[#9fb0c8]">
              {{ t('shell.footer.coverage', { range: fiscalYearRange() }) }}
            </p>
          }
        </div>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <header
          class="flex flex-wrap items-center justify-between gap-4 border-b-2 border-navy bg-white px-4 py-3.5 lg:px-[30px]"
        >
          <div>
            <p class="m-0 text-[12.5px] text-muted">
              {{ t('shell.breadcrumb.home') }} /
              <span class="font-bold text-navy">{{ currentPageLabel() }}</span>
            </p>
            <p class="m-0 mt-1 text-[13px] font-semibold text-slate-700">
              {{ t('shell.header.subtitle') }}
            </p>
          </div>

          <div class="flex items-center gap-3.5">
            <app-language-toggle />
            <div class="rounded-[3px] border-[1.5px] border-line px-3.5 py-[7px] text-right">
              <p class="m-0 text-[13px] font-bold text-ink">
                {{ auth.user()?.display_name ?? auth.user()?.username ?? auth.token() }}
              </p>
              <p class="m-0 mt-0.5 text-[11px] text-muted">
                {{ auth.roleLabel() }} ·
                <span
                  [class]="auth.isScopedRole() ? 'font-bold text-[#8a2a1f]' : 'font-bold text-navy'"
                >
                  {{ auth.isScopedRole() ? t('shell.scope.own') : t('shell.scope.all') }}
                </span>
              </p>
            </div>
            <button
              type="button"
              class="h-[38px] cursor-pointer rounded-[3px] border-[1.5px] border-line bg-white px-4 text-[13px] font-bold text-slate-700 hover:bg-zebra"
              (click)="auth.logout()"
            >
              {{ t('shell.logout') }}
            </button>
          </div>
        </header>

        <main class="flex flex-1 flex-col gap-[22px] px-4 pb-[60px] pt-[26px] lg:px-[30px]">
          <app-guardrail-banner />
          <router-outlet />
        </main>
      </div>
    </div>
  `,
})
export class AppShellComponent {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.t;

  readonly navGroups = NAV_GROUPS;

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
      : new Intl.DateTimeFormat(this.i18n.locale(), { dateStyle: 'long' }).format(parsed);
  });

  /** ช่วงปีงบที่ครอบคลุม เช่น "2566–2568" (ว่างเมื่อไม่มีข้อมูล) */
  readonly fiscalYearRange = computed(() => {
    const m = this.meta();
    return m?.fiscal_year_min && m?.fiscal_year_max
      ? `${m.fiscal_year_min}–${m.fiscal_year_max}`
      : '';
  });

  /** เมนูที่ role ปัจจุบันเห็นได้ — item ที่ระบุ `roles` จะแสดงเฉพาะ role ในรายการ (รวม children) */
  readonly visibleNavGroups = computed<NavGroup[]>(() => {
    const canSee = (item: NavItem): boolean => !item.roles || this.auth.hasRole(...item.roles);
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items
        .filter(canSee)
        .map((item) =>
          item.children ? { ...item, children: item.children.filter(canSee) } : item,
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
          return this.i18n.t(child.labelKey);
        }
        if (this.matchesUrl(url, item.path, item.exact)) {
          return this.i18n.t(item.labelKey);
        }
      }
    }
    return this.i18n.t('shell.defaultPageLabel');
  });

  isActive(path: string, exact = false): boolean {
    return this.matchesUrl(this.currentUrl(), path, exact);
  }

  private matchesUrl(url: string, path: string, exact = false): boolean {
    return exact ? url === path : url.startsWith(path);
  }
}
