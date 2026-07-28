import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ApiService } from '../../../core/api/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ProjectFilters } from '../../../core/models/domain.models';
import { OverviewPageComponent } from './overview.page';

describe('OverviewPageComponent fiscal-year filter', () => {
  let fixture: ComponentFixture<OverviewPageComponent>;
  let component: OverviewPageComponent;
  const api = {
    projects: vi.fn((_filters: ProjectFilters) => of([])),
    riskSummary: vi.fn(() => of({ total: 0, by_level: {} })),
    subdistricts: vi.fn(() => of([])),
  };

  beforeEach(() => {
    api.projects.mockClear();
    api.riskSummary.mockClear();
    api.subdistricts.mockClear();

    TestBed.configureTestingModule({
      imports: [OverviewPageComponent],
      providers: [
        { provide: ApiService, useValue: api },
        {
          provide: AuthService,
          useValue: { isScopedRole: () => true, user: () => ({ subdistrict_id: 1 }) },
        },
      ],
    });

    fixture = TestBed.createComponent(OverviewPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads all years initially, then returns to all years after changing the year filter', () => {
    expect(component.selectedYear()).toBeNull();
    expect(api.projects).toHaveBeenNthCalledWith(1, {
      budget_year: null,
      subdistrict_id: null,
      risk_level: null,
    });

    component.setYear(2567);
    expect(api.projects).toHaveBeenLastCalledWith({
      budget_year: 2567,
      subdistrict_id: null,
      risk_level: null,
    });

    component.setYear(null);
    expect(api.projects).toHaveBeenLastCalledWith({
      budget_year: null,
      subdistrict_id: null,
      risk_level: null,
    });
  });

  it('resets the year filter to all years', () => {
    component.setYear(2566);
    const requestsBeforeReset = api.projects.mock.calls.length;
    component.resetFilters();

    expect(component.selectedYear()).toBeNull();
    expect(api.projects.mock.calls[requestsBeforeReset][0]).toEqual({
      budget_year: null,
      subdistrict_id: null,
      risk_level: null,
    });
  });
});
