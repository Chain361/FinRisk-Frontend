// ⚠️ mockup demo branch เท่านั้น — ชี้ backend บน AWS (ECS Fargate + ALB) — ห้าม merge เข้า main
// prod จริงยังอยู่บน Vercel ต้องใช้ https://finrisk-backend.vercel.app
export const environment = {
  apiBaseUrl: 'http://finrisk-alb-1756658342.us-east-1.elb.amazonaws.com',
};
