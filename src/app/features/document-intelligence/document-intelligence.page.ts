/**
 * DocumentIntelligencePageComponent
 *
 * หน้าดูผล OCR และ checklist เอกสารประกอบโครงการ (issue #35, คู่กับ backend #20)
 * อ่านอย่างเดียว — backend ยังไม่มี endpoint สำหรับอัปโหลดไฟล์จริง (มีแค่ GET 3 ตัว:
 * /documents/types, /projects/{id}/documents, /projects/{id}/documents/search)
 */

import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiService } from '../../core/api/api.service';
import {
  DocumentType,
  MissingDocType,
  ProjectDocument,
  ProjectDocumentsView,
  ProjectDocumentStatus,
} from '../../core/models/domain.models';
import { EmptyStateComponent } from '../../shared/ui/empty-state.component';

interface ChecklistRow {
  doc_type_code: string;
  name_th: string;
  document: ProjectDocument | null;
  missing: MissingDocType | null;
}

const STATUS_LABEL: Record<ProjectDocumentStatus, string> = {
  present: 'มีเอกสารแล้ว',
  missing: 'ขาดเอกสาร',
  pending_review: 'รอตรวจสอบ',
};

const STATUS_BADGE_CLASS: Record<ProjectDocumentStatus, string> = {
  present: 'bg-risk-low text-white',
  missing: 'bg-risk-high text-white',
  pending_review: 'bg-risk-medium text-white',
};

const MISSING_REASON_LABEL: Record<MissingDocType['reason'], string> = {
  no_record: 'ยังไม่เคยบันทึกข้อมูล',
  missing: 'ขาดเอกสาร',
  pending_review: 'รอตรวจสอบ',
};

const SEVERITY_LABEL: Record<string, string> = {
  high: 'ความเสี่ยงสูง',
  medium: 'ความเสี่ยงปานกลาง',
  low: 'ความเสี่ยงต่ำ',
};

const SEVERITY_BADGE_CLASS: Record<string, string> = {
  high: 'bg-risk-high text-white',
  medium: 'bg-risk-medium text-white',
  low: 'bg-risk-low text-white',
};

