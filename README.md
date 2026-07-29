# FinRisk Dashboard

Angular + Tailwind frontend for local budget risk analytics.

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the frontend module layout, backend interface contract, auth seam, and time-series gap policy.

## Run

```bash
npm install
npm start -- --port 3000 --host 127.0.0.1
```

Use port `3000` or `5173`; the current backend CORS plan allows both. If `5173` is free, this also works:

```bash
npm start -- --port 5173 --host 127.0.0.1
```

Backend base URL is configured in `src/environments/environment.ts`:

```ts
apiBaseUrl: 'http://127.0.0.1:8000'
```

## Auth Contract

Backend ใช้ JWT auth จริงแล้ว (bcrypt password hashing + PyJWT access token):

- `POST /auth/login` with `{ username, password }` → คืน `{ token, user }` (token = JWT, อายุ 8 ชม.)
- frontend stores token in `localStorage`
- every authenticated request sends `Authorization: Bearer <token>`
- default mock password is `password123`

## Workflow Overview

## Demo Accounts (mock — ทุกคนรหัสผ่าน `password123`)

> ⚠️ บัญชีทดสอบสำหรับ prototype เท่านั้น (seed จาก `FinRisk-Backend/seed_database.py`) —
> ก่อนใช้งานจริงต้องลบบัญชีเหล่านี้และตั้ง password จริงต่อผู้ใช้

| username | บทบาท | ขอบเขตข้อมูล |
|---|---|---|
| `admin` | ผู้ดูแลระบบ | ทุกตำบล + ตั้งค่าระบบ |
| `supervisor1` | ผู้กำกับดูแลอำเภอ/จังหวัด | ทุกตำบล |
| `thachang_user` | ผู้บริหารตำบล (นายก/ปลัด) | เฉพาะท่าช้าง (ตัวกรองตำบลถูกล็อก) |
| `pingkhong_user` | ผู้บริหารตำบล (นายก/ปลัด) | เฉพาะปิงโค้ง |
| `yonok_user` | ผู้บริหารตำบล (นายก/ปลัด) | เฉพาะโยนก |
| `auditor1` | ผู้ตรวจสอบโครงการ | เฉพาะท่าช้าง + มอบหมายงานตรวจสอบ |
| `auditor2` | ผู้ตรวจสอบโครงการ | เฉพาะปิงโค้ง + มอบหมายงานตรวจสอบ |
| `auditor3` | ผู้ตรวจสอบโครงการ | เฉพาะโยนก + มอบหมายงานตรวจสอบ |
| `analyst1` | นักวิเคราะห์/ตรวจสอบภายใน | เฉพาะท่าช้าง + ดำเนินการตรวจสอบและส่ง feedback |
| `analyst2` | นักวิเคราะห์/ตรวจสอบภายใน | เฉพาะปิงโค้ง + ดำเนินการตรวจสอบและส่ง feedback |
| `analyst3` | นักวิเคราะห์/ตรวจสอบภายใน | เฉพาะโยนก + ดำเนินการตรวจสอบและส่ง feedback |
| `public1` | ประชาชนทั่วไป | ทุกตำบล (read-only, ไม่เห็นข้อมูลที่ปิด) |

คู่เดโมที่เห็นความต่างชัด: login `admin` (เลือกตำบลได้ 3 ตำบล) เทียบกับ `pingkhong_user`
(ตัวกรองล็อก + badge "ขอบเขต: ตำบลของตน")

### ขั้นตอนการทำงาน

1. โครงการที่ยังไม่มีผู้รับผิดชอบมีสถานะ `รอมอบหมาย`
2. ผู้ตรวจสอบโครงการ (`auditor1-3`) มอบหมายงานผ่าน `POST /audit/assignments` → สถานะ `กำลังดำเนินการ` และแจ้งนักวิเคราะห์
3. นักวิเคราะห์ (`analyst1-3`) ดำเนินการตรวจสอบและส่ง feedback → สถานะ `อยู่ระหว่างสอบทาน` และแจ้งผู้ตรวจสอบโครงการ
4. ผู้ตรวจสอบโครงการอนุมัติ feedback → สถานะ `เสร็จสิ้น` และแจ้งนักวิเคราะห์

การแนบหลักฐานและกระทู้ขอความชัดเจนใช้งานได้ระหว่างดำเนินงาน แต่ไม่สร้าง notification แยกต่างหาก

### ขอบเขตสิทธิ์ที่ควรจำ

- ผู้ตรวจสอบโครงการ (`auditor1-3`) เป็นผู้รับผิดชอบ workflow ปิดงาน
- ฝั่ง `supervisor1` และบทบาทอื่นที่เป็น read-only ใช้เพื่อดูข้อมูลและตรวจสอบประกอบ ไม่ใช่ผู้ปิดงาน
- การเปลี่ยนสถานะงานถูกจำกัดตาม role ที่ backend อนุญาต
- frontend ทำหน้าที่แสดงผลและส่งคำสั่งเท่านั้น ไม่ตัดสินสิทธิ์ขั้นสุดท้ายเอง

> สถานะ `รอมอบหมาย` เป็นสถานะของโครงการที่ยังไม่มี assignment; เมื่อมอบหมายแล้ว assignment
> จะใช้เพียง `in_progress`, `under_review` และ `completed`.

## Implemented Features

- F1 Project Risk Dashboard: `/risk/summary`, `/projects`
- F2 Annual Financial Health: `/risk/annual`
- F3 Risk Factor Analysis: `/projects/{id}`, `/risk/factors`
- F4 Time Series & Trend Analysis: `/projects`, `/risk/annual`

For F2, `computable=false` is rendered as `ประเมินไม่ได้` and chart values are `null`, not `0`, so ECharts leaves a visible gap.
