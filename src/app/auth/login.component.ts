import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideLogIn, LucideShieldAlert } from '@lucide/angular';

import { AuthService } from '../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, LucideLogIn, LucideShieldAlert],
  template: `
    <main class="grid min-h-screen place-items-center bg-slate-100 px-4 py-8">
      <section class="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-lg bg-slate-950 text-white">
            <svg lucideShieldAlert class="size-5"></svg>
          </div>
          <div>
            <h1 class="text-lg font-semibold text-slate-950">FinRisk Dashboard</h1>
            <p class="text-sm text-slate-500">เข้าสู่ระบบ mock auth ของ backend</p>
          </div>
        </div>

        <form class="mt-6 grid gap-4" (ngSubmit)="submit()">
          <label class="grid gap-1.5">
            <span class="text-sm font-semibold text-slate-700">Username</span>
            <input
              name="username"
              class="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
              [(ngModel)]="username"
              autocomplete="username"
              required
            />
          </label>

          <label class="grid gap-1.5">
            <span class="text-sm font-semibold text-slate-700">Password</span>
            <input
              name="password"
              type="password"
              class="h-11 rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-slate-900"
              [(ngModel)]="password"
              autocomplete="current-password"
              required
            />
          </label>

          @if (error()) {
            <p class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{{ error() }}</p>
          }

          <button
            type="submit"
            class="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            [disabled]="loading()"
          >
            <svg lucideLogIn class="size-4"></svg>
            {{ loading() ? 'กำลังเข้าสู่ระบบ' : 'เข้าสู่ระบบ' }}
          </button>
        </form>

        <p class="mt-4 text-xs leading-5 text-slate-500">
          Backend ใช้ token เป็น username และทุก request หลัง login จะส่ง header X-Username อัตโนมัติ
        </p>
      </section>
    </main>
  `,
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  username = '';
  password = 'password123';
  readonly loading = signal(false);
  readonly error = signal('');

  submit(): void {
    if (!this.username || !this.password || this.loading()) {
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.username, this.password).subscribe({
      next: () => void this.router.navigate(['/project-risk']),
      error: () => {
        this.error.set('เข้าสู่ระบบไม่สำเร็จ ตรวจ username และลองอีกครั้ง');
        this.loading.set(false);
      },
    });
  }
}
