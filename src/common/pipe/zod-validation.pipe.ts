import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';

import { ZodSchema } from 'zod';

/**
 * Pipe untuk validasi input menggunakan Zod schema.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema?: ZodSchema<any>) {}

  transform(value: any, metadata: ArgumentMetadata) {
    if (!this.schema) return value;
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.errors);
    }
    return result.data;
  }
}
