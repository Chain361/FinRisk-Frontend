import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideChartLine,
  LucideCircleDollarSign,
  LucideLayoutDashboard,
  LucideLogOut,
  LucideShieldAlert,
  LucideTrendingUp,
} from '@lucide/angular';

import { AuthService } from '../core/auth/auth.service';
import { GuardrailBannerComponent } from '../shared/ui/guardrail-banner.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    GuardrailBannerComponent,
    LucideChartLine,
    LucideCircleDollarSign,
    LucideLayoutDashboard,
    LucideLogOut,
    LucideShieldAlert,
    LucideTrendingUp,
  ],
  template: `
    <div class="min-h-screen bg-slate-50 text-slate-950 lg:grid lg:grid-cols-[264px_1fr]">
      <aside class="border-b border-slate-200 bg-white lg:min-h-screen lg:border-b-0 lg:border-r">
        <div class="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
          <div class="flex size-9 items-center justify-center rounded-lg bg-slate-950 text-white">
            <svg lucideShieldAlert class="size-5"></svg>
          </div>
          <div>
            <p class="text-sm font-semibold">FinRisk</p>
            <p class="text-xs text-slate-500">Local Budget Analytics</p>
          </div>
        </div>

        <nav class="grid gap-1 p-3 text-sm font-medium">
          <a
            routerLink="/project-risk"
            routerLinkActive="bg-slate-950 text-white"
            class="flex items-center gap-3 rounded-md px-3 py-2.5 text-slate-700 hover:bg-slate-100"
          >
            <svg lucideLayoutDashboard class="size-4"></svg>
            Project Risk
          </a>
          <a
            routerLink="/financial-health"
            routerLinkActive="bg-slate-950 text-white"
            class="flex items-center gap-3 rounded-md px-3 py-2.5 text-slate-700 hover:bg-slate-100"
          >
            <svg lucideCircleDollarSign class="size-4"></svg>
            Financial Health
          </a>
          <a
            routerLink="/risk-factors"
            routerLinkActive="bg-slate-950 text-white"
            class="flex items-center gap-3 rounded-md px-3 py-2.5 text-slate-700 hover:bg-slate-100"
          >
            <svg lucideChartLine class="size-4"></svg>
            Risk Factors
          </a>
          <a
            routerLink="/trends"
            routerLinkActive="bg-slate-950 text-white"
            class="flex items-center gap-3 rounded-md px-3 py-2.5 text-slate-700 hover:bg-slate-100"
          >
            <svg lucideTrendingUp class="size-4"></svg>
            Trends
          </a>
        </nav>
      </aside>

      <main class="min-w-0">
        <header class="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:px-6">
          <div>
            <p class="text-sm font-semibold text-slate-950">แดชบอร์ดวิเคราะห์ความเสี่ยงงบประมาณท้องถิ่น</p>
            <p class="text-xs text-slate-500">Phase 1: วิเคราะห์โครงการ ปัจจัยเสี่ยง และแนวโน้มข้ามปี</p>
          </div>

          <div class="flex items-center gap-3">
            <div class="rounded-md border border-slate-200 px-3 py-2 text-right">
              <p class="text-xs font-semibold text-slate-700">{{ auth.user()?.username ?? auth.token() }}</p>
              <p class="text-[11px] uppercase text-slate-500">{{ auth.user()?.role ?? 'mock-auth' }}</p>
            </div>
            <button
              type="button"
              class="inline-flex size-10 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              title="ออกจากระบบ"
              (click)="auth.logout()"
            >
              <svg lucideLogOut class="size-4"></svg>
            </button>
          </div>
        </header>

        <div class="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 lg:px-6">
          <app-guardrail-banner />
          <router-outlet />
        </div>
      </main>
    </div>
  `,
})
export class AppShellComponent {
  readonly auth = inject(AuthService);
}
