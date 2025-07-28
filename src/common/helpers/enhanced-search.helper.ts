/**
 * Enhanced Search Helper dengan dukungan format tanggal Indonesia
 * Mendukung pencarian berdasarkan tanggal, bulan, tahun dalam bahasa Indonesia
 */

export interface DateSearchResult {
  isDateSearch: boolean;
  searchTerms: string[];
  dateQueries: any[];
}

export interface EnhancedSearchConfig {
  // Fields text yang bisa dicari
  textFields: string[];
  // Fields tanggal yang bisa dicari
  dateFields: string[];
  // Fields numeric yang bisa dicari
  numericFields?: string[];
}

export class EnhancedSearchHelper {
  
  // Mapping bulan Indonesia ke nomor
  private static readonly INDONESIAN_MONTHS = {
    'januari': 1, 'jan': 1,
    'februari': 2, 'feb': 2,
    'maret': 3, 'mar': 3,
    'april': 4, 'apr': 4,
    'mei': 5,
    'juni': 6, 'jun': 6,
    'juli': 7, 'jul': 7,
    'agustus': 8, 'agu': 8,
    'september': 9, 'sep': 9,
    'oktober': 10, 'okt': 10,
    'november': 11, 'nov': 11,
    'desember': 12, 'des': 12
  };

  /**
   * Parse search query untuk deteksi tanggal dengan smart combination
   */
  static parseSearchQuery(searchQuery: string): DateSearchResult {
    const query = searchQuery.toLowerCase().trim();
    const searchTerms: string[] = [];
    const dateQueries: any[] = [];
    let isDateSearch = false;

    // Split query by spaces untuk handle multiple terms
    const terms = query.split(/\s+/);
    
    // Collect date components untuk smart combination
    const dateComponents = {
      day: null as number | null,
      month: null as number | null,
      year: null as number | null
    };
    
    for (const term of terms) {
      // Check if term is a year (4 digits)
      if (/^\d{4}$/.test(term)) {
        const year = parseInt(term);
        if (year >= 1900 && year <= 2100) {
          isDateSearch = true;
          dateComponents.year = year;
          continue;
        }
      }

      // Check if term is a day (1-2 digits)
      if (/^\d{1,2}$/.test(term)) {
        const day = parseInt(term);
        if (day >= 1 && day <= 31) {
          isDateSearch = true;
          dateComponents.day = day;
          continue;
        }
      }

      // Check if term is an Indonesian month
      if (this.INDONESIAN_MONTHS[term]) {
        isDateSearch = true;
        dateComponents.month = this.INDONESIAN_MONTHS[term];
        continue;
      }

      // Check date patterns like "28-07", "28/07", "2025-07-28"
      if (this.isDatePattern(term)) {
        isDateSearch = true;
        const parsed = this.parseDatePattern(term);
        if (parsed) {
          dateQueries.push(parsed);
          continue;
        }
      }

      // If not a date component, treat as regular search term
      searchTerms.push(term);
    }

    // Smart combination of date components
    if (isDateSearch && (dateComponents.day || dateComponents.month || dateComponents.year)) {
      if (dateComponents.day && dateComponents.month && dateComponents.year) {
        // Full date: 22 juli 2025
        dateQueries.push({
          day: dateComponents.day,
          month: dateComponents.month,
          year: dateComponents.year,
          type: 'combined-full-date'
        });
      } else if (dateComponents.day && dateComponents.month) {
        // Day + Month: 22 juli
        dateQueries.push({
          day: dateComponents.day,
          month: dateComponents.month,
          type: 'combined-day-month'
        });
      } else if (dateComponents.month && dateComponents.year) {
        // Month + Year: juli 2025
        dateQueries.push({
          month: dateComponents.month,
          year: dateComponents.year,
          type: 'combined-month-year'
        });
      } else {
        // Individual components (fallback to original logic but more limited)
        if (dateComponents.day) {
          dateQueries.push({
            day: dateComponents.day,
            type: 'day'
          });
        }
        if (dateComponents.month) {
          dateQueries.push({
            month: dateComponents.month,
            type: 'month'
          });
        }
        if (dateComponents.year) {
          dateQueries.push({
            year: dateComponents.year,
            type: 'year'
          });
        }
      }
    }

    return {
      isDateSearch,
      searchTerms,
      dateQueries
    };
  }

