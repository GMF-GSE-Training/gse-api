import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'staging', 'production')
    .default('development')
    .messages({ 'any.only': 'NODE_ENV harus "development", "staging", atau "production"' }),
  HOST: Joi.string()
    .required()
    .messages({ 'any.required': 'HOST wajib diisi di .env' }),
  PORT: Joi.number()
    .default(3000)
    .messages({ 'number.base': 'PORT harus berupa angka' }),
  FRONTEND_URL: Joi.string()
    .uri()
    .required()
    .messages({ 'any.required': 'FRONTEND_URL wajib diisi sebagai URI yang valid' }),
  PROTOCOL: Joi.string()
    .valid('http', 'https')
    .default('http')
    .messages({ 'any.only': 'PROTOCOL harus "http" atau "https"' }),
  DATABASE_URL: Joi.string()
    .uri()
    .required()
    .messages({ 'any.required': 'DATABASE_URL wajib diisi sebagai URI yang valid' }),
  QR_CODE_LINK: Joi.string()
    .required()
    .pattern(/https?:\/\/[\w\-\.]+(:\d+)?\/[\w\-\.\/\{\}]+/)
    .messages({
      'any.required': 'QR_CODE_LINK wajib diisi',
      'string.pattern.base': 'QR_CODE_LINK harus berupa URL template yang valid',
    }),
  ACCESS_TOKEN: Joi.string()
    .required()
    .messages({ 'any.required': 'ACCESS_TOKEN wajib diisi' }),
  REFRESH_TOKEN: Joi.string()
    .required()
    .messages({ 'any.required': 'REFRESH_TOKEN wajib diisi' }),
  VERIFICATION_TOKEN: Joi.string()
    .required()
    .messages({ 'any.required': 'VERIFICATION_TOKEN wajib diisi' }),
  MAIL_HOST: Joi.string()
    .required()
    .messages({ 'any.required': 'MAIL_HOST wajib diisi' }),
  MAIL_PORT: Joi.number()
    .required()
    .messages({ 'number.base': 'MAIL_PORT harus berupa angka' }),
  MAIL_USER: Joi.string()
    .required()
    .messages({ 'any.required': 'MAIL_USER wajib diisi' }),
  MAIL_PASS: Joi.string()
    .required()
    .messages({ 'any.required': 'MAIL_PASS wajib diisi' }),
  APP_NAME: Joi.string()
    .required()
    .messages({ 'any.required': 'APP_NAME wajib diisi' }),
});