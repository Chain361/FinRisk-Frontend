import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';

import { ApiService } from '../api/api.service';
import { AppUser, LoginResponse } from '../models/domain.models';
import { TOKEN_KEY } from './x-username.interceptor';

const USER_KEY = 'finrisk_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly user = signal<AppUser | null>(this.restoreUser());
  readonly isAuthenticated = computed(() => Boolean(this.token()));

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
