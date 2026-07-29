import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';
import { PUBLIC_EXPORT_ROLES } from './roles';

const EXPORT_FEATURE = 'public_projects_export';

export const exportAccessGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  return auth.hasRole(...PUBLIC_EXPORT_ROLES) || auth.canAccessFeature(EXPORT_FEATURE)
    ? true
    : router.createUrlTree(['/project-risk']);
};