import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, of, tap } from 'rxjs';

import { ApiService } from '../api/api.service';
import { ManagedUser, ManagedUserPatch, UserStatus } from '../models/domain.models';

// re-export เพื่อไม่ให้ import path เดิม (`../../core/auth/user-directory.service`) ในหน้าอื่นต้องแก้
export type { ManagedUser, ManagedUserPatch, UserStatus };

/**
 * แหล่งข้อมูลผู้ใช้ทั้งหมด + สิทธิ์เข้าถึงฟีเจอร์ของแต่ละคน — ใช้โดยหน้าจัดการผู้ใช้งาน (admin เท่านั้น)
 *
 * หมายเหตุ: ไม่ใช้ที่นี่เพื่อดูสิทธิ์ของผู้ใช้ที่ login อยู่ปัจจุบัน — GET /users ต้องเป็น admin เท่านั้น
 * (role อื่นจะโดน 403) ผู้ใช้แต่ละคนดูสิทธิ์ตัวเองได้ตรงๆ จาก AuthService.user().allowed_features
 * ที่ /auth/login และ /auth/me ส่งมาให้อยู่แล้ว ไม่ต้องพึ่ง service นี้
 *
 * Backend (GET/PUT /users) เป็นแหล่งข้อมูลเดียว (single source of truth) — ไม่มี mock/localStorage
 * ใดๆ ที่นี่ ถ้า backend ไม่ตอบ signal จะว่างเปล่าแทนที่จะ fallback ไปข้อมูลปลอม
 */
@Injectable({ providedIn: 'root' })
export class UserDirectoryService {
  private readonly api = inject(ApiService);

  readonly users = signal<ManagedUser[]>([]);

  constructor() {
    this.loadUsers().subscribe();
  }

  /** โหลดรายชื่อผู้ใช้ + สิทธิ์ฟีเจอร์ล่าสุดจาก backend แล้วอัปเดต signal ทันทีที่โหลดสำเร็จ */
  loadUsers(): Observable<ManagedUser[]> {
    return this.api.getUsers().pipe(
      tap((users) => this.users.set(users)),
      catchError((error) => {
        console.error('[UserDirectoryService] โหลดรายชื่อผู้ใช้จาก backend ไม่สำเร็จ', error);
        this.users.set([]);
        return of([]);
      }),
    );
  }

  /** บันทึกการแก้ไขไปที่ backend (PUT /users/{user_id}) แล้วอัปเดต signal ด้วยข้อมูลล่าสุดที่ backend ตอบกลับ */
  updateUser(userId: number, patch: ManagedUserPatch): Observable<ManagedUser> {
    return this.api.updateUser(userId, patch).pipe(
      tap((updated) => {
        this.users.update((list) => list.map((u) => (u.user_id === userId ? updated : u)));
      }),
    );
  }
}
