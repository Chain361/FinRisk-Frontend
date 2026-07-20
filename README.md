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

The backend uses mock auth:

- `POST /auth/login` with `{ username, password }`
- token is the username
- frontend stores token in `localStorage`
- every authenticated request sends `X-Username: <token>`
- default mock password is `password123`

## Demo Accounts (mock — ทุกคนรหัสผ่าน `password123`)

> ⚠️ บัญชีทดสอบสำหรับ prototype เท่านั้น (seed จาก `FinRisk-Backend/seed_database.py`) —
> ก่อนใช้งานจริงต้องเปลี่ยนเป็นระบบ auth จริง (bcrypt/JWT) และลบบัญชีเหล่านี้

| username | บทบาท | ขอบเขตข้อมูล |
|---|---|---|
| `admin` | ผู้ดูแลระบบ | ทุกตำบล + ตั้งค่าระบบ |
| `supervisor1` | ผู้กำกับดูแลอำเภอ/จังหวัด | ทุกตำบล |
| `thachang_user` | ผู้บริหารตำบล (นายก/ปลัด) | เฉพาะท่าช้าง (ตัวกรองตำบลถูกล็อก) |
| `pingkhong_user` | ผู้บริหารตำบล (นายก/ปลัด) | เฉพาะปิงโค้ง |
| `yonok_user` | ผู้บริหารตำบล (นายก/ปลัด) | เฉพาะโยนก |
| `auditor1` | ผู้ตรวจสอบโครงการ | เฉพาะท่าช้าง |
| `analyst1` | นักวิเคราะห์/ตรวจสอบภายใน | เฉพาะท่าช้าง |
| `public1` | ประชาชนทั่วไป | ทุกตำบล (read-only, ไม่เห็นข้อมูลที่ปิด) |

คู่เดโมที่เห็นความต่างชัด: login `admin` (เลือกตำบลได้ 3 ตำบล) เทียบกับ `pingkhong_user`
(ตัวกรองล็อก + badge "ขอบเขต: ตำบลของตน")

## Implemented Features

- F1 Project Risk Dashboard: `/risk/summary`, `/projects`
- F2 Annual Financial Health: `/risk/annual`
- F3 Risk Factor Analysis: `/projects/{id}`, `/risk/factors`
- F4 Time Series & Trend Analysis: `/projects`, `/risk/annual`

For F2, `computable=false` is rendered as `ประเมินไม่ได้` and chart values are `null`, not `0`, so ECharts leaves a visible gap.
