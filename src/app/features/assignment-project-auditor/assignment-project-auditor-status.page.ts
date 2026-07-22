import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { Project, Subdistrict } from '../../core/models/domain.models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { normalizeRiskLevel, subdistrictLabel } from '../../shared/utils/risk-utils';
import {
  ANALYSTS,
  ASSIGNMENT_STORAGE_KEY,
  Analyst,
  AssignmentPriority,
  SavedAssignment,
} from './assignment-project-auditor.models';

type AssignmentStatusFilter = 'all' | 'assigned' | 'unassigned';
type RiskFilter = 'all' | 'high' | 'medium' | 'low';

interface ProjectStatusRow {
  project: Project;
  latestAssignment: SavedAssignment | null;
  analyst: Analyst | null;
  subdistrictName: string;
  assignedAtText: string;
  searchText: string;
}

@Component({
  selector: 'app-assignment-project-auditor-status-page',
  standalone: true,
  imports: [FormsModule, RouterLink, EmptyStateComponent],
  template: `
    <section class="page-shell">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F4.3</p>
          <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">สถานะโครงการ</h1>
          <p class="m-0 mt-1.5 text-sm text-muted">
            ติดตามสถานะการมอบหมายงานของแต่ละโครงการ พร้อมผู้รับมอบหมายล่าสุดและระดับความเสี่ยง
          </p>
        </div>
        <button type="button" class="gov-btn-outline" (click)="reloadAssignments()">รีเฟรชสถานะ</button>
      </div>

      @if (error()) {
        <div class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high">
          {{ error() }}
        </div>
      }

      <div class="grid gap-4 md:grid-cols-4">
        <div class="panel p-4">
          <p class="m-0 text-xs font-bold text-muted">โครงการทั้งหมด</p>
          <p class="m-0 mt-1 text-[26px] font-extrabold text-navy">{{ projectRows().length }}</p>
        </div>
        <div class="panel p-4">
          <p class="m-0 text-xs font-bold text-muted">มอบหมายแล้ว</p>
          <p class="m-0 mt-1 text-[26px] font-extrabold text-risk-low">{{ assignedCount() }}</p>
        </div>
        <div class="panel p-4">
          <p class="m-0 text-xs font-bold text-muted">ยังไม่มอบหมาย</p>
          <p class="m-0 mt-1 text-[26px] font-extrabold text-risk-medium">{{ unassignedCount() }}</p>
        </div>
        <div class="panel p-4">
          <p class="m-0 text-xs font-bold text-muted">เสี่ยงสูงที่ยังไม่มอบหมาย</p>
          <p class="m-0 mt-1 text-[26px] font-extrabold text-risk-high">{{ highRiskUnassignedCount() }}</p>
        </div>
      </div>

      <section class="panel overflow-hidden">
        <div class="border-b border-line-soft px-[18px] py-4">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 class="m-0 text-[17px] font-extrabold text-ink">รายการสถานะโครงการ</h2>
              <p class="m-0 mt-1 text-[13px] text-muted">กรองโครงการตามสถานะการมอบหมาย ผู้รับผิดชอบ และระดับความเสี่ยง</p>
            </div>
            <span class="rounded-full bg-navy px-2.5 py-1 text-xs font-bold text-white">{{ filteredRows().length }} โครงการ</span>
          </div>

          <div class="mt-3 grid gap-2 xl:grid-cols-[1fr_170px_170px_220px]">
            <label>
              <span class="sr-only">ค้นหาสถานะโครงการ</span>
              <input
                class="gov-input"
                type="search"
                placeholder="ค้นหาโครงการ พื้นที่ ผู้รับมอบหมาย หรือสถานะ"
                [ngModel]="search()"
                (ngModelChange)="search.set($event)"
              />
            </label>
            <label>
              <span class="sr-only">กรองสถานะการมอบหมาย</span>
              <select class="gov-select" [ngModel]="assignmentStatusFilter()" (ngModelChange)="assignmentStatusFilter.set($event)">
                <option value="all">ทุกสถานะงาน</option>
                <option value="assigned">มอบหมายแล้ว</option>
                <option value="unassigned">ยังไม่มอบหมาย</option>
              </select>
            </label>
            <label>
              <span class="sr-only">กรองระดับความเสี่ยง</span>
              <select class="gov-select" [ngModel]="riskFilter()" (ngModelChange)="riskFilter.set($event)">
                <option value="all">ทุกระดับความเสี่ยง</option>
                <option value="high">ความเสี่ยงสูง</option>
                <option value="medium">ความเสี่ยงปานกลาง</option>
                <option value="low">ความเสี่ยงต่ำ</option>
              </select>
            </label>
            <label>
              <span class="sr-only">กรองผู้รับมอบหมาย</span>
              <select class="gov-select" [ngModel]="analystFilter()" (ngModelChange)="analystFilter.set($event)">
                <option value="all">ทุกผู้รับมอบหมาย</option>
                @for (analyst of analysts; track analyst.id) {
                  <option [value]="analyst.id">{{ analyst.name }}</option>
                }
              </select>
            </label>
          </div>
        </div>

        @if (loading()) {
          <p class="px-[18px] py-8 text-center text-sm text-muted">กำลังโหลดสถานะโครงการ...</p>
        } @else if (!filteredRows().length) {
          <div class="p-[18px]">
            <app-empty-state
              title="ไม่พบสถานะโครงการ"
              message="ลองปรับคำค้นหาหรือตัวกรองสถานะการมอบหมาย"
            />
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="gov-table min-w-[980px]">
              <thead>
                <tr>
                  <th>สถานะงาน</th>
                  <th>โครงการ</th>
                  <th>ผู้รับมอบหมายล่าสุด</th>
                  <th>สถานะโครงการ</th>
                  <th>ความเสี่ยง</th>
                  <th>มอบหมายล่าสุด</th>
                </tr>
              </thead>
              <tbody>
                @for (row of filteredRows(); track row.project.project_id) {
                  <tr>
                    <td class="align-top">
                      <span class="rounded-full px-2.5 py-1 text-xs font-bold" [class]="row.latestAssignment ? 'bg-green-100 text-risk-low' : 'bg-orange-100 text-risk-medium'">
                        {{ row.latestAssignment ? 'มอบหมายแล้ว' : 'ยังไม่มอบหมาย' }}
                      </span>
                    </td>
                    <td class="align-top">
                      <a
                        routerLink="/risk-factors"
                        [queryParams]="{ projectId: row.project.project_id }"
                        class="font-extrabold leading-6 text-ink no-underline hover:text-navy hover:underline"
                      >
                        {{ row.project.project_name || 'ไม่ระบุชื่อโครงการ' }}
                      </a>
                      <div class="mt-2 flex flex-wrap gap-1.5">
                        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{{ row.subdistrictName }}</span>
                        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">ปีงบ {{ row.project.budget_year || '-' }}</span>
                        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">รหัส {{ row.project.project_id }}</span>
                        @if (row.project.project_type) {
                          <span class="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-navy">{{ row.project.project_type }}</span>
                        }
                      </div>
                    </td>
                    <td class="align-top">
                      <p class="m-0 font-bold text-ink">{{ row.analyst?.name || '-' }}</p>
                      <p class="m-0 mt-1 text-xs text-muted">{{ row.analyst?.team || 'ยังไม่มีผู้รับผิดชอบ' }}</p>
                    </td>
                    <td class="align-top">
                      <p class="m-0 text-sm font-bold text-ink">{{ projectStatusLabel(row.project) }}</p>
                    </td>
                    <td class="align-top">
                      <span class="rounded-full px-2.5 py-1 text-xs font-bold" [class]="riskBadgeClass(row.project)">
                        {{ riskLabel(row.project) }}
                      </span>
                      <p class="m-0 mt-2 text-xs text-muted">คะแนน {{ row.project.risk_score ?? '-' }}</p>
                    </td>
                    <td class="align-top">
                      <p class="m-0 text-sm text-ink">{{ row.assignedAtText }}</p>
                      @if (row.latestAssignment?.priority) {
                        <p class="m-0 mt-1 text-xs font-bold text-muted">{{ priorityLabel(row.latestAssignment!.priority) }}</p>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </section>
    </section>
  `,
})
export class AssignmentProjectAuditorStatusPageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly analysts = ANALYSTS;
  readonly loading = signal(true);
  readonly error = signal('');
  readonly projects = signal<Project[]>([]);
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly assignments = signal<SavedAssignment[]>([]);
  readonly search = signal('');
  readonly assignmentStatusFilter = signal<AssignmentStatusFilter>('all');
  readonly riskFilter = signal<RiskFilter>('all');
  readonly analystFilter = signal('all');

  readonly latestAssignmentsByProject = computed(() => {
    const map = new Map<string, SavedAssignment>();
    this.assignments()
      .slice()
      .sort((a, b) => this.dateValue(b.assignedAt) - this.dateValue(a.assignedAt))
      .forEach((assignment) => {
        if (!map.has(assignment.projectId)) {
          map.set(assignment.projectId, assignment);
        }
      });
    return map;
  });

  readonly projectRows = computed<ProjectStatusRow[]>(() =>
    this.projects()
      .map((project) => this.toProjectStatusRow(project))
      .sort(
        (a, b) =>
          Number(Boolean(a.latestAssignment)) - Number(Boolean(b.latestAssignment)) ||
          this.riskRank(b.project) - this.riskRank(a.project),
      ),
  );

  readonly filteredRows = computed(() => {
    const search = this.search().trim().toLocaleLowerCase('th');
    const assignmentStatus = this.assignmentStatusFilter();
    const risk = this.riskFilter();
    const analystId = this.analystFilter();
    return this.projectRows().filter(
      (row) =>
        (!search || row.searchText.includes(search)) &&
        (assignmentStatus === 'all' ||
          (assignmentStatus === 'assigned' && row.latestAssignment) ||
          (assignmentStatus === 'unassigned' && !row.latestAssignment)) &&
        (risk === 'all' || normalizeRiskLevel(row.project.risk_level) === risk) &&
        (analystId === 'all' || row.latestAssignment?.analystId === analystId),
    );
  });

  readonly assignedCount = computed(
    () => this.projectRows().filter((row) => row.latestAssignment).length,
  );
  readonly unassignedCount = computed(() => this.projectRows().length - this.assignedCount());
  readonly highRiskUnassignedCount = computed(
    () =>
      this.projectRows().filter(
        (row) => !row.latestAssignment && normalizeRiskLevel(row.project.risk_level) === 'high',
      ).length,
  );

  ngOnInit(): void {
    this.applyRouteSearch();
    this.reloadAssignments();
    forkJoin({
      projects: this.api.projects().pipe(catchError(() => of<Project[]>([]))),
      subdistricts: this.api.subdistricts().pipe(catchError(() => of<Subdistrict[]>([]))),
    }).subscribe({
      next: ({ projects, subdistricts }) => {
        this.projects.set(projects);
        this.subdistricts.set(subdistricts);
        this.loading.set(false);
        if (!projects.length) {
          this.error.set('ไม่สามารถโหลดรายการโครงการได้ กรุณาตรวจสอบการเชื่อมต่อ FinRisk Backend');
        }
      },
      error: () => {
        this.error.set('โหลดสถานะโครงการไม่สำเร็จ');
        this.loading.set(false);
      },
    });
  }

  reloadAssignments(): void {
    this.assignments.set(this.readAssignments());
  }

  private applyRouteSearch(): void {
    const projectId = this.route.snapshot.queryParamMap.get('projectId');
    if (projectId) {
      this.search.set(projectId);
    }
  }

  projectStatusLabel(project: Project): string {
    const status = project.project_status ?? project.status;
    return status ? String(status) : '-';
  }

  priorityLabel(priority: AssignmentPriority): string {
    switch (priority) {
      case 'high':
        return 'สูง - เร่งด่วน';
      case 'normal':
        return 'ปกติ';
      case 'low':
        return 'ต่ำ';
    }
  }

  riskLabel(project: Project): string {
    const risk = normalizeRiskLevel(project.risk_level);
    return risk === 'high'
      ? 'ความเสี่ยงสูง'
      : risk === 'medium'
        ? 'ความเสี่ยงปานกลาง'
        : risk === 'low'
          ? 'ความเสี่ยงต่ำ'
          : 'ไม่ระบุระดับ';
  }

  riskBadgeClass(project: Project): string {
    const risk = normalizeRiskLevel(project.risk_level);
    return risk === 'high'
      ? 'bg-red-100 text-risk-high'
      : risk === 'medium'
        ? 'bg-orange-100 text-risk-medium'
        : risk === 'low'
          ? 'bg-green-100 text-risk-low'
          : 'bg-slate-100 text-slate-600';
  }

  private toProjectStatusRow(project: Project): ProjectStatusRow {
    const projectId = String(project.project_id);
    const latestAssignment = this.latestAssignmentsByProject().get(projectId) ?? null;
    const analyst = latestAssignment
      ? ANALYSTS.find((item) => item.id === latestAssignment.analystId) ?? null
      : null;
    const subdistrictName = subdistrictLabel(
      this.subdistricts().find((item) => item.subdistrict_id === project.subdistrict_id),
    );
    const assignedAtText = latestAssignment ? this.formatAssignedAt(latestAssignment.assignedAt) : '-';
    const searchText = [
      project.project_name,
      project.project_id,
      project.dept_name,
      project.project_type,
      this.projectStatusLabel(project),
      subdistrictName,
      analyst?.name,
      analyst?.team,
      latestAssignment?.note,
      latestAssignment?.assignedBy,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('th');

    return {
      project,
      latestAssignment,
      analyst,
      subdistrictName,
      assignedAtText,
      searchText,
    };
  }

  private formatAssignedAt(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '-'
      : new Intl.DateTimeFormat('th-TH', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(date);
  }

  private dateValue(value: string): number {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private riskRank(project: Project): number {
    const risk = normalizeRiskLevel(project.risk_level);
    return risk === 'high' ? 3 : risk === 'medium' ? 2 : risk === 'low' ? 1 : 0;
  }

  private readAssignments(): SavedAssignment[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(ASSIGNMENT_STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? (parsed as SavedAssignment[]) : [];
    } catch {
      return [];
    }
  }
}
