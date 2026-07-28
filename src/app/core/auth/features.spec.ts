import { ALL_FEATURE_ITEMS, defaultFeaturesForRole, resolveAllowedFeatures } from './features';
import { describe, it, expect } from 'vitest';

describe('resolveAllowedFeatures', () => {
  it('falls back to the role default when the backend omits the field entirely', () => {
    const admin = defaultFeaturesForRole('admin');
    expect(resolveAllowedFeatures(undefined, 'admin')).toEqual(admin);
  });

  it('keeps an explicit empty array — an admin revoking all features must stick', () => {
    expect(resolveAllowedFeatures([], 'admin')).toEqual([]);
  });

  it('keeps an explicit non-empty array as-is, even if it differs from the role default', () => {
    expect(resolveAllowedFeatures(['risk_dashboard'], 'admin')).toEqual(['risk_dashboard']);
  });
});

describe('defaultFeaturesForRole', () => {
  it('includes role-less items for every role', () => {
    const publicUserFeatures = defaultFeaturesForRole('public_user');
    expect(publicUserFeatures).toContain('public_audit_info');
    expect(publicUserFeatures).toContain('contact_report');
  });

  it('excludes items restricted to other roles', () => {
    expect(defaultFeaturesForRole('public_user')).not.toContain('user_management');
    expect(defaultFeaturesForRole('risk_analyst')).not.toContain('user_management');
  });

  it('includes admin-only items for admin', () => {
    expect(defaultFeaturesForRole('admin')).toContain('user_management');
  });

  it('never returns duplicate feature codes', () => {
    const codes = defaultFeaturesForRole('admin');
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('ALL_FEATURE_ITEMS', () => {
  it('has no duplicate feature codes across groups', () => {
    const codes = ALL_FEATURE_ITEMS.map((item) => item.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
