import { TestBed } from '@angular/core/testing';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { FinancialHealthStateService } from './financial-health-state.service';

describe('FinancialHealthStateService required filters', () => {
  let service: FinancialHealthStateService;
  let scopedRole = false;

  beforeEach(() => {
    scopedRole = false;
    TestBed.configureTestingModule({
      providers: [
        FinancialHealthStateService,
        { provide: ApiService, useValue: {} },
        { provide: AuthService, useValue: { isScopedRole: () => scopedRole } },
      ],
    });
    service = TestBed.inject(FinancialHealthStateService);
  });

  it('does not show data before an unscoped user selects both filters', () => {
    expect(service.selectedYear()).toBeNull();
    expect(service.hasSelectedYear()).toBe(false);
    expect(service.needsFilterSelection()).toBe(true);

    service.setSubdistrict(1);
    expect(service.needsFilterSelection()).toBe(true);

    service.setYear(2568);
    expect(service.needsFilterSelection()).toBe(false);
  });

  it('accepts the explicit all-years choice and requires selecting again after reset', () => {
    service.setSubdistrict(1);
    service.setYear(null);

    expect(service.selectedYear()).toBeNull();
    expect(service.hasSelectedYear()).toBe(true);
    expect(service.needsFilterSelection()).toBe(false);

    service.resetFilters();
    expect(service.hasSelectedYear()).toBe(false);
    expect(service.needsFilterSelection()).toBe(true);
  });

  it('uses the role-locked subdistrict and requires only a year choice', () => {
    scopedRole = true;

    expect(service.needsFilterSelection()).toBe(true);
    service.setYear(2567);
    expect(service.needsFilterSelection()).toBe(false);
  });
});
