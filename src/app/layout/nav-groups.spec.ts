import { ALL_FEATURE_ITEMS } from '../core/auth/features';
import { NAV_GROUPS } from './nav-groups';
import { describe, it, expect } from 'vitest';

describe('NAV_GROUPS', () => {
  it('derives exactly the same feature codes, in the same order, as FEATURE_GROUPS', () => {
    const navCodes = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.code));
    const featureCodes = ALL_FEATURE_ITEMS.map((item) => item.code);
    expect(navCodes).toEqual(featureCodes);
  });

  it('carries the same roles restriction as the matching FEATURE_GROUPS item', () => {
    const featureRolesByCode = new Map(
      ALL_FEATURE_ITEMS.map((item) => [item.code, item.roles]),
    );
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        expect(item.roles).toEqual(featureRolesByCode.get(item.code));
      }
    }
  });

  it('gives every top-level nav item a non-empty path', () => {
    for (const group of NAV_GROUPS) {
      for (const item of group.items) {
        expect(item.path).toBeTruthy();
      }
    }
  });
});
