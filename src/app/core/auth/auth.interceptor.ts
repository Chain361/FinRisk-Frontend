import { HttpInterceptorFn } from '@angular/common/http';

const TOKEN_KEY = 'finrisk_token';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || request.url.endsWith('/auth/login')) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};

export { TOKEN_KEY };
