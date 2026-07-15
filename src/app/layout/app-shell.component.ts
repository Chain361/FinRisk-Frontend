import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';

import { AuthService } from '../core/auth/auth.service';
import { GuardrailBannerComponent } from '../shared/ui/guardrail-banner.component';

interface NavItem {
  code: string;
  label: string;
  path: string;
  children?: NavItem[];
}

interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    label: 'ภาพรวมความเสี่ยง',
    items: [{ code: 'F1', label: 'แดชบอร์ดความเสี่ยงโครงการ', path: '/project-risk' }],
  },
  {
    id: 'finance',
    label: 'การเงินและปัจจัยเสี่ยง',
    items: [
      {
        code: 'F2',
        label: 'สถานะและสุขภาพการคลัง',
        path: '/financial-health',
        children: [
          {
            code: 'F2.1',
            label: 'ภาพรวมสุขภาพการคลัง',
            path: '/financial-health/overview',
          },
          {
            code: 'F2.2',
            label: 'เปรียบเทียบสถานะการคลัง',
            path: '/financial-health/benchmarking',
          },
          {
            code: 'F2.3',
            label: 'แนวโน้มการลงทุนและการจัดซื้อจัดจ้าง',
            path: '/financial-health/investment-trends',
          },
          {
            code: 'F2.4',
            label: 'ตัวชี้วัดความเสี่ยงทางการคลัง',
            path: '/financial-health/risk-indicators',
          },
        ],
      },
      { code: 'F3', label: 'วิเคราะห์ปัจจัยความเสี่ยง', path: '/risk-factors' },
    ],
  },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, GuardrailBannerComponent],
  template: `
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

        <nav class="flex flex-1 flex-col overflow-y-auto py-2.5">
          @for (group of navGroups; track group.id) {
            <div>
              <div class="flex flex-col pb-1.5">
                @for (item of group.items; track item.label) {
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
                        <span>{{ item.label }}</span>
                      </a>

                      <div class="ml-6 flex flex-col">
                        @for (child of item.children; track child.path) {
                          <a
                            [routerLink]="child.path"
                            class="flex items-center gap-2 border-l-2 px-4 py-2 text-[13px] no-underline hover:bg-white/[.08]"
                            [class]="
                              isActive(child.path)
                                ? 'border-gold text-white bg-white/10'
                                : 'border-transparent text-[#c9d4e3]'
                            "
                          >
                            <span>•</span>
                            <span>{{ child.label }}</span>
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
          <p class="m-0 mt-1 text-xs text-[#9fb0c8]">อัปเดตล่าสุด: {{ today }}</p>
        </div>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <header
          class="flex flex-wrap items-center justify-between gap-4 border-b-2 border-navy bg-white px-4 py-3.5 lg:px-[30px]"
        >
          <div>
            <p class="m-0 text-[12.5px] text-muted">
              หน้าหลัก / <span class="font-bold text-navy">{{ currentPageLabel() }}</span>
            </p>
            <p class="m-0 mt-1 text-[13px] font-semibold text-slate-700">
              แดชบอร์ดวิเคราะห์ความเสี่ยงงบประมาณท้องถิ่น
            </p>
          </div>

          <div class="flex items-center gap-3.5">
            <div class="rounded-[3px] border-[1.5px] border-line px-3.5 py-[7px] text-right">
              <p class="m-0 text-[13px] font-bold text-ink">
                {{ auth.user()?.username ?? auth.token() }}
              </p>
              <p class="m-0 mt-0.5 text-[11px] uppercase text-muted">
                {{ auth.user()?.role ?? 'mock-auth' }}
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

  readonly navGroups = NAV_GROUPS;

  readonly today = new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium' }).format(new Date());

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
      const item = group.items.find((navItem) => url.startsWith(navItem.path));
      if (item) {
        return item.label;
      }
    }
    return 'Project Risk Dashboard';
  });

  isActive(path: string): boolean {
    return this.currentUrl().startsWith(path);
  }
}
