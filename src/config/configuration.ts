/**
 * Konfigurasi aplikasi menggunakan variabel lingkungan.
 * @description Memetakan variabel lingkungan ke objek AppConfig dengan validasi runtime oleh Joi.
 */
interface AppConfig {
  nodeEnv: string;
  host: string;
  port: number;
  frontendUrl: string;
  backendUrl: string;
  protocol: string;
  databaseUrl: string;
  // qrCodeLink: string;
  accessToken: string;
  refreshToken: string;
  verificationToken: string;
  mailHost: string;
  mailPort: number;
  mailUser: string;
  mailPass: string;
  appName: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;
  encryptionKey: string;
  storageType: string;
  uploadsPath: string;
}

/**
 * Fungsi pembantu untuk parsing angka dari variabel lingkungan.
 * @param value Nilai dari process.env
 * @param defaultValue Nilai default jika value tidak ada
 * @returns Angka yang diparse atau defaultValue
 */
const parseEnvNumber = (
  value: string | undefined,
  defaultValue: number
): number => {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  host: process.env.HOST as string, // Aman: validasi Joi memastikan wajib diisi
  port: parseEnvNumber(process.env.PORT, 3000),
  frontendUrl: process.env.FRONTEND_URL as string, // Aman: validasi Joi memastikan URI valid
  backendUrl: process.env.BACKEND_URL as string, // Aman: validasi Joi memastikan URI valid
  protocol:
    process.env.PROTOCOL ||
    (process.env.NODE_ENV === 'production' ? 'https' : 'http'),
  databaseUrl: process.env.DATABASE_URL as string, // Aman: validasi Joi memastikan URI valid
  // qrCodeLink: process.env.QR_CODE_LINK as string,
  accessToken: process.env.ACCESS_TOKEN as string, // Aman: validasi Joi memastikan wajib diisi
  refreshToken: process.env.REFRESH_TOKEN as string, // Aman: validasi Joi memastikan wajib diisi
  verificationToken: process.env.VERIFICATION_TOKEN as string, // Aman: validasi Joi memastikan wajib diisi
  mailHost: process.env.MAIL_HOST as string, // Aman: validasi Joi memastikan wajib diisi
  mailPort: parseInt(process.env.MAIL_PORT as string, 10), // Aman: validasi Joi memastikan wajib dan numerik
  mailUser: process.env.MAIL_USER as string, // Aman: validasi Joi memastikan wajib diisi
  mailPass: process.env.MAIL_PASS as string, // Aman: validasi Joi memastikan wajib diisi
  appName: process.env.APP_NAME as string, // Aman: validasi Joi memastikan wajib diisi
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET as string, // Aman: validasi Joi memastikan wajib dan aman
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET as string, // Aman: validasi Joi memastikan wajib dan aman
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  encryptionKey: process.env.ENCRYPTION_KEY as string, // Aman: validasi Joi memastikan format hex
  storageType: process.env.STORAGE_TYPE || 'local',
  uploadsPath: process.env.UPLOADS_PATH || './uploads',
});
