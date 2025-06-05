import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

import { ZodSchema, ZodError } from 'zod';

/**
 * Pipe untuk validasi input menggunakan Zod schema.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  /**
   *
   * @param schema
   */
  constructor(private readonly schema: ZodSchema) {}

  /**
   *
   * @param value
   */
  transform(value: any) {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.errors.map(
          err => `${err.path.join('.')}: ${err.message}`
        );
        throw new BadRequestException(`Validasi gagal: ${messages.join(', ')}`);
      }
      throw new BadRequestException('Validasi gagal');
    }
  }
}
