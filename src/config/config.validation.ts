import * as Joi from 'joi';

/**
 * Skema validasi untuk variabel lingkungan menggunakan Joi.
 * @description Memastikan semua variabel lingkungan valid sebelum aplikasi mulai.
 * Catatan: Validasi kondisional berdasarkan STORAGE_TYPE digunakan untuk memastikan
 * hanya variabel yang relevan untuk provider penyimpanan tertentu yang ada.
 */
export const validationSchema = Joi.object({
  // Lingkungan Aplikasi
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production')
    .default('development')
    .messages({
      'any.only':
        'NODE_ENV harus "development", "staging", atau "production" di file .env',
    }),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug')
    .default('info')
    .messages({
      'any.only':
        'LOG_LEVEL harus "error", "warn", "info", atau "debug" di file .env',
    }),
  LOG_DIR: Joi.string().default('logs').messages({
    'string.empty': 'LOG_DIR tidak boleh kosong di file .env',
  }),
  ENABLE_DEBUG: Joi.boolean().default(false).messages({
    'boolean.base':
      'ENABLE_DEBUG harus berupa boolean (true/false) di file .env',
  }),

  // Konfigurasi Jaringan
  PROTOCOL: Joi.string().valid('http', 'https').default('http').messages({
    'any.only': 'PROTOCOL harus "http" atau "https" di file .env',
  }),
  HOST: Joi.string().required().messages({
    'any.required': 'HOST wajib diisi di file .env (misalnya, localhost)',
    'string.empty': 'HOST tidak boleh kosong di file .env',
  }),
  PORT: Joi.number().min(1).max(65535).default(3000).messages({
    'number.base': 'PORT harus berupa angka di file .env (misalnya, 3000)',
    'number.min': 'PORT harus lebih besar dari 0',
    'number.max': 'PORT harus kurang dari atau sama dengan 65535',
  }),
  FRONTEND_URL: Joi.string().uri().required().messages({
    'any.required': 'FRONTEND_URL wajib diisi di file .env',
    'string.uri':
      'FRONTEND_URL harus berupa URI valid (misalnya, http://localhost:4200)',
  }),
  BACKEND_URL: Joi.string().uri().required().messages({
    'any.required': 'BACKEND_URL wajib diisi di file .env',
    'string.uri':
      'BACKEND_URL harus berupa URI valid (misalnya, http://localhost:3000)',
  }),

  // Database
  DATABASE_URL: Joi.string().uri().required().messages({
    'any.required': 'DATABASE_URL wajib diisi di file .env',
    'string.uri':
      'DATABASE_URL harus berupa URI valid (misalnya, postgresql://user:pass@localhost:5432/db)',
  }),

  // Konfigurasi Email
  MAIL_HOST: Joi.string().required().messages({
    'any.required':
      'MAIL_HOST wajib diisi di file .env (misalnya, smtp.gmail.com)',
    'string.empty': 'MAIL_HOST tidak boleh kosong di file .env',
  }),
  MAIL_PORT: Joi.number().valid(25, 465, 587).required().messages({
    'any.required': 'MAIL_PORT wajib diisi di file .env',
    'number.base': 'MAIL_PORT harus berupa angka di file .env',
    'any.only': 'MAIL_PORT harus 25, 465, atau 587 di file .env',
  }),
  MAIL_USER: Joi.string().email().required().messages({
    'any.required':
      'MAIL_USER wajib diisi di file .env (misalnya, user@domain.com)',
    'string.email': 'MAIL_USER harus berupa email valid di file .env',
  }),
  MAIL_PASS: Joi.string().required().messages({
    'any.required': 'MAIL_PASS wajib diisi di file .env',
    'string.empty': 'MAIL_PASS tidak boleh kosong di file .env',
  }),
  MAIL_ADMIN_NOTIFY: Joi.string().email().optional().messages({
    'string.email': 'MAIL_ADMIN_NOTIFY harus berupa email valid di file .env',
  }),
  APP_NAME: Joi.string().required().messages({
    'any.required':
      'APP_NAME wajib diisi di file .env (misalnya, Admin GMF Training)',
    'string.empty': 'APP_NAME tidak boleh kosong di file .env',
  }),

  // Autentikasi dan Sesi
  SESSION_SECRET: Joi.string()
    .min(32)
    .required()
    .pattern(/^[^\s]+$/)
    .messages({
      'any.required': 'SESSION_SECRET wajib diisi di file .env',
      'string.min': 'SESSION_SECRET harus minimal 32 karakter',
      'string.pattern.base': 'SESSION_SECRET tidak boleh mengandung spasi',
    }),
  JWT_ACCESS_SECRET: Joi.string()
    .min(32)
    .required()
    .pattern(/^[^\s]+$/)
    .messages({
      'any.required': 'JWT_ACCESS_SECRET wajib diisi di file .env',
      'string.min': 'JWT_ACCESS_SECRET harus minimal 32 karakter',
      'string.pattern.base': 'JWT_ACCESS_SECRET tidak boleh mengandung spasi',
    }),
  JWT_REFRESH_SECRET: Joi.string()
    .min(32)
    .required()
    .pattern(/^[^\s]+$/)
    .messages({
      'any.required': 'JWT_REFRESH_SECRET wajib diisi di file .env',
      'string.min': 'JWT_REFRESH_SECRET harus minimal 32 karakter',
      'string.pattern.base': 'JWT_REFRESH_SECRET tidak boleh mengandung spasi',
    }),
  JWT_VERIFICATION_SECRET: Joi.string()
    .min(32)
    .required()
    .pattern(/^[^\s]+$/)
    .messages({
      'any.required': 'JWT_VERIFICATION_SECRET wajib diisi di file .env',
      'string.min': 'JWT_VERIFICATION_SECRET harus minimal 32 karakter',
      'string.pattern.base':
        'JWT_VERIFICATION_SECRET tidak boleh mengandung spasi',
    }),
  OLD_JWT_SECRET: Joi.string()
    .min(32)
    .optional()
    .pattern(/^[^\s]+$/)
    .messages({
      'string.min': 'OLD_JWT_SECRET harus minimal 32 karakter',
      'string.pattern.base': 'OLD_JWT_SECRET tidak boleh mengandung spasi',
    }),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m').messages({
    'string.base':
      'JWT_ACCESS_EXPIRES_IN harus berupa string (misalnya, "15m") di file .env',
  }),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d').messages({
    'string.base':
      'JWT_REFRESH_EXPIRES_IN harus berupa string (misalnya, "7d") di file .env',
  }),
  JWT_VERIFICATION_EXPIRES_IN: Joi.string().default('15m').messages({
    'string.base':
      'JWT_VERIFICATION_EXPIRES_IN harus berupa string (misalnya, "15m") di file .env',
  }),

  // Enkripsi
  ENCRYPTION_KEY: Joi.string()
    .length(64)
    .required()
    .pattern(/^[0-9a-fA-F]+$/)
    .messages({
      'any.required': 'ENCRYPTION_KEY wajib diisi di file .env',
      'string.length': 'ENCRYPTION_KEY harus tepat 64 karakter heksadesimal',
      'string.pattern.base':
        'ENCRYPTION_KEY harus berupa string heksadesimal (0-9, a-f, A-F)',
    }),

  // reCAPTCHA
  RECAPTCHA_SECRET_KEY: Joi.string().required().messages({
    'any.required': 'RECAPTCHA_SECRET_KEY wajib diisi di file .env',
    'string.empty': 'RECAPTCHA_SECRET_KEY tidak boleh kosong di file .env',
  }),
  RECAPTCHA_MAX_ATTEMPTS: Joi.number().min(1).default(5).messages({
    'number.base': 'RECAPTCHA_MAX_ATTEMPTS harus berupa angka di file .env',
    'number.min': 'RECAPTCHA_MAX_ATTEMPTS harus lebih besar dari 0',
  }),
  RECAPTCHA_SCORE_THRESHOLD: Joi.number().min(0).max(1).default(0.5).messages({
    'number.base': 'RECAPTCHA_SCORE_THRESHOLD harus berupa angka di file .env',
    'number.min':
      'RECAPTCHA_SCORE_THRESHOLD harus lebih besar atau sama dengan 0',
    'number.max':
      'RECAPTCHA_SCORE_THRESHOLD harus kurang dari atau sama dengan 1',
  }),

  // OAuth Google
  GOOGLE_CLIENT_ID: Joi.string().required().messages({
    'any.required': 'GOOGLE_CLIENT_ID wajib diisi di file .env',
    'string.empty': 'GOOGLE_CLIENT_ID tidak boleh kosong di file .env',
  }),
  GOOGLE_CLIENT_SECRET: Joi.string().required().messages({
    'any.required': 'GOOGLE_CLIENT_SECRET wajib diisi di file .env',
    'string.empty': 'GOOGLE_CLIENT_SECRET tidak boleh kosong di file .env',
  }),
  GOOGLE_CALLBACK_URL: Joi.string().uri().required().messages({
    'any.required': 'GOOGLE_CALLBACK_URL wajib diisi di file .env',
    'string.uri':
      'GOOGLE_CALLBACK_URL harus berupa URI valid (misalnya, http://localhost:3000/auth/google/callback)',
  }),

  // OAuth Microsoft
  MICROSOFT_CLIENT_ID: Joi.string().required().messages({
    'any.required': 'MICROSOFT_CLIENT_ID wajib diisi di file .env',
    'string.empty': 'MICROSOFT_CLIENT_ID tidak boleh kosong di file .env',
  }),
  MICROSOFT_CLIENT_SECRET: Joi.string().required().messages({
    'any.required': 'MICROSOFT_CLIENT_SECRET wajib diisi di file .env',
    'string.empty': 'MICROSOFT_CLIENT_SECRET tidak boleh kosong di file .env',
  }),
  MICROSOFT_CALLBACK_URL: Joi.string().uri().required().messages({
    'any.required': 'MICROSOFT_CALLBACK_URL wajib diisi di file .env',
    'string.uri':
      'MICROSOFT_CALLBACK_URL harus berupa URI valid (misalnya, http://localhost:3000/auth/microsoft/callback)',
  }),

  // Swagger
  SWAGGER_USER: Joi.string().required().messages({
    'any.required': 'SWAGGER_USER wajib diisi di file .env',
    'string.empty': 'SWAGGER_USER tidak boleh kosong di file .env',
  }),
  SWAGGER_PASSWORD: Joi.string().required().messages({
    'any.required': 'SWAGGER_PASSWORD wajib diisi di file .env',
    'string.empty': 'SWAGGER_PASSWORD tidak boleh kosong di file .env',
  }),

  // Penyimpanan File
  STORAGE_TYPE: Joi.string()
    .valid('local', 'nas', 'gcp', 'aws', 'alibaba')
    .default('local')
    .messages({
      'any.only':
        'STORAGE_TYPE harus "local", "nas", "gcp", "aws", atau "alibaba" di file .env',
    }),
  ALLOWED_MIME_TYPES: Joi.string()
    .pattern(
      /^([a-zA-Z0-9]+\/[a-zA-Z0-9+.-]+)(,[a-zA-Z0-9]+\/[a-zA-Z0-9+.-]+)*$/
    )
    .default('image/jpeg,image/png,application/pdf')
    .messages({
      'string.pattern.base':
        'ALLOWED_MIME_TYPES harus berupa daftar MIME types yang valid, dipisahkan koma (misalnya, image/jpeg,image/png)',
    }),
  MAX_FILE_SIZE: Joi.number()
    .min(1024)
    .default(5 * 1024 * 1024) // 5MB
    .messages({
      'number.base':
        'MAX_FILE_SIZE harus berupa angka di file .env (dalam bytes)',
      'number.min': 'MAX_FILE_SIZE harus lebih besar dari 1024 bytes',
    }),

  // Local Storage
  UPLOADS_PATH: Joi.when('STORAGE_TYPE', {
    is: 'local',
    then: Joi.string().required().messages({
      'any.required':
        'UPLOADS_PATH wajib diisi jika STORAGE_TYPE=local di file .env',
      'string.empty': 'UPLOADS_PATH tidak boleh kosong di file .env',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown':
        'UPLOADS_PATH tidak boleh ada jika STORAGE_TYPE bukan local',
    }),
  }),

  // NAS Storage
  NAS_HOST: Joi.when('STORAGE_TYPE', {
    is: 'nas',
    then: Joi.string().required().messages({
      'any.required': 'NAS_HOST wajib diisi jika STORAGE_TYPE=nas di file .env',
      'string.empty': 'NAS_HOST tidak boleh kosong di file .env',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown': 'NAS_HOST tidak boleh ada jika STORAGE_TYPE bukan nas',
    }),
  }),
  NAS_USERNAME: Joi.when('STORAGE_TYPE', {
    is: 'nas',
    then: Joi.string().required().messages({
      'any.required':
        'NAS_USERNAME wajib diisi jika STORAGE_TYPE=nas di file .env',
      'string.empty': 'NAS_USERNAME tidak boleh kosong di file .env',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown': 'NAS_USERNAME tidak boleh ada jika STORAGE_TYPE bukan nas',
    }),
  }),
  NAS_PASSWORD: Joi.when('STORAGE_TYPE', {
    is: 'nas',
    then: Joi.string().required().messages({
      'any.required':
        'NAS_PASSWORD wajib diisi jika STORAGE_TYPE=nas di file .env',
      'string.empty': 'NAS_PASSWORD tidak boleh kosong di file .env',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown': 'NAS_PASSWORD tidak boleh ada jika STORAGE_TYPE bukan nas',
    }),
  }),
  NAS_BASE_PATH: Joi.when('STORAGE_TYPE', {
    is: 'nas',
    then: Joi.string().required().messages({
      'any.required':
        'NAS_BASE_PATH wajib diisi jika STORAGE_TYPE=nas di file .env',
      'string.empty': 'NAS_BASE_PATH tidak boleh kosong di file .env',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown':
        'NAS_BASE_PATH tidak boleh ada jika STORAGE_TYPE bukan nas',
    }),
  }),

  // GCP Storage
  GCP_PROJECT_ID: Joi.when('STORAGE_TYPE', {
    is: 'gcp',
    then: Joi.string().required().messages({
      'any.required':
        'GCP_PROJECT_ID wajib diisi jika STORAGE_TYPE=gcp di file .env',
      'string.empty': 'GCP_PROJECT_ID tidak boleh kosong di file .env',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown':
        'GCP_PROJECT_ID tidak boleh ada jika STORAGE_TYPE bukan gcp',
    }),
  }),
  GCP_KEY_FILE: Joi.when('STORAGE_TYPE', {
    is: 'gcp',
    then: Joi.string().required().messages({
      'any.required':
        'GCP_KEY_FILE wajib diisi jika STORAGE_TYPE=gcp di file .env',
      'string.empty': 'GCP_KEY_FILE tidak boleh kosong di file .env',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown': 'GCP_KEY_FILE tidak boleh ada jika STORAGE_TYPE bukan gcp',
    }),
  }),
  GCP_BUCKET_NAME: Joi.when('STORAGE_TYPE', {
    is: 'gcp',
    then: Joi.string().required().messages({
      'any.required':
        'GCP_BUCKET_NAME wajib diisi jika STORAGE_TYPE=gcp di file .env',
      'string.empty': 'GCP_BUCKET_NAME tidak boleh kosong di file .env',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown':
        'GCP_BUCKET_NAME tidak boleh ada jika STORAGE_TYPE bukan gcp',
    }),
  }),

  // AWS S3 Storage
  AWS_ACCESS_KEY_ID: Joi.when('STORAGE_TYPE', {
    is: 'aws',
    then: Joi.string().required().messages({
      'any.required':
        'AWS_ACCESS_KEY_ID wajib diisi jika STORAGE_TYPE=aws di file .env',
      'string.empty': 'AWS_ACCESS_KEY_ID tidak boleh kosong di file .env',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown':
        'AWS_ACCESS_KEY_ID tidak boleh ada jika STORAGE_TYPE bukan aws',
    }),
  }),
  AWS_SECRET_ACCESS_KEY: Joi.when('STORAGE_TYPE', {
    is: 'aws',
    then: Joi.string().required().messages({
      'any.required':
        'AWS_SECRET_ACCESS_KEY wajib diisi jika STORAGE_TYPE=aws di file .env',
      'string.empty': 'AWS_SECRET_ACCESS_KEY tidak boleh kosong di file .env',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown':
        'AWS_SECRET_ACCESS_KEY tidak boleh ada jika STORAGE_TYPE bukan aws',
    }),
  }),
  AWS_REGION: Joi.when('STORAGE_TYPE', {
    is: 'aws',
    then: Joi.string().required().messages({
      'any.required':
        'AWS_REGION wajib diisi jika STORAGE_TYPE=aws di file .env',
      'string.empty': 'AWS_REGION tidak boleh kosong di file .env',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown': 'AWS_REGION tidak boleh ada jika STORAGE_TYPE bukan aws',
    }),
  }),
  AWS_BUCKET_NAME: Joi.when('STORAGE_TYPE', {
    is: 'aws',
    then: Joi.string().required().messages({
      'any.required':
        'AWS_BUCKET_NAME wajib diisi jika STORAGE_TYPE=aws di file .env',
      'string.empty': 'AWS_BUCKET_NAME tidak boleh kosong di file .env',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown':
        'AWS_BUCKET_NAME tidak boleh ada jika STORAGE_TYPE bukan aws',
    }),
  }),

  // Alibaba OSS Storage
  ALIBABA_REGION: Joi.when('STORAGE_TYPE', {
    is: 'alibaba',
    then: Joi.string().required().messages({
      'any.required':
        'ALIBABA_REGION wajib diisi jika STORAGE_TYPE=alibaba di file .env',
      'string.empty': 'ALIBABA_REGION tidak boleh kosong di file .env',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown':
        'ALIBABA_REGION tidak boleh ada jika STORAGE_TYPE bukan alibaba',
    }),
  }),
  ALIBABA_ACCESS_KEY_ID: Joi.when('STORAGE_TYPE', {
    is: 'alibaba',
    then: Joi.string().required().messages({
      'any.required':
        'ALIBABA_ACCESS_KEY_ID wajib diisi jika STORAGE_TYPE=alibaba di file .env',
      'string.empty': 'ALIBABA_ACCESS_KEY_ID tidak boleh kosong di file .env',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown':
        'ALIBABA_ACCESS_KEY_ID tidak boleh ada jika STORAGE_TYPE bukan alibaba',
    }),
  }),
  ALIBABA_ACCESS_KEY_SECRET: Joi.when('STORAGE_TYPE', {
    is: 'alibaba',
    then: Joi.string().required().messages({
      'any.required':
        'ALIBABA_ACCESS_KEY_SECRET wajib diisi jika STORAGE_TYPE=alibaba di file .env',
      'string.empty':
        'ALIBABA_ACCESS_KEY_SECRET tidak boleh kosong di file .env',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown':
        'ALIBABA_ACCESS_KEY_SECRET tidak boleh ada jika STORAGE_TYPE bukan alibaba',
    }),
  }),
  ALIBABA_BUCKET_NAME: Joi.when('STORAGE_TYPE', {
    is: 'alibaba',
    then: Joi.string().required().messages({
      'any.required':
        'ALIBABA_BUCKET_NAME wajib diisi jika STORAGE_TYPE=alibaba di file .env',
      'string.empty': 'ALIBABA_BUCKET_NAME tidak boleh kosong di file .env',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown':
        'ALIBABA_BUCKET_NAME tidak boleh ada jika STORAGE_TYPE bukan alibaba',
    }),
  }),
  ALIBABA_STS_ROLE_ARN: Joi.when('STORAGE_TYPE', {
    is: 'alibaba',
    then: Joi.string().optional().messages({
      'string.empty':
        'ALIBABA_STS_ROLE_ARN tidak boleh kosong jika disediakan di file .env',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown':
        'ALIBABA_STS_ROLE_ARN tidak boleh ada jika STORAGE_TYPE bukan alibaba',
    }),
  }),
  ALIBABA_STS_SESSION_NAME: Joi.when('STORAGE_TYPE', {
    is: 'alibaba',
    then: Joi.string().optional().messages({
      'string.empty':
        'ALIBABA_STS_SESSION_NAME tidak boleh kosong jika disediakan di file .env',
    }),
    otherwise: Joi.forbidden().messages({
      'any.unknown':
        'ALIBABA_STS_SESSION_NAME tidak boleh ada jika STORAGE_TYPE bukan alibaba',
    }),
  }),
});
