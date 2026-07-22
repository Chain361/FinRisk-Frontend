/**
 * i18n dictionaries registry
 *
 * `th` = ภาษาหลัก (baseline / source of truth). `en` ต้องมี key ครบเท่า `th`
 * — ตรวจด้วย assertKeyParity() ตอน dev (เรียกใน I18nService constructor)
 *
 * key ตั้งชื่อแบบ namespaced flat เช่น 'nav.overview', 'prOverview.title', 'risk.level.high'
 * ข้อความที่มาจาก backend (ชื่อโครงการ/ตำบล/ประเภทงบการเงิน) ไม่อยู่ที่นี่ — คงเป็นไทยเสมอ
 */
import { en } from './en';
import { th } from './th';

export type Lang = 'th' | 'en';
export type Dict = Record<string, string>;

export const LANGS: readonly Lang[] = ['th', 'en'];

export const DICT: Record<Lang, Dict> = { th, en };

/** dev-only: เตือนถ้า en มี key ไม่ครบ/เกินเทียบกับ th */
export function assertKeyParity(): void {
  const thKeys = new Set(Object.keys(th));
  const enKeys = new Set(Object.keys(en));
  const missingInEn = [...thKeys].filter((k) => !enKeys.has(k));
  const extraInEn = [...enKeys].filter((k) => !thKeys.has(k));
  if (missingInEn.length) {
    console.warn(`[i18n] en ขาด ${missingInEn.length} key:`, missingInEn);
  }
  if (extraInEn.length) {
    console.warn(`[i18n] en มี key เกิน ${extraInEn.length} ตัว:`, extraInEn);
  }
}
