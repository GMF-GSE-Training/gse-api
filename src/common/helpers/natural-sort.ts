import natsort from 'natsort';

/**
 * Natural sort helper universal untuk ASC/DESC
 * @param a string
 * @param b string
 * @param order 'asc' | 'desc'
 */
export function naturalSort(a: string, b: string, order: 'asc' | 'desc' = 'asc'): number {
  const sorter = natsort({ insensitive: true });
  return order === 'asc' ? sorter(a, b) : sorter(b, a);
} 