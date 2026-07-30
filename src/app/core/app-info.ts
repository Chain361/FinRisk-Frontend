/**
 * ข้อมูลระบุตัวตนของแอป — ใช้แสดงในหัว sidebar (ดู layout/app-shell.component.ts)
 *
 * APP_VERSION ต้องตรงกับ "version" ใน package.json เสมอ — แก้ที่สองที่พร้อมกันเมื่อออกเวอร์ชันใหม่
 * (ไม่ import package.json ตรงๆ เพราะต้องเปิด resolveJsonModule + ทำให้ bundle ติด metadata
 * ที่ไม่จำเป็นทั้งก้อน)
 */
export const APP_NAME_TH = 'ระบบวิเคราะห์ความเสี่ยงงบประมาณตำบล';
export const APP_NAME_EN = 'Local Budget Financial Risk System';
export const APP_VERSION = '1.0.0';
