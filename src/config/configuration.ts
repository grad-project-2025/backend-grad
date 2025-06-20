import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  // App
  port: parseInt(process.env.PORT || '3000'),
  env: process.env.NODE_ENV || 'development',
  appUrl: process.env.APP_URL,

  // JWT
  jwtSecret: process.env.JWT_SECRET,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,

  // Mongo
  mongoUri: process.env.MONGO_URI,

  // Stripe
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripePublicKey: process.env.STRIPE_PUBLIC_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,

  // Paymob
  paymobApiKey: process.env.PAYMOB_API_KEY,
  paymobMerchantId: process.env.PAYMOB_MERCHANT_ID,
  paymobHmacSecret: process.env.PAYMOB_HMAC_SECRET,
  paymobCardIntegrationId: process.env.PAYMOB_CARD_INTEGRATION_ID,

  // Redis
  redisHost: process.env.REDIS_HOST,
  redisPort: process.env.REDIS_PORT,
  redisTtl: process.env.REDIS_TTL,
  redisPassword: process.env.REDIS_PASSWORD,

  // Amadeus
  amadeusApiKey: process.env.AMADEUS_API_KEY,
  amadeusApiSecret: process.env.AMADEUS_API_SECRET,
  useBrandedFares: process.env.USE_BRANDED_FARES,
  useMockData: process.env.USE_MOCK_DATA,

  // Mail
  mailHost: process.env.MAIL_HOST,
  mailPort: process.env.MAIL_PORT,
  mailUser: process.env.MAIL_USER,
  mailPassword: process.env.MAIL_PASSWORD,
  mailFrom: process.env.MAIL_FROM,

  // Misc
  baggage15kgPrice: process.env.BAGGAGE_15KG_PRICE,
  baggage23kgPrice: process.env.BAGGAGE_23KG_PRICE,
  seatHoldDuration: process.env.SEAT_HOLD_DURATION,
  frontendUrl: process.env.FRONTEND_URL,
  stripeAccount: process.env.STRIPE_ACCOUNT,
}));
