import { Injectable } from '@nestjs/common';

import { ZodType } from 'zod';

/**
 *
 */
@Injectable()
export class ValidationService {
  /**
   *
   * @param zodTypeOrValue
   * @param data
   */
  validate<T>(zodTypeOrValue: ZodType | any, data?: any): any {
    if (
      zodTypeOrValue &&
      typeof zodTypeOrValue.parse === 'function' &&
      data !== undefined
    ) {
      return (zodTypeOrValue as ZodType).parse(data);
    }
    return true;
  }
}
