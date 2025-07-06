interface AppConfig {
  nodeEnv: string;
  host: string;
  port: number;
  frontendUrl: string;
  backendUrl: string;
  protocol: string;
  databaseUrl: string;
  qrCodeLink: string;
  accessToken: string;
  refreshToken: string;
  verificationToken: string;
  mailHost: string;
  mailPort: number;
  mailUser: string;
  mailPass: string;
  appName: string;
  publicBucket: string;
  logoPath: string;
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST,
  port: parseInt(process.env.PORT, 10) || 3000,
  frontendUrl: process.env.FRONTEND_URL,
  backendUrl: process.env.BACKEND_URL,
  protocol: process.env.PROTOCOL || (process.env.NODE_ENV === 'production' ? 'https' : 'http'),
  databaseUrl: process.env.DATABASE_URL,
  qrCodeLink: process.env.QR_CODE_LINK,
  accessToken: process.env.ACCESS_TOKEN,
  refreshToken: process.env.REFRESH_TOKEN,
  verificationToken: process.env.VERIFICATION_TOKEN,
  mailHost: process.env.MAIL_HOST,
  mailPort: parseInt(process.env.MAIL_PORT, 10) || 587,
  mailUser: process.env.MAIL_USER,
  mailPass: process.env.MAIL_PASS,
  appName: process.env.APP_NAME,
  publicBucket: process.env.SUPABASE_PUBLIC_BUCKET,
  logoPath: process.env.LOGO_PATH,
});