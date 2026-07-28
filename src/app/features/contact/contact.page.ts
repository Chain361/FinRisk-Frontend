import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideBuilding2,
  LucideChevronRight,
  LucideMail,
  LucideMapPin,
  LucideMessageSquareWarning,
  LucidePhone,
} from '@lucide/angular';

type ReportCategory = 'incorrect_data' | 'dispute_score' | 'other';

interface ContactPoint {
  label: string;
  value: string;
  href?: string;
}

const AGENCY_CONTACT = {
  name: 'ทีมผู้ดูแลระบบ FinRisk',
  email: 'support@finrisk.example.th',
  phone: '0-2xxx-xxxx',
  address: 'เลขที่ xx อาคารตัวอย่าง ถนนตัวอย่าง แขวง/ตำบลตัวอย่าง เขต/อำเภอตัวอย่าง จังหวัดตัวอย่าง 10xxx',
  hours: 'จันทร์ - ศุกร์ เวลา 08:30 - 16:30 น.',
};

const PDPA_CONTACT = {
  unit: 'หน่วยงานคุ้มครองข้อมูลส่วนบุคคล / งานกำกับดูแลข้อมูล',
  dpo: 'เจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล (DPO): [ชื่อ/ตำแหน่ง]',
  email: 'pdpa@finrisk.example.th',
  phone: '0-2xxx-xxxx ต่อ xxx',
  hours: 'จันทร์ - ศุกร์ เวลา 08:30 - 16:30 น.',
};

const CATEGORY_LABEL: Record<ReportCategory, string> = {
  incorrect_data: 'ข้อมูลโครงการไม่ถูกต้อง',
  dispute_score: 'โต้แย้งผลการประเมินความเสี่ยง (คะเเนน/สี)',
  other: 'อื่น ๆ',
};

