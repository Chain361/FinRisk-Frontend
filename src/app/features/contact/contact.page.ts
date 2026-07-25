import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideBuilding2,
  LucideMail,
  LucideMapPin,
  LucideMessageSquareWarning,
  LucidePhone,
  LucideSend,
} from '@lucide/angular';

type ReportCategory = 'incorrect_data' | 'dispute_score' | 'other';

/**
 * ข้อมูลหน่วยงานผู้รับผิดชอบระบบ — mock (เว็บอยู่ในสถานะ Prototype ยังไม่มีหน่วยงานจริงรับผิดชอบ)
 * แก้เป็นข้อมูลจริงเมื่อระบบขึ้น production
 */
const AGENCY_CONTACT = {
  name: 'ทีมผู้ดูแลระบบ FinRisk (ตัวอย่าง)',
  email: 'support@finrisk.example.th',
  phone: '0-2xxx-xxxx (ตัวอย่าง)',
  address: 'เลขที่ xx อาคารตัวอย่าง ถนนตัวอย่าง แขวง/ตำบลตัวอย่าง เขต/อำเภอตัวอย่าง จังหวัดตัวอย่าง 10xxx',
};

const CATEGORY_LABEL: Record<ReportCategory, string> = {
  incorrect_data: 'ข้อมูลโครงการไม่ถูกต้อง',
  dispute_score: 'โต้แย้งผลการประเมินความเสี่ยง (คะแนน/สี)',
  other: 'อื่นๆ',
};

