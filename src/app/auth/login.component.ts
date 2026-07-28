import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideLogIn, LucideShieldAlert } from '@lucide/angular';

import { AuthService } from '../core/auth/auth.service';
import { firstAccessibleNavPath } from '../layout/nav-groups';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, LucideLogIn, LucideShieldAlert],
  template: `
    <main class="grid min-h-screen place-items-center bg-page px-4 py-8">
      <section class="w-full max-w-md rounded-[4px] border-2 border-navy bg-white p-6">
        <div class="flex items-center gap-3">
          <div class="flex size-10 items-center justify-center rounded-[4px] bg-navy text-white">
            <svg lucideShieldAlert class="size-5" aria-hidden="true"></svg>
          </div>
          <div>
            <h1 class="m-0 text-lg font-extrabold text-ink">
              ระบบวิเคราะห์ความเสี่ยงงบประมาณตำบล
            </h1>
            <p class="m-0 mt-0.5 text-[12.5px] text-muted">
              Local Budget Financial Risk System
            </p>
          </div>
        </div>

        <form class="mt-6 grid gap-4" (ngSubmit)="submit()">
          <label class="grid gap-1.5">
            <span class="text-[12.5px] font-bold text-muted">ชื่อผู้ใช้ (Username)</span>
            <input
              name="username"
              class="gov-input h-11"
              [(ngModel)]="username"
              autocomplete="username"
              required
            />
          </label>

          <label class="grid gap-1.5">
            <span class="text-[12.5px] font-bold text-muted">รหัสผ่าน (Password)</span>
            <input
              name="password"
              type="password"
              class="gov-input h-11"
              [(ngModel)]="password"
              autocomplete="current-password"
              required
            />
          </label>

          @if (error()) {
            <p
              class="rounded-[3px] border-[1.5px] border-risk-high bg-red-50 px-3 py-2 text-sm text-risk-high"
            >
              {{ error() }}
            </p>
          }

          <button
            type="submit"
            class="gov-btn-primary inline-flex h-11 items-center justify-center gap-2 disabled:cursor-not-allowed disabled:bg-slate-400"
            [disabled]="loading()"
          >
            <svg lucideLogIn class="size-4" aria-hidden="true"></svg>
            {{ loading() ? 'กำลังเข้าสู่ระบบ' : 'เข้าสู่ระบบ' }}
          </button>
        </form>

        <p class="mt-4 text-xs leading-5 text-muted">
          ระบบรองรับ 6 บทบาท (ผู้ดูแลระบบ · ผู้กำกับดูแล · ผู้บริหารตำบล · ผู้ตรวจสอบโครงการ ·
          นักวิเคราะห์ · ประชาชนทั่วไป) — ขอบเขตข้อมูลและสิทธิ์แตกต่างตามบทบาทที่ login
        </p>
        <p class="mt-1.5 text-xs leading-5 text-muted">
          login จะได้ JWT access token กลับมา และทุก request หลังจากนั้นจะแนบเป็น header
          Authorization: Bearer อัตโนมัติ
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
      next: () => {
        const user = this.auth.user();

        // admin เข้าหน้าจัดการผู้ใช้งานก่อนเสมอ เพื่อให้ตั้งค่าสิทธิ์ฟีเจอร์ของตัวเอง/คนอื่นได้ก่อนใช้งานส่วนอื่น
        if (user?.role === 'admin') {
          void this.router.navigate(['/admin/user-management']);
        } else {
          void this.router.navigate([firstAccessibleNavPath(this.auth)]);
        }
      },
      error: () => {
        this.error.set('เข้าสู่ระบบไม่สำเร็จ ตรวจ username และลองอีกครั้ง');
        this.loading.set(false);
      },
    });
  }
}
