import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { I18nService } from '../i18n/i18n.service';
import { ApiService } from '../api/api.service';
import { AppUser, LoginResponse } from '../models/domain.models';
import { SCOPED_ROLES } from './roles';
import { TOKEN_KEY } from './x-username.interceptor';

const USER_KEY = 'finrisk_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly user = signal<AppUser | null>(this.restoreUser());
  readonly isAuthenticated = computed(() => Boolean(this.token()));

  /** role code ของผู้ใช้ปัจจุบัน (null = ยังไม่ login) */
  readonly role = computed(() => this.user()?.role ?? null);

  /** role นี้ถูกจำกัดขอบเขตข้อมูลเฉพาะตำบลของตนเอง (ตาม roles.md) */
  readonly isScopedRole = computed(() => {
    const role = this.role();
    return role !== null && (SCOPED_ROLES as readonly string[]).includes(role);
  });

  /** ชื่อบทบาทสำหรับแสดงบน UI (ตามภาษาปัจจุบัน) */
  readonly roleLabel = computed(() => {
    const user = this.user();
    if (!user) {
      return this.i18n.t('role.unknown');
    }
    const key = `role.${user.role}`;
    const label = this.i18n.t(key);
    // ถ้า role code ไม่มีใน dictionary ให้ fallback เป็นชื่อที่ backend ส่งมา
    return label === key ? (user.display_name ?? user.role) : label;
  });

  /** true เมื่อ role ปัจจุบันอยู่ในรายการที่อนุญาต */
  hasRole(...allowed: string[]): boolean {
    const role = this.role();
    return role !== null && allowed.includes(role);
  }

  login(username: string, password: string): Observable<LoginResponse> {
    return this.api.login({ username, password }).pipe(
      tap((response) => {
        localStorage.setItem(TOKEN_KEY, response.token);
        localStorage.setItem(USER_KEY, JSON.stringify(response.user));
        this.token.set(response.token);
        this.user.set(response.user);
      }),
    );
  }

  refreshMe(): void {
    if (!this.token()) {
      return;
    }

    this.api.me().subscribe({
      next: (response) => {
        const user = response.user ?? response;
        localStorage.setItem(USER_KEY, JSON.stringify(user));
        this.user.set(user);
      },
      error: () => this.logout(),
    });
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.token.set(null);
    this.user.set(null);
    void this.router.navigate(['/login']);
  }

  private restoreUser(): AppUser | null {
    const stored = localStorage.getItem(USER_KEY);
    if (!stored) {
      return null;
    }

    try {
      return JSON.parse(stored) as AppUser;
    } catch {
      localStorage.removeItem(USER_KEY);
      return null;
    }
  }
}
