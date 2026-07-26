import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { TOKEN_KEY, USER_KEY } from './auth.constants';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);
  const isLoginRequest = request.url.endsWith('/auth/login');
  const token = localStorage.getItem(TOKEN_KEY);

  const authorizedRequest =
    !token || isLoginRequest
      ? request
      : request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });

  return next(authorizedRequest).pipe(
    catchError((error: unknown) => {
      // token หมดอายุ/ไม่ถูกต้อง — เคลียร์ session แล้วพากลับหน้า login แทนที่จะปล่อยให้หน้าค้าง 401 เงียบๆ
      // ยกเว้น request ที่เป็น /auth/login เอง (รหัสผ่านผิด ต้องโชว์เป็น error บนฟอร์ม ไม่ใช่ redirect)
      if (error instanceof HttpErrorResponse && error.status === 401 && !isLoginRequest) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