@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [
    RouterLink,
    LucideBuilding2,
    LucideMail,
    LucideMapPin,
    LucidePhone,
    LucideMessageSquareWarning,
    LucideSend,
  ],
  template: `
    <section class="page-shell">
      <div>
        <h1 class="m-0 text-[26px] font-extrabold text-ink">ติดต่อ / แจ้งข้อมูลไม่ถูกต้อง</h1>
        <p class="m-0 mt-1.5 text-sm text-muted">
          ช่องทางติดต่อหน่วยงานผู้ดูแลระบบ และแจ้งข้อมูลไม่ถูกต้องหรือโต้แย้งผลการประเมินความเสี่ยง
        </p>
      </div>

      <div class="flex items-start gap-3 rounded-[4px] border-[1.5px] border-gold-border bg-gold-bg px-[18px] py-3.5">
        <svg lucideMessageSquareWarning class="mt-1 size-[18px] shrink-0 text-gold-ink" aria-hidden="true"></svg>
        <p class="m-0 text-[13.5px] leading-7 text-[#5c4a12]">
          คะแนนและสีความเสี่ยงเป็นเพียง "สัญญาณ" ให้ตรวจสอบเพิ่มเติม ไม่ใช่คำตัดสิน
          หากท่านเห็นว่าข้อมูลโครงการไม่ถูกต้องหรือไม่เห็นด้วยกับผลการประเมิน สามารถแจ้งผ่านแบบฟอร์มด้านล่างได้
        </p>
      </div>

      <div class="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
        <section class="panel p-[18px]">
          <h2 class="m-0 text-[15px] font-bold text-ink">หน่วยงานผู้รับผิดชอบ</h2>
          <div class="mt-3.5 flex flex-col gap-3 text-[13.5px] text-slate-700">
            <div class="flex items-start gap-2.5">
              <svg lucideBuilding2 class="mt-0.5 size-4 shrink-0 text-navy" aria-hidden="true"></svg>
              <span>{{ agency.name }}</span>
            </div>
            <div class="flex items-start gap-2.5">
              <svg lucideMail class="mt-0.5 size-4 shrink-0 text-navy" aria-hidden="true"></svg>
              <a class="text-navy no-underline hover:underline" [href]="'mailto:' + agency.email">{{ agency.email }}</a>
            </div>
            <div class="flex items-start gap-2.5">
              <svg lucidePhone class="mt-0.5 size-4 shrink-0 text-navy" aria-hidden="true"></svg>
              <span>{{ agency.phone }}</span>
            </div>
            <div class="flex items-start gap-2.5">
              <svg lucideMapPin class="mt-0.5 size-4 shrink-0 text-navy" aria-hidden="true"></svg>
              <span>{{ agency.address }}</span>
            </div>
          </div>

          <div class="mt-4 border-t border-line-soft pt-3.5">
            <p class="m-0 text-[12.5px] font-bold text-muted">เอกสารที่เกี่ยวข้อง</p>
            <ul class="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[12.5px]">
              <li>เอกสารวิธีการประเมินความเสี่ยง (methodology) — จะเผยแพร่เร็วๆ นี้</li>
              <li>
                <a routerLink="/privacy-policy" class="text-navy no-underline hover:underline">
                  นโยบายความเป็นส่วนตัว (PDPA)
                </a>
              </li>
              <li>
                <a routerLink="/data-sources" class="text-navy no-underline hover:underline">
                  ที่มาของข้อมูลระดับระบบ (Data Sources)
                </a>
              </li>
            </ul>
          </div>
        </section>

        <section class="panel p-[18px]">
          @if (!submitted()) {
            <h2 class="m-0 text-[15px] font-bold text-ink">แจ้งข้อมูลไม่ถูกต้อง / โต้แย้งผลการประเมิน</h2>
            <p class="m-0 mt-1 text-[12.5px] text-muted">
              กรุณาระบุรายละเอียดให้ครบถ้วน เจ้าหน้าที่จะตรวจสอบและติดต่อกลับตามช่องทางที่ท่านให้ไว้
            </p>

            <label class="mt-3.5 block">
              <span class="text-[12.5px] font-bold text-muted">ประเภทเรื่อง *</span>
              <select
                class="gov-select mt-1 w-full"
                [value]="category()"
                (change)="category.set($any($event.target).value)"
              >
                @for (opt of categoryOptions; track opt.value) {
                  <option [value]="opt.value">{{ opt.label }}</option>
                }
              </select>
            </label>

            <label class="mt-3 block">
              <span class="text-[12.5px] font-bold text-muted">รหัส/ชื่อโครงการที่เกี่ยวข้อง (ถ้ามี)</span>
              <input
                type="text"
                class="gov-input mt-1"
                placeholder="เช่น PRJ-2568-00123"
                [value]="projectRef()"
                (input)="projectRef.set($any($event.target).value)"
              />
            </label>

            <label class="mt-3 block">
              <span class="text-[12.5px] font-bold text-muted">รายละเอียด *</span>
              <textarea
                class="gov-input mt-1 min-h-[110px] w-full py-2"
                placeholder="อธิบายข้อมูลที่ไม่ถูกต้อง หรือเหตุผลที่โต้แย้งผลการประเมิน..."
                [value]="detail()"
                (input)="detail.set($any($event.target).value)"
              ></textarea>
            </label>

            <label class="mt-3 block max-w-sm">
              <span class="text-[12.5px] font-bold text-muted">อีเมล/เบอร์ติดต่อกลับ (ถ้าต้องการคำตอบ)</span>
              <input
                type="text"
                class="gov-input mt-1"
                placeholder="เช่น name@example.com"
                [value]="contactBack()"
                (input)="contactBack.set($any($event.target).value)"
              />
            </label>

            @if (error()) {
              <p class="m-0 mt-3 rounded-[4px] border-[1.5px] border-risk-high bg-red-50 px-3.5 py-2.5 text-[12.5px] text-risk-high">
                {{ error() }}
              </p>
            }

            <div class="mt-4 flex items-center gap-2">
              <button type="button" class="gov-btn-primary inline-flex items-center gap-2" (click)="submit()">
                <svg lucideSend class="size-4" aria-hidden="true"></svg>
                ส่งเรื่อง
              </button>
            </div>
          } @else {
            <div class="rounded-[4px] border-[1.5px] border-line bg-[#fbfcfd] px-5 py-8 text-center">
              <p class="m-0 text-[15px] font-bold text-ink">ได้รับเรื่องแล้ว</p>
              <p class="m-0 mt-1.5 text-[13px] text-muted">
                หมายเลขอ้างอิง <span class="font-bold text-navy">{{ ticketRef() }}</span>
                — เจ้าหน้าที่จะตรวจสอบและติดต่อกลับ (ตัวอย่างการทำงาน ยังไม่เชื่อมระบบหลังบ้านจริง)
              </p>
              <button type="button" class="gov-btn-outline mt-4" (click)="resetForm()">แจ้งเรื่องใหม่</button>
            </div>
          }
        </section>
      </div>
    </section>
  `,
})
export class ContactPageComponent {
  readonly agency = AGENCY_CONTACT;

  readonly categoryOptions = (Object.keys(CATEGORY_LABEL) as ReportCategory[]).map((value) => ({
    value,
    label: CATEGORY_LABEL[value],
  }));

  readonly category = signal<ReportCategory>('incorrect_data');
  readonly projectRef = signal('');
  readonly detail = signal('');
  readonly contactBack = signal('');
  readonly error = signal('');

  readonly submitted = signal(false);
  readonly ticketRef = computed(() => this.generatedRef());
  private generatedRef = signal('');

  /**
   * ยังไม่มี endpoint ฝั่ง backend รับเรื่องแจ้งข้อมูล — mock การส่งไว้ก่อน
   * (สร้างเลขอ้างอิงฝั่ง client) เพื่อให้ผู้ใช้เห็น flow ครบ รอเชื่อม API จริงภายหลัง
   */
  submit(): void {
    if (!this.detail().trim()) {
      this.error.set('กรุณากรอกรายละเอียดเรื่องที่ต้องการแจ้ง');
      return;
    }
    this.error.set('');
    this.generatedRef.set(`FR-${Date.now().toString(36).toUpperCase()}`);
    this.submitted.set(true);
  }

  resetForm(): void {
    this.category.set('incorrect_data');
    this.projectRef.set('');
    this.detail.set('');
    this.contactBack.set('');
    this.error.set('');
    this.submitted.set(false);
  }
}
