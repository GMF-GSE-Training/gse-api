import { naturalSort } from './natural-sort';

export interface SortingConfig {
  // Fields yang diizinkan untuk sorting
  allowedSortFields: string[];
  
  // Fields yang menggunakan natural sort (otomatis detect untuk string fields)
  naturalSortFields?: string[];
  
  // Fields tanggal yang ada di tabel (akan dicek otomatis)
  dateFields?: string[];
  
  // Fields yang dihitung/computed (tidak ada di database)
  computedFields?: string[];
  
  // Fields relasi yang perlu handling khusus
  relationFields?: string[];
  
  // Fields yang pasti bisa di-sort di database
  dbSortFields?: string[];
  
  // Default sort field
  defaultSortField?: string;
}

export interface SortingResult {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  strategy: 'natural' | 'date' | 'computed' | 'relation' | 'database' | 'fallback';
}

export class SortingHelper {
  
  /**
   * Tentukan strategi sorting berdasarkan field dan config
   */
  static determineSortingStrategy(
    sortBy: string,
    config: SortingConfig
  ): 'natural' | 'date' | 'computed' | 'relation' | 'database' | 'fallback' {
    
    if (config.naturalSortFields?.includes(sortBy)) {
      return 'natural';
    }
    
    if (config.dateFields?.includes(sortBy)) {
      return 'date';
    }
    
    if (config.computedFields?.includes(sortBy)) {
      return 'computed';
    }
    
    if (config.relationFields?.includes(sortBy)) {
      return 'relation';
    }
    
    if (config.dbSortFields?.includes(sortBy)) {
      return 'database';
    }
    
    // Default fallback to natural sort for string-like fields
    return 'fallback';
  }
  
  /**
   * Validasi dan normalisasi sorting parameters
   */
  static validateAndNormalizeSorting(
    requestSortBy: string | undefined,
    requestSortOrder: string | undefined,
    config: SortingConfig
  ): SortingResult {
    
    // Validasi sortBy
    const sortBy = requestSortBy && config.allowedSortFields.includes(requestSortBy) 
      ? requestSortBy 
      : (config.defaultSortField || config.allowedSortFields[0]);
    
    // Validasi sortOrder
    const sortOrder: 'asc' | 'desc' = requestSortOrder === 'desc' ? 'desc' : 'asc';
    
    // Tentukan strategy
    const strategy = this.determineSortingStrategy(sortBy, config);
    
    return {
      sortBy,
      sortOrder,
      strategy
    };
  }
  
  /**
   * Sort array menggunakan natural sort
   */
  static sortArrayNaturally<T>(
    array: T[],
    sortBy: string,
    sortOrder: 'asc' | 'desc'
  ): T[] {
    return array.sort((a, b) => naturalSort(
      (a as any)[sortBy] || '', 
      (b as any)[sortBy] || '', 
      sortOrder
    ));
  }
  
  /**
   * Sort array berdasarkan tanggal
   */
  static sortArrayByDate<T>(
    array: T[],
    sortBy: string,
    sortOrder: 'asc' | 'desc'
  ): T[] {
    return array.sort((a, b) => {
      const aDate = (a as any)[sortBy] ? new Date((a as any)[sortBy]) : null;
      const bDate = (b as any)[sortBy] ? new Date((b as any)[sortBy]) : null;
      
      // Handle null values - put them at the end
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      
      const comparison = aDate.getTime() - bDate.getTime();
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }
  
  /**
   * Auto-detect field types berdasarkan sample data
   */
  static autoDetectFieldTypes(sampleData: any[], allowedFields: string[]): {
    naturalSortFields: string[];
    dateFields: string[];
    dbSortFields: string[];
  } {
    const naturalSortFields: string[] = [];
    const dateFields: string[] = [];
    const dbSortFields: string[] = [];
    
    if (sampleData.length === 0) {
      // Fallback: assume all allowed fields are natural sort
      return {
        naturalSortFields: allowedFields,
        dateFields: [],
        dbSortFields: []
      };
    }
    
    const sample = sampleData[0];
    
    for (const field of allowedFields) {
      const value = sample[field];
      
      if (value === undefined || value === null) {
        // Skip fields with null/undefined values
        continue;
      }
      
      if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) {
        dateFields.push(field);
      } else if (typeof value === 'string') {
        naturalSortFields.push(field);
      } else {
        // Numbers, booleans, etc. can be sorted in database
        dbSortFields.push(field);
      }
    }
    
    return {
      naturalSortFields,
      dateFields,
      dbSortFields
    };
  }
  
  /**
   * Create Prisma orderBy object
   */
  static createPrismaOrderBy(sortBy: string, sortOrder: 'asc' | 'desc'): any {
    return { [sortBy]: sortOrder };
  }
  
  /**
   * Create Prisma orderBy for relation fields
   */
  static createPrismaRelationOrderBy(
    relationField: string, 
    relationKey: string, 
    sortOrder: 'asc' | 'desc'
  ): any {
    return { [relationField]: { [relationKey]: sortOrder } };
  }
}

/**
 * Decorator/Builder pattern untuk membuat sorting config dengan mudah
 */
export class SortingConfigBuilder {
  private config: SortingConfig = {
    allowedSortFields: []
  };
  
  static create(): SortingConfigBuilder {
    return new SortingConfigBuilder();
  }
  
  allowFields(fields: string[]): SortingConfigBuilder {
    this.config.allowedSortFields = fields;
    return this;
  }
  
  naturalSort(fields: string[]): SortingConfigBuilder {
    this.config.naturalSortFields = fields;
    return this;
  }
  
  dateSort(fields: string[]): SortingConfigBuilder {
    this.config.dateFields = fields;
    return this;
  }
  
  computedSort(fields: string[]): SortingConfigBuilder {
    this.config.computedFields = fields;
    return this;
  }
  
  relationSort(fields: string[]): SortingConfigBuilder {
    this.config.relationFields = fields;
    return this;
  }
  
  databaseSort(fields: string[]): SortingConfigBuilder {
    this.config.dbSortFields = fields;
    return this;
  }
  
  defaultSort(field: string): SortingConfigBuilder {
    this.config.defaultSortField = field;
    return this;
  }
  
  build(): SortingConfig {
    return this.config;
  }
}