@Component({
  selector: 'app-contact-page',
  standalone: true,
  imports: [RouterLink, LucideBuilding2, LucideMail, LucideMapPin, LucidePhone, LucideMessageSquareWarning, LucideChevronRight],
  template: `
    <section class="page-shell">
      <div>
        <h1 class="m-0 text-[26px] font-extrabold text-ink">ติดต่อหน่วยงาน / แจ้งข้อมูลไม่ถูกต้อง</h1>
        <p class="m-0 mt-1.5 max-w-[980px] text-sm leading-7 text-muted">
          หน้านี้ใช้สำหรับแจ้งข้อมูลโครงการที่คลาดเคลื่อน ร้องเรียนเกี่ยวกับการแสดงผลข้อมูล หรือสอบถามเรื่องสิทธิของเจ้าของข้อมูล
          โดยเราแยกช่องทางติดต่อให้ชัดเจนระหว่างเรื่องงานระบบทั่วไป กับเรื่องข้อมูลส่วนบุคคลตาม PDPA
        </p>
      </div>

      <div class="rounded-[4px] border-[1.5px] border-gold-border bg-gold-bg px-[18px] py-3.5">
        <div class="flex items-start gap-3">
          <svg lucideMessageSquareWarning class="mt-1 size-[18px] shrink-0 text-gold-ink" aria-hidden="true"></svg>
          <p class="m-0 text-[13.5px] leading-7 text-[#5c4a12]">
            หากต้องการใช้สิทธิเกี่ยวกับข้อมูลส่วนบุคคล เช่น ขอเข้าถึงข้อมูล แก้ไขข้อมูล หรือสอบถามฐานการประมวลผล
            โปรดใช้ช่องทาง PDPA ด้านล่าง เพื่อให้เรื่องถูกส่งต่อไปยังผู้รับผิดชอบโดยตรง
          </p>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="panel p-[18px]">
          <div class="flex items-start gap-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-[4px] border border-line-soft bg-zebra text-navy">
              <svg lucideBuilding2 class="size-5" aria-hidden="true"></svg>
            </span>
            <div class="min-w-0">
              <h2 class="m-0 text-[15px] font-bold text-ink">ช่องทางร้องเรียน / แจ้งข้อมูลผิดพลาด</h2>
              <p class="m-0 mt-2 text-[13.5px] leading-7 text-slate-700">
                ใช้สำหรับแจ้งโครงการ ข้อมูลตัวเลข หรือข้อความที่ไม่ถูกต้องในระบบ รวมถึงการถามสถานะงานทั่วไป
              </p>
            </div>
          </div>

          <div class="mt-4 grid gap-3 text-[13.5px] text-slate-700">
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
            <div class="flex items-start gap-2.5">
              <svg lucideChevronRight class="mt-0.5 size-4 shrink-0 text-navy" aria-hidden="true"></svg>
              <span>เวลาทำการ: {{ agency.hours }}</span>
            </div>
          </div>

          <div class="mt-4 border-t border-line-soft pt-3.5">
            <p class="m-0 text-[12.5px] font-bold text-muted">เรื่องที่เหมาะกับช่องทางนี้</p>
            <ul class="m-0 mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[12.5px] leading-6 text-slate-700">
              <li>ข้อมูลโครงการไม่ถูกต้อง</li>
              <li>จำนวนเงิน งบประมาณ หรือสถานะโครงการแสดงผลไม่ตรง</li>
              <li>ต้องการสอบถามวิธีการประเมินหรือที่มาของข้อมูลในระบบ</li>
            </ul>
          </div>
        </section>

        <section class="panel p-[18px]">
          <div class="flex items-start gap-3">
            <span class="grid size-9 shrink-0 place-items-center rounded-[4px] border border-line-soft bg-zebra text-navy">
              <svg lucideMail class="size-5" aria-hidden="true"></svg>
            </span>
            <div class="min-w-0">
              <h2 class="m-0 text-[15px] font-bold text-ink">ช่องทางติดต่อเรื่องข้อมูลส่วนบุคคลและสิทธิของเจ้าของข้อมูล</h2>
              <p class="m-0 mt-2 text-[13.5px] leading-7 text-slate-700">
                ใช้สำหรับเรื่องการขอเข้าถึง แก้ไข ลบ ระงับการใช้ คัดค้าน หรือสอบถามการประมวลผลข้อมูลส่วนบุคคล
              </p>
            </div>
          </div>

          <div class="mt-4 grid gap-3 text-[13.5px] text-slate-700">
            <div class="flex items-start gap-2.5">
              <svg lucideBuilding2 class="mt-0.5 size-4 shrink-0 text-navy" aria-hidden="true"></svg>
              <span>{{ pdpa.unit }}</span>
            </div>
            <div class="flex items-start gap-2.5">
              <svg lucideMail class="mt-0.5 size-4 shrink-0 text-navy" aria-hidden="true"></svg>
              <a class="text-navy no-underline hover:underline" [href]="'mailto:' + pdpa.email">{{ pdpa.email }}</a>
            </div>
            <div class="flex items-start gap-2.5">
              <svg lucidePhone class="mt-0.5 size-4 shrink-0 text-navy" aria-hidden="true"></svg>
              <span>{{ pdpa.phone }}</span>
            </div>
            <div class="flex items-start gap-2.5">
              <svg lucideMapPin class="mt-0.5 size-4 shrink-0 text-navy" aria-hidden="true"></svg>
              <span>{{ pdpa.dpo }}</span>
            </div>
            <div class="flex items-start gap-2.5">
              <svg lucideChevronRight class="mt-0.5 size-4 shrink-0 text-navy" aria-hidden="true"></svg>
              <span>เวลาทำการ: {{ pdpa.hours }}</span>
            </div>
          </div>

          <div class="mt-4 border-t border-line-soft pt-3.5">
            <p class="m-0 text-[12.5px] font-bold text-muted">เรื่องที่เหมาะกับช่องทางนี้</p>
            <ul class="m-0 mt-2 flex list-disc flex-col gap-1.5 pl-5 text-[12.5px] leading-6 text-slate-700">
              <li>ขอสำเนาข้อมูลส่วนบุคคล</li>
              <li>ขอแก้ไขข้อมูลให้ถูกต้อง</li>
              <li>สอบถามฐานทางกฎหมายหรือการใช้ข้อมูลในระบบ</li>
              <li>ร้องเรียนกรณีเห็นว่าเก็บ ใช้ หรือเปิดเผยข้อมูลไม่เหมาะสม</li>
            </ul>
          </div>

          <div class="mt-4 rounded-[4px] border-[1.5px] border-line bg-[#fbfcfd] px-4 py-3 text-[13px] leading-7 text-slate-700">
            หากต้องการอ่านรายละเอียดเพิ่มเติมเกี่ยวกับการเก็บ ใช้ และเก็บรักษาข้อมูลส่วนบุคคล โปรดดู
            <a routerLink="/privacy-policy" class="text-navy no-underline hover:underline">นโยบายความเป็นส่วนตัว</a>
          </div>
        </section>
      </div>

      <section class="panel p-[18px]">
        @if (!submitted()) {
          <h2 class="m-0 text-[15px] font-bold text-ink">แบบฟอร์มแจ้งเรื่อง</h2>
          <p class="m-0 mt-1 text-[12.5px] text-muted">
            แบบฟอร์มนี้ใช้รับเรื่องทั่วไปเท่านั้น หากเป็นเรื่อง PDPA ให้ใช้ช่องทางด้านขวาและส่งอีเมลถึงหน่วยงานที่รับผิดชอบ
          </p>

          <div class="mt-4 grid gap-4 lg:grid-cols-2">
            <label class="block">
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

            <label class="block">
              <span class="text-[12.5px] font-bold text-muted">รหัส/ชื่อโครงการที่เกี่ยวข้อง (ถ้ามี)</span>
              <input
                type="text"
                class="gov-input mt-1"
                placeholder="เช่น PRJ-2568-00123"
                [value]="projectRef()"
                (input)="projectRef.set($any($event.target).value)"
              />
            </label>
          </div>

          <label class="mt-3 block">
            <span class="text-[12.5px] font-bold text-muted">รายละเอียด *</span>
            <textarea
              class="gov-input mt-1 min-h-[120px] w-full py-2"
              placeholder="อธิบายข้อมูลที่ไม่ถูกต้อง หรือเหตุผลที่ต้องการให้หน่วยงานตรวจสอบ"
              [value]="detail()"
              (input)="detail.set($any($event.target).value)"
            ></textarea>
          </label>

          <label class="mt-3 block max-w-sm">
            <span class="text-[12.5px] font-bold text-muted">อีเมล/ช่องทางติดต่อกลับ (ถ้าต้องการคำตอบ)</span>
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
              เจ้าหน้าที่จะตรวจสอบและติดต่อกลับตามช่องทางที่ท่านให้ไว้
            </p>
            <button type="button" class="gov-btn-outline mt-4" (click)="resetForm()">แจ้งเรื่องใหม่</button>
          </div>
        }
      </section>
    </section>
  `,
})
export class ContactPageComponent {
  readonly agency = AGENCY_CONTACT;
  readonly pdpa = PDPA_CONTACT;

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
  readonly ticketRef = signal('');

  submit(): void {
    if (!this.detail().trim()) {
      this.error.set('กรุณากรอกรายละเอียดเรื่องที่ต้องการแจ้ง');
      return;
    }
    this.error.set('');
    this.ticketRef.set(`FR-${Date.now().toString(36).toUpperCase()}`);
    this.submitted.set(true);
  }

  resetForm(): void {
    this.category.set('incorrect_data');
    this.projectRef.set('');
    this.detail.set('');
    this.contactBack.set('');
    this.error.set('');
    this.ticketRef.set('');
    this.submitted.set(false);
  }
}
