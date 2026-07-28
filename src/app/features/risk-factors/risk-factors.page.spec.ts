import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  AuditAssignment,
  Project,
  ProjectFilters,
  RiskFactorCatalog,
  Subdistrict,
} from '../../core/models/domain.models';
import { RiskFactorsPageComponent } from './risk-factors.page';

describe('RiskFactorsPageComponent fiscal-year filter', () => {
  let fixture: ComponentFixture<RiskFactorsPageComponent>;
  let component: RiskFactorsPageComponent;
  const api = {
    projects: vi.fn((_filters?: ProjectFilters) => of<Project[]>([])),
    subdistricts: vi.fn(() => of<Subdistrict[]>([])),
    riskFactors: vi.fn(() => of<RiskFactorCatalog[]>([])),
    assignments: vi.fn(() => of<AuditAssignment[]>([])),
  };

  beforeEach(() => {
    Object.values(api).forEach((method) => method.mockClear());

    TestBed.configureTestingModule({
      imports: [RiskFactorsPageComponent],
      providers: [
        { provide: ApiService, useValue: api },
        {
          provide: AuthService,
          useValue: {
            hasRole: () => false,
            isScopedRole: () => false,
            user: () => null,
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({}) } },
        },
        { provide: Router, useValue: { navigate: vi.fn(), navigateByUrl: vi.fn() } },
      ],
    });

    fixture = TestBed.createComponent(RiskFactorsPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads all years initially, then returns to all years after changing the year filter', () => {
    const subdistrictSelect = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(subdistrictSelect.options[0].text).toBe('ทุกตำบลที่มีสิทธิ์');
    expect(subdistrictSelect.options[0].disabled).toBe(false);

    expect(component.selectedYear()).toBeNull();
    expect(api.projects.mock.calls.find(([filters]) => filters !== undefined)?.[0]).toEqual({
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
    component.resetFilters();

    expect(component.selectedYear()).toBeNull();
    expect(api.projects).toHaveBeenLastCalledWith({
      budget_year: null,
      subdistrict_id: null,
      risk_level: null,
    });
  });
});
