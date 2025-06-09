import { Injectable } from '@nestjs/common';

import { ZodType } from 'zod';

/**
 *
 */
@Injectable()
export class ValidationService {
  /**
   *
   * @param zodType
   * @param data
   */
  validate<T>(zodType: ZodType, data: T): T {
    return zodType.parse(data);
  }
}
