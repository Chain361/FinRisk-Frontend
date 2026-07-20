import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

/**
 * Guard จำกัด route ตาม role (ตาม roles.md)
 * ใช้: `canActivate: [roleGuard('project_auditor', 'admin')]`
 *
 * หมายเหตุ: หน้า dashboard ปัจจุบัน (F1/F2/F3) ทุก role ดูได้ จึงยังไม่ผูก guard นี้กับ route ใด —
 * เตรียมไว้สำหรับหน้าที่จำกัดสิทธิ์ในอนาคต เช่น หน้ามอบหมายงานตรวจสอบ (audit)
 * ฝั่ง backend บังคับสิทธิ์ซ้ำอีกชั้นเสมอด้วย require_roles(...) — guard นี้เป็นแค่ UX layer
 */
export const roleGuard =
  (...allowed: string[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }
    return auth.hasRole(...allowed) ? true : router.createUrlTree(['/']);
  };
