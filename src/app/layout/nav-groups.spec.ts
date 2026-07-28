import { ALL_FEATURE_ITEMS } from '../core/auth/features';
import { FOOTER_ONLY_FEATURE_CODES, NAV_GROUPS } from './nav-groups';
import { describe, it, expect } from 'vitest';

describe('NAV_GROUPS', () => {
  it('derives the sidebar feature codes, excluding links that live in the footer', () => {
    const navCodes = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.code));
    const featureCodes = ALL_FEATURE_ITEMS.map((item) => item.code).filter(
      (code) => !FOOTER_ONLY_FEATURE_CODES.has(code),
    );
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
