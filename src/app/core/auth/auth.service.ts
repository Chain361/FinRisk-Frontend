import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { ApiService } from '../api/api.service';
import { AppUser, LoginResponse } from '../models/domain.models';
import { canAccessFeature, resolveAllowedFeatures } from './features';
import { SCOPED_ROLES } from './roles';
import { TOKEN_KEY, USER_KEY, isTokenExpired } from './auth.constants';

const ROLE_LABELS: Record<string, string> = {
  admin: 'ผู้ดูแลระบบ',
  regional_supervisor: 'ผู้กำกับดูแลอำเภอ/จังหวัด',
  local_executive: 'ผู้บริหารตำบล (นายก/ปลัด)',
  project_auditor: 'ผู้ตรวจสอบโครงการ',
  risk_analyst: 'นักวิเคราะห์/ตรวจสอบภายใน',
  public_user: 'ประชาชนทั่วไป',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(this.readStoredToken());
  readonly user = signal<AppUser | null>(this.restoreUser());
  readonly isAuthenticated = computed(() => {
    const token = this.token();
    return token !== null && !isTokenExpired(token);
  });

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
      return 'ไม่ระบุบทบาท';
    }
    // ถ้า role code ไม่มีใน ROLE_LABELS ให้ fallback เป็นชื่อที่ backend ส่งมา
    return ROLE_LABELS[user.role] ?? (user.display_name ?? user.role);
  });

  /** true เมื่อ role ปัจจุบันอยู่ในรายการที่อนุญาต */
  hasRole(...allowed: string[]): boolean {
    const role = this.role();
    return role !== null && allowed.includes(role);
  }

  /**
   * รหัสฟีเจอร์ที่ผู้ใช้ปัจจุบันเข้าถึงได้ — override รายคนจาก user-management ถ้ามี
   * มาจาก user.allowed_features ที่ /auth/login + /auth/me ส่งมาให้ตรงๆ (ไม่ต้องพึ่ง GET /users
   * ซึ่งเป็น admin เท่านั้น — ถ้าไปเรียกตรงนี้ ผู้ใช้ role อื่นจะโดน 403 แล้วสิทธิ์รายคนจะหายไปเป็น role default)
   */
  readonly allowedFeatures = computed(() => {
    const user = this.user();
    if (!user) {
      return [];
    }
    return resolveAllowedFeatures(user.allowed_features, user.role);
  });

  /** true เมื่อผู้ใช้ปัจจุบันเข้าถึงฟีเจอร์รหัสนี้ได้ */
  canAccessFeature(code: string): boolean {
    const role = this.role();
    if (!role) {
      return false;
    }
    return canAccessFeature(code, role, this.allowedFeatures());
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

  /** token เก่าที่ค้างใน localStorage แล้วหมดอายุไปแล้ว (เช่น ปิดแท็บทิ้งไว้ข้ามวัน) ถือว่าไม่มี
   * session — เคลียร์ทิ้งตั้งแต่ตอน init กัน guard เข้าใจผิดว่า login อยู่ทั้งที่ยิง request ไปก็ 401 */
  private readStoredToken(): string | null {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token && isTokenExpired(token)) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      return null;
    }
    return token;
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
