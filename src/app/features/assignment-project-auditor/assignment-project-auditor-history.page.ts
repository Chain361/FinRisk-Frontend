import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import { Project, Subdistrict } from '../../core/models/domain.models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';
import { formatMoney, normalizeRiskLevel, subdistrictLabel } from '../../shared/utils/risk-utils';
import {
  ANALYSTS,
  ASSIGNMENT_STORAGE_KEY,
  Analyst,
  AssignmentPriority,
  SavedAssignment,
} from './assignment-project-auditor.models';

interface AssignmentHistoryRow {
  assignment: SavedAssignment;
  project: Project | null;
  analyst: Analyst | null;
  projectName: string;
  subdistrictName: string;
  assignedAtText: string;
  searchText: string;
}

type PriorityFilter = AssignmentPriority | 'all';

@Component({
  selector: 'app-assignment-project-auditor-history-page',
  standalone: true,
  imports: [FormsModule, EmptyStateComponent],
  template: `
    <section class="page-shell">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">F4.2</p>
          <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">ประวัติการมอบหมายงาน</h1>
          <p class="m-0 mt-1.5 text-sm text-muted">
            ตรวจสอบรายการมอบหมายโครงการให้ผู้ตรวจสอบ/นักวิเคราะห์ความเสี่ยงจากข้อมูลที่บันทึกไว้ในเครื่อง
          </p>
        </div>
        <button type="button" class="gov-btn-outline" (click)="reloadAssignments()">รีเฟรชประวัติ</button>
      </div>

      @if (error()) {
        <div class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high">
          {{ error() }}
        </div>
      }

      <div class="grid gap-4 md:grid-cols-3">
        <div class="panel p-4">
          <p class="m-0 text-xs font-bold text-muted">รายการมอบหมายทั้งหมด</p>
          <p class="m-0 mt-1 text-[26px] font-extrabold text-navy">{{ assignments().length }}</p>
        </div>
        <div class="panel p-4">
          <p class="m-0 text-xs font-bold text-muted">รายการเร่งด่วน</p>
          <p class="m-0 mt-1 text-[26px] font-extrabold text-risk-high">{{ highPriorityCount() }}</p>
        </div>
        <div class="panel p-4">
          <p class="m-0 text-xs font-bold text-muted">มอบหมายล่าสุด</p>
          <p class="m-0 mt-2 text-sm font-extrabold leading-6 text-ink">{{ latestAssignmentText() }}</p>
        </div>
      </div>

      <section class="panel overflow-hidden">
        <div class="border-b border-line-soft px-[18px] py-4">
          <div class="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 class="m-0 text-[17px] font-extrabold text-ink">รายการประวัติ</h2>
              <p class="m-0 mt-1 text-[13px] text-muted">ค้นหาโครงการ ผู้รับมอบหมาย หรือคำแนะนำที่เคยบันทึกไว้</p>
            </div>
            <span class="rounded-full bg-navy px-2.5 py-1 text-xs font-bold text-white">{{ filteredRows().length }} รายการ</span>
          </div>

          <div class="mt-3 grid gap-2 md:grid-cols-[1fr_180px_220px]">
            <label>
              <span class="sr-only">ค้นหาประวัติการมอบหมายงาน</span>
              <input
                class="gov-input"
                type="search"
                placeholder="ค้นหาโครงการ ผู้รับมอบหมาย หรือหมายเหตุ"
                [ngModel]="search()"
                (ngModelChange)="search.set($event)"
              />
            </label>
            <label>
              <span class="sr-only">กรองระดับความสำคัญ</span>
              <select class="gov-select" [ngModel]="priorityFilter()" (ngModelChange)="priorityFilter.set($event)">
                <option value="all">ทุกความสำคัญ</option>
                <option value="high">สูง - เร่งด่วน</option>
                <option value="normal">ปกติ</option>
                <option value="low">ต่ำ</option>
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
          <p class="px-[18px] py-8 text-center text-sm text-muted">กำลังโหลดประวัติการมอบหมายงาน...</p>
        } @else if (!filteredRows().length) {
          <div class="p-[18px]">
            <app-empty-state
              title="ยังไม่มีประวัติการมอบหมายงาน"
              message="เมื่อยืนยันการมอบหมายจากเมนู F4.1 รายการจะถูกบันทึกและแสดงในหน้านี้"
            />
          </div>
        } @else {
          <div class="overflow-x-auto">
            <table class="gov-table min-w-[1080px]">
              <thead>
                <tr>
                  <th>วันที่มอบหมาย</th>
                  <th>โครงการ</th>
                  <th>พื้นที่/ปีงบ</th>
                  <th>ผู้รับมอบหมาย</th>
                  <th>ความสำคัญ</th>
                  <th>ความเสี่ยง</th>
                  <th>คำแนะนำ</th>
                </tr>
              </thead>
              <tbody>
                @for (row of filteredRows(); track row.assignment.assignedAt + row.assignment.projectId + row.assignment.analystId) {
                  <tr>
                    <td class="align-top">
                      <p class="m-0 font-bold text-ink">{{ row.assignedAtText }}</p>
                      <p class="m-0 mt-1 text-xs text-muted">โดย {{ row.assignment.assignedBy || '-' }}</p>
                    </td>
                    <td class="align-top">
                      <p class="m-0 font-extrabold leading-6 text-ink">{{ row.projectName }}</p>
                      <p class="m-0 mt-1 text-xs text-muted">รหัสโครงการ {{ row.assignment.projectId }}</p>
                    </td>
                    <td class="align-top">
                      <p class="m-0 text-sm text-ink">{{ row.subdistrictName }}</p>
                      <p class="m-0 mt-1 text-xs text-muted">ปีงบประมาณ {{ row.project?.budget_year || '-' }}</p>
                    </td>
                    <td class="align-top">
                      <p class="m-0 font-bold text-ink">{{ row.analyst?.name || row.assignment.analystId }}</p>
                      <p class="m-0 mt-1 text-xs text-muted">{{ row.analyst?.team || '-' }}</p>
                    </td>
                    <td class="align-top">
                      <span class="rounded-full px-2.5 py-1 text-xs font-bold" [class]="priorityBadgeClass(row.assignment.priority)">
                        {{ priorityLabel(row.assignment.priority) }}
                      </span>
                    </td>
                    <td class="align-top">
                      <span class="rounded-full px-2.5 py-1 text-xs font-bold" [class]="riskBadgeClass(row.project)">
                        {{ riskLabel(row.project) }}
                      </span>
                      <p class="m-0 mt-2 text-xs text-muted">งบประมาณ {{ money(row.project?.budget_amount) }}</p>
                    </td>
                    <td class="align-top">
                      <p class="m-0 max-w-[280px] text-sm leading-6 text-ink">{{ row.assignment.note || '-' }}</p>
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
export class AssignmentProjectAuditorHistoryPageComponent implements OnInit {
  private readonly api = inject(ApiService);

  readonly analysts = ANALYSTS;
  readonly loading = signal(true);
  readonly error = signal('');
  readonly assignments = signal<SavedAssignment[]>([]);
  readonly projects = signal<Project[]>([]);
  readonly subdistricts = signal<Subdistrict[]>([]);
  readonly search = signal('');
  readonly priorityFilter = signal<PriorityFilter>('all');
  readonly analystFilter = signal('all');

  readonly historyRows = computed<AssignmentHistoryRow[]>(() =>
    this.assignments()
      .map((assignment) => this.toHistoryRow(assignment))
      .sort((a, b) => this.dateValue(b.assignment.assignedAt) - this.dateValue(a.assignment.assignedAt)),
  );

  readonly filteredRows = computed(() => {
    const search = this.search().trim().toLocaleLowerCase('th');
    const priority = this.priorityFilter();
    const analystId = this.analystFilter();
    return this.historyRows().filter(
      (row) =>
        (!search || row.searchText.includes(search)) &&
        (priority === 'all' || row.assignment.priority === priority) &&
        (analystId === 'all' || row.assignment.analystId === analystId),
    );
  });

  readonly highPriorityCount = computed(
    () => this.assignments().filter((assignment) => assignment.priority === 'high').length,
  );

  readonly latestAssignmentText = computed(() => this.historyRows()[0]?.assignedAtText ?? '-');

  ngOnInit(): void {
    this.reloadAssignments();
    forkJoin({
      projects: this.api.projects().pipe(catchError(() => of<Project[]>([]))),
      subdistricts: this.api.subdistricts().pipe(catchError(() => of<Subdistrict[]>([]))),
    }).subscribe({
      next: ({ projects, subdistricts }) => {
        this.projects.set(projects);
        this.subdistricts.set(subdistricts);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('โหลดข้อมูลประกอบประวัติการมอบหมายงานไม่สำเร็จ');
        this.loading.set(false);
      },
    });
  }

  reloadAssignments(): void {
    this.assignments.set(this.readAssignments());
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

  priorityBadgeClass(priority: AssignmentPriority): string {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-risk-high';
      case 'normal':
        return 'bg-blue-100 text-navy';
      case 'low':
        return 'bg-green-100 text-risk-low';
    }
  }

  riskLabel(project: Project | null): string {
    const risk = normalizeRiskLevel(project?.risk_level);
    return risk === 'high'
      ? 'ความเสี่ยงสูง'
      : risk === 'medium'
        ? 'ความเสี่ยงปานกลาง'
        : risk === 'low'
          ? 'ความเสี่ยงต่ำ'
          : 'ไม่ระบุระดับ';
  }

  riskBadgeClass(project: Project | null): string {
    const risk = normalizeRiskLevel(project?.risk_level);
    return risk === 'high'
      ? 'bg-red-100 text-risk-high'
      : risk === 'medium'
        ? 'bg-orange-100 text-risk-medium'
        : risk === 'low'
          ? 'bg-green-100 text-risk-low'
          : 'bg-slate-100 text-slate-600';
  }

  money(value: number | string | null | undefined): string {
    return value === null || value === undefined ? '-' : formatMoney(value);
  }

  private toHistoryRow(assignment: SavedAssignment): AssignmentHistoryRow {
    const project = this.projects().find((item) => String(item.project_id) === assignment.projectId) ?? null;
    const analyst = ANALYSTS.find((item) => item.id === assignment.analystId) ?? null;
    const subdistrictName = project
      ? subdistrictLabel(this.subdistricts().find((item) => item.subdistrict_id === project.subdistrict_id))
      : '-';
    const projectName = project?.project_name || 'ไม่พบข้อมูลโครงการ';
    const assignedAtText = this.formatAssignedAt(assignment.assignedAt);
    const searchText = [
      projectName,
      assignment.projectId,
      subdistrictName,
      analyst?.name,
      analyst?.team,
      assignment.analystId,
      assignment.note,
      assignment.assignedBy,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase('th');

    return {
      assignment,
      project,
      analyst,
      projectName,
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

  private readAssignments(): SavedAssignment[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(ASSIGNMENT_STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? (parsed as SavedAssignment[]) : [];
    } catch {
      return [];
    }
  }
}