@Component({
  selector: 'app-document-intelligence-page',
  standalone: true,
  imports: [RouterLink, EmptyStateComponent],
  template: `
    <section class="page-shell">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="m-0 text-[13px] font-extrabold tracking-wide text-navy">Document Intelligence</p>
          <h1 class="m-0 mt-1 text-[26px] font-extrabold text-ink">
            เอกสารประกอบโครงการ
          </h1>
          <p class="m-0 mt-1.5 text-sm text-muted">
            checklist เอกสารตามระเบียบพัสดุ + ผล OCR/findings ของโครงการ
          </p>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="gov-btn-outline inline-flex items-center justify-center"
            (click)="reloadData()"
          >
            รีเฟรชข้อมูล
          </button>
          <a
            routerLink="/risk-factors"
            class="gov-btn-outline inline-flex items-center justify-center text-center no-underline"
          >
            กลับหน้าโครงการทั้งหมด
          </a>
        </div>
      </div>

      @if (error()) {
        <div
          class="rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-4 py-3 text-sm text-risk-high"
        >
          {{ error() }}
        </div>
      }

      @if (loading()) {
        <p class="px-[18px] py-8 text-center text-sm text-muted">กำลังโหลดข้อมูลเอกสาร...</p>
      } @else if (!view()) {
        <div class="p-[18px]">
          <app-empty-state
            title="ไม่พบข้อมูลโครงการ"
            message="โครงการนี้อาจถูกลบหรือคุณไม่มีสิทธิ์เข้าถึง"
          />
        </div>
      } @else {
        <section class="panel p-[18px]">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 class="m-0 text-[17px] font-extrabold text-ink">
                {{ view()!.project_name || 'ไม่ระบุชื่อโครงการ' }}
              </h2>
              <p class="m-0 mt-1 text-[13px] text-muted">
                รหัส {{ view()!.project_id }}
                @if (view()!.project_type) {
                  · {{ view()!.project_type }}
                }
              </p>
            </div>
            <span class="rounded-full bg-zebra px-3 py-1.5 text-xs font-bold text-slate-700">
              พบ finding {{ view()!.findings_count }} รายการ
            </span>
          </div>

          @if (view()!.data_quality_note) {
            <div
              class="mt-3 rounded-[3px] border border-line-soft bg-[#fbfcfd] px-3 py-2 text-[11.5px] text-muted"
            >
              <p class="m-0">
                <span class="font-bold text-[#8a2a1f]">ข้อจำกัดข้อมูล:</span>
                {{ view()!.data_quality_note }}
              </p>
            </div>
          }
        </section>

        @if (!view()!.has_document_data) {
          <app-empty-state
            title="ยังไม่เคยบันทึกข้อมูลเอกสารของโครงการนี้"
            message="ไม่ได้หมายความว่าเอกสารขาด — แค่ยังไม่มีใครบันทึก/สแกนเอกสารของโครงการนี้เข้าระบบ"
          />
        } @else {
          <!-- Checklist เอกสารตามระเบียบพัสดุ -->
          <section class="panel p-[18px]">
            <h2 class="m-0 mb-3 text-[16px] font-bold text-ink">
              Checklist เอกสารที่ต้องมี ({{ checklist().length }} ประเภท)
            </h2>
            @if (!checklist().length) {
              <p class="text-sm text-muted">โครงการนี้ไม่มีเอกสารบังคับตามประเภทโครงการ</p>
            } @else {
              <div class="overflow-x-auto">
                <table class="gov-table">
                  <thead>
                    <tr>
                      <th scope="col">ประเภทเอกสาร</th>
                      <th scope="col">สถานะ</th>
                      <th scope="col">เลขที่/วันที่เอกสาร</th>
                      <th scope="col">ที่มา</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (row of checklist(); track row.doc_type_code) {
                      <tr>
                        <td class="font-bold">{{ row.doc_type_code }} — {{ row.name_th }}</td>
                        <td>
                          <span
                            class="inline-flex items-center rounded-[3px] px-2.5 py-1 text-[11.5px] font-bold"
                            [class]="checklistBadgeClass(row)"
                          >
                            {{ checklistStatusText(row) }}
                          </span>
                        </td>
                        <td class="text-[12.5px] text-muted">
                          {{ row.document?.doc_no || row.document?.doc_date || '—' }}
                        </td>
                        <td class="text-[12.5px] text-muted">
                          {{ row.document?.source ? sourceLabel(row.document!.source) : '—' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>

          <!-- รายละเอียดเอกสารแต่ละฉบับ + ผล OCR/findings -->
          @if (view()!.documents.length) {
            <section class="panel p-[18px]">
              <h2 class="m-0 mb-3 text-[16px] font-bold text-ink">
                รายละเอียดเอกสาร ({{ view()!.documents.length }} ฉบับ)
              </h2>
              <div class="grid gap-3.5">
                @for (doc of view()!.documents; track doc.doc_id) {
                  <article class="rounded-[4px] border-[1.5px] border-line-soft p-3.5">
                    <div class="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p class="m-0 text-sm font-bold text-ink">
                          {{ doc.doc_type_code }} — {{ doc.doc_type_name || 'ไม่ระบุประเภท' }}
                        </p>
                        <p class="m-0 mt-0.5 text-[11.5px] text-muted">
                          @if (doc.doc_no) {
                            เลขที่ {{ doc.doc_no }}
                          }
                          @if (doc.doc_date) {
                            · วันที่ {{ doc.doc_date }}
                          }
                          · ที่มา {{ sourceLabel(doc.source) }}
                        </p>
                      </div>
                      <span
                        class="shrink-0 rounded-[3px] px-2.5 py-1 text-[11.5px] font-extrabold"
                        [class]="STATUS_BADGE_CLASS[doc.status]"
                      >
                        {{ STATUS_LABEL[doc.status] }}
                      </span>
                    </div>

                    @if (doc.summary_text) {
                      <p class="m-0 mt-2.5 text-[12.5px] leading-relaxed text-slate-700">
                        {{ doc.summary_text }}
                      </p>
                    }

                    @if (extractedEntries(doc).length) {
                      <div class="mt-2.5 grid gap-2 sm:grid-cols-2">
                        @for (entry of extractedEntries(doc); track entry[0]) {
                          <div class="rounded-[3px] border border-line-soft bg-zebra p-2.5">
                            <p class="m-0 text-[11.5px] font-bold text-muted">{{ entry[0] }}</p>
                            <p class="m-0 mt-1 text-[13px] font-extrabold text-ink">
                              {{ entry[1] }}
                            </p>
                          </div>
                        }
                      </div>
                    }

                    @if (doc.findings.length) {
                      <div class="mt-3 border-t border-line-soft pt-2.5">
                        <p class="m-0 mb-1.5 text-[11.5px] font-bold text-slate-600">
                          Findings ({{ doc.findings.length }})
                        </p>
                        <div class="grid gap-2">
                          @for (finding of doc.findings; track finding.finding_id) {
                            <div class="rounded-[3px] border border-[#e6cfca] bg-[#fdf6f5] p-2.5">
                              <div class="flex flex-wrap items-start justify-between gap-2">
                                <p class="m-0 text-[12.5px] font-bold text-[#8a2a1f]">
                                  {{ finding.risk_category }}
                                </p>
                                <span
                                  class="shrink-0 rounded-[3px] px-2 py-0.5 text-[10.5px] font-bold"
                                  [class]="SEVERITY_BADGE_CLASS[finding.severity]"
                                >
                                  {{ SEVERITY_LABEL[finding.severity] }}
                                </span>
                              </div>
                              <p class="m-0 mt-1 text-[12px] leading-relaxed text-slate-700">
                                {{ finding.finding_text }}
                              </p>
                              @if (finding.observed_value || finding.expected_value) {
                                <p class="m-0 mt-1 text-[11.5px] text-muted">
                                  @if (finding.observed_value) {
                                    ค่าที่พบ: {{ finding.observed_value }}
                                  }
                                  @if (finding.expected_value) {
                                    · เกณฑ์: {{ finding.expected_value }}
                                  }
                                </p>
                              }
                              @if (finding.legal_refs.length) {
                                <ul class="m-0 mt-1.5 grid gap-1 pl-0">
                                  @for (ref of finding.legal_refs; track ref.section_id) {
                                    <li class="list-none text-[11px] leading-relaxed text-muted">
                                      <span class="font-bold text-slate-700"
                                        >{{ ref.law
                                        }}{{ ref.section_no ? ' ' + ref.section_no : '' }}</span
                                      >
                                      @if (ref.reason) {
                                        — {{ ref.reason }}
                                      }
                                    </li>
                                  }
                                </ul>
                              }
                            </div>
                          }
                        </div>
                      </div>
                    }
                  </article>
                }
              </div>
            </section>
          }
        }
      }
    </section>
  `,
})
export class DocumentIntelligencePageComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly STATUS_LABEL = STATUS_LABEL;
  protected readonly STATUS_BADGE_CLASS = STATUS_BADGE_CLASS;
  protected readonly SEVERITY_LABEL = SEVERITY_LABEL;
  protected readonly SEVERITY_BADGE_CLASS = SEVERITY_BADGE_CLASS;

  readonly projectId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly view = signal<ProjectDocumentsView | null>(null);
  private readonly documentTypes = signal<DocumentType[]>([]);

  private readonly docTypeNameByCode = computed(() => {
    const map = new Map<string, string>();
    this.documentTypes().forEach((t) => map.set(t.doc_type_code, t.name_th));
    return map;
  });

  /** จับคู่ required_doc_types กับ documents[]/missing_doc_types[] เพื่อขึ้น checklist เดียว */
  readonly checklist = computed<ChecklistRow[]>(() => {
    const v = this.view();
    if (!v) {
      return [];
    }
    const docByCode = new Map(v.documents.map((d) => [d.doc_type_code, d]));
    const missingByCode = new Map(v.missing_doc_types.map((m) => [m.doc_type_code, m]));
    return v.required_doc_types.map((code) => {
      const document = docByCode.get(code) ?? null;
      const missing = missingByCode.get(code) ?? null;
      return {
        doc_type_code: code,
        name_th: document?.doc_type_name || missing?.name_th || this.docTypeNameByCode().get(code) || code,
        document,
        missing,
      };
    });
  });

  ngOnInit(): void {
    const projectId = this.route.snapshot.paramMap.get('projectId');
    if (projectId) {
      this.projectId.set(projectId);
      this.loadData(projectId);
    } else {
      this.error.set('ไม่พบรหัสโครงการ');
      this.loading.set(false);
    }
  }

  loadData(projectId: string): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      view: this.api.projectDocuments(projectId).pipe(catchError(() => of<ProjectDocumentsView | null>(null))),
      documentTypes: this.api.documentTypes().pipe(catchError(() => of<DocumentType[]>([]))),
    }).subscribe({
      next: ({ view, documentTypes }) => {
        this.documentTypes.set(documentTypes);
        this.view.set(view);
        if (!view) {
          this.error.set('โหลดข้อมูลเอกสารของโครงการนี้ไม่สำเร็จ');
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('โหลดข้อมูลไม่สำเร็จ');
        this.loading.set(false);
      },
    });
  }

  reloadData(): void {
    const projectId = this.projectId();
    if (projectId) {
      this.loadData(projectId);
    }
  }

  checklistStatusText(row: ChecklistRow): string {
    if (row.document) {
      return STATUS_LABEL[row.document.status];
    }
    if (row.missing) {
      return MISSING_REASON_LABEL[row.missing.reason];
    }
    return 'ไม่ทราบสถานะ';
  }

  checklistBadgeClass(row: ChecklistRow): string {
    if (row.document) {
      return STATUS_BADGE_CLASS[row.document.status];
    }
    // no_record ≠ missing จริง — ใช้สีเทาแทนสีแดง กันเข้าใจผิดว่าโครงการมีเอกสารขาดทั้งที่แค่ยังไม่บันทึก
    if (row.missing?.reason === 'no_record') {
      return 'bg-slate-400 text-white';
    }
    if (row.missing) {
      return STATUS_BADGE_CLASS[row.missing.reason as ProjectDocumentStatus] ?? 'bg-slate-400 text-white';
    }
    return 'bg-slate-400 text-white';
  }

  sourceLabel(source: string): string {
    switch (source) {
      case 'ocr':
        return 'OCR';
      case 'manual':
        return 'บันทึกมือ';
      case 'mock':
        return 'ข้อมูลจำลอง';
      default:
        return source;
    }
  }

  extractedEntries(doc: ProjectDocument): [string, string][] {
    return Object.entries(doc.extracted ?? {}).map(([key, value]) => [key, String(value)]);
  }
}