  /**
   * Check if term matches date pattern
   */
  private static isDatePattern(term: string): boolean {
    // Patterns: DD-MM, DD/MM, DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD
    const patterns = [
      /^\d{1,2}[-\/]\d{1,2}$/,           // DD-MM or DD/MM
      /^\d{1,2}[-\/]\d{1,2}[-\/]\d{4}$/, // DD-MM-YYYY or DD/MM/YYYY
      /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}$/  // YYYY-MM-DD
    ];
    
    return patterns.some(pattern => pattern.test(term));
  }

  /**
   * Parse date pattern into components
   */
  private static parseDatePattern(term: string): any {
    const separators = /[-\/]/;
    const parts = term.split(separators).map(p => parseInt(p));
    
    if (parts.length === 2) {
      // DD-MM or MM-DD format
      return {
        day: parts[0] <= 31 ? parts[0] : null,
        month: parts[1] <= 12 ? parts[1] : null,
        type: 'partial-date'
      };
    } else if (parts.length === 3) {
      // Check if first part is year (YYYY-MM-DD) or day (DD-MM-YYYY)
      if (parts[0] > 31) {
        // YYYY-MM-DD format
        return {
          year: parts[0],
          month: parts[1],
          day: parts[2],
          type: 'full-date'
        };
      } else {
        // DD-MM-YYYY format
        return {
          day: parts[0],
          month: parts[1],
          year: parts[2],
          type: 'full-date'
        };
      }
    }
    
    return null;
  }

  /**
   * Build enhanced search where clause
   */
  static buildEnhancedSearchClause(
    searchQuery: string, 
    config: EnhancedSearchConfig
  ): any {
    const parsed = this.parseSearchQuery(searchQuery);
    const whereClauses: any[] = [];

    // Handle regular text search
    if (parsed.searchTerms.length > 0) {
      const textQuery = parsed.searchTerms.join(' ');
      const textClauses = config.textFields.map(field => ({
        [field]: { contains: textQuery, mode: 'insensitive' }
      }));
      whereClauses.push(...textClauses);
    }

    // Handle date search
    if (parsed.isDateSearch && parsed.dateQueries.length > 0) {
      const dateClauses = this.buildDateSearchClauses(parsed.dateQueries, config.dateFields);
      whereClauses.push(...dateClauses);
    }

    // If no specific clauses, fall back to general text search across all fields
    if (whereClauses.length === 0) {
      const allFields = [...config.textFields, ...(config.numericFields || [])];
      whereClauses.push(...allFields.map(field => ({
        [field]: { contains: searchQuery, mode: 'insensitive' }
      })));
    }

    return whereClauses.length > 0 ? { OR: whereClauses } : {};
  }

  /**
   * Build date-specific search clauses
   */
  private static buildDateSearchClauses(dateQueries: any[], dateFields: string[]): any[] {
    const clauses: any[] = [];

    for (const dateQuery of dateQueries) {
      for (const field of dateFields) {
        switch (dateQuery.type) {
          case 'year':
            clauses.push({
              [field]: {
                gte: new Date(dateQuery.year, 0, 1),
                lt: new Date(dateQuery.year + 1, 0, 1)
              }
            });
            break;

          case 'month':
            // For month search, we need to check across all possible years
            // This is more complex but provides better UX
            const currentYear = new Date().getFullYear();
            for (let year = currentYear - 5; year <= currentYear + 5; year++) {
              clauses.push({
                [field]: {
                  gte: new Date(year, dateQuery.month - 1, 1),
                  lt: new Date(year, dateQuery.month, 1)
                }
              });
            }
            break;

          case 'day':
            // For day search, check across recent months
            const today = new Date();
            for (let monthOffset = -6; monthOffset <= 6; monthOffset++) {
              const checkDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, dateQuery.day);
              if (checkDate.getDate() === dateQuery.day) { // Valid date
                clauses.push({
                  [field]: {
                    gte: new Date(checkDate.getFullYear(), checkDate.getMonth(), dateQuery.day),
                    lt: new Date(checkDate.getFullYear(), checkDate.getMonth(), dateQuery.day + 1)
                  }
                });
              }
            }
            break;

          case 'full-date':
            if (dateQuery.year && dateQuery.month && dateQuery.day) {
              const targetDate = new Date(dateQuery.year, dateQuery.month - 1, dateQuery.day);
              clauses.push({
                [field]: {
                  gte: targetDate,
                  lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000) // Next day
                }
              });
            }
            break;

          case 'partial-date':
            if (dateQuery.month && dateQuery.day) {
              // Search across multiple years for this month/day combination
              const currentYear = new Date().getFullYear();
              for (let year = currentYear - 2; year <= currentYear + 2; year++) {
                const targetDate = new Date(year, dateQuery.month - 1, dateQuery.day);
                if (targetDate.getMonth() === dateQuery.month - 1) { // Valid date
                  clauses.push({
                    [field]: {
                      gte: targetDate,
                      lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
                    }
                  });
                }
              }
            }
            break;

          case 'combined-full-date':
            // Exact date match: 22 juli 2025
            if (dateQuery.year && dateQuery.month && dateQuery.day) {
              const targetDate = new Date(dateQuery.year, dateQuery.month - 1, dateQuery.day);
              clauses.push({
                [field]: {
                  gte: targetDate,
                  lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
                }
              });
            }
            break;

          case 'combined-day-month':
            // Specific day and month across multiple years: 22 juli
            if (dateQuery.month && dateQuery.day) {
              const currentYear = new Date().getFullYear();
              // Search across reasonable year range for this specific day/month
              for (let year = currentYear - 3; year <= currentYear + 3; year++) {
                const targetDate = new Date(year, dateQuery.month - 1, dateQuery.day);
                if (targetDate.getMonth() === dateQuery.month - 1 && targetDate.getDate() === dateQuery.day) {
                  clauses.push({
                    [field]: {
                      gte: targetDate,
                      lt: new Date(targetDate.getTime() + 24 * 60 * 60 * 1000)
                    }
                  });
                }
              }
            }
            break;

          case 'combined-month-year':
            // Specific month and year: juli 2025
            if (dateQuery.month && dateQuery.year) {
              clauses.push({
                [field]: {
                  gte: new Date(dateQuery.year, dateQuery.month - 1, 1),
                  lt: new Date(dateQuery.year, dateQuery.month, 1)
                }
              });
            }
            break;
        }
      }
    }

    return clauses;
  }

  /**
   * Get user-friendly search info
   */
  static getSearchInfo(searchQuery: string): string {
    const parsed = this.parseSearchQuery(searchQuery);
    
    if (parsed.isDateSearch && parsed.dateQueries.length > 0) {
      const dateDescriptions: string[] = [];
      
      for (const query of parsed.dateQueries) {
        switch (query.type) {
          case 'year':
            dateDescriptions.push(`tahun ${query.year}`);
            break;
          case 'month':
            const monthName = Object.keys(this.INDONESIAN_MONTHS).find(
              key => this.INDONESIAN_MONTHS[key] === query.month
            );
            dateDescriptions.push(`bulan ${monthName}`);
            break;
          case 'day':
            dateDescriptions.push(`tanggal ${query.day}`);
            break;
          case 'full-date':
            dateDescriptions.push(`tanggal ${query.day}/${query.month}/${query.year}`);
            break;
          case 'combined-full-date':
            const monthNameFull = Object.keys(this.INDONESIAN_MONTHS).find(
              key => this.INDONESIAN_MONTHS[key] === query.month
            );
            dateDescriptions.push(`tanggal ${query.day} ${monthNameFull} ${query.year}`);
            break;
          case 'combined-day-month':
            const monthNameDayMonth = Object.keys(this.INDONESIAN_MONTHS).find(
              key => this.INDONESIAN_MONTHS[key] === query.month
            );
            dateDescriptions.push(`tanggal ${query.day} ${monthNameDayMonth}`);
            break;
          case 'combined-month-year':
            const monthNameMonthYear = Object.keys(this.INDONESIAN_MONTHS).find(
              key => this.INDONESIAN_MONTHS[key] === query.month
            );
            dateDescriptions.push(`${monthNameMonthYear} ${query.year}`);
            break;
        }
      }
      
      if (parsed.searchTerms.length > 0) {
        return `Pencarian: "${parsed.searchTerms.join(' ')}" dan ${dateDescriptions.join(', ')}`;
      } else {
        return `Pencarian berdasarkan ${dateDescriptions.join(', ')}`;
      }
    }
    
    return `Pencarian: "${searchQuery}"`;
  }
}
