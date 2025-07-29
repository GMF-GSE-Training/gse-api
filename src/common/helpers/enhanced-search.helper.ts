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
  // Optional: Context untuk search yang lebih cerdas
  searchContext?: {
    // Data range yang ada di database untuk membuat search lebih spesifik
    availableDateRange?: {
      minYear: number;
      maxYear: number;
    };
  };
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
      // Check if term is a year (4 digits) - but also treat as text search
      if (/^\d{4}$/.test(term)) {
        const year = parseInt(term);
        if (year >= 1900 && year <= 2100) {
          isDateSearch = true;
          dateComponents.year = year;
          // Don't continue - also add as text search term
        }
      }

      // Check if term is a day (1-2 digits) - Enhanced logic for standalone dates
      if (/^\d{1,2}$/.test(term)) {
        const day = parseInt(term);
        if (day >= 1 && day <= 31) {
          // Check if there's a month name in the query to make it more likely a date
          const hasMonthInQuery = terms.some(t => this.INDONESIAN_MONTHS[t]);
          if (hasMonthInQuery) {
            dateComponents.day = day;
            isDateSearch = true;
          } else if (terms.length === 1) {
            // If it's a single term and it's a valid day, treat as date search
            dateComponents.day = day;
            isDateSearch = true;
          }
          // Always continue to add as search term too for comprehensive search
        }
      }

      // Check if term is an Indonesian month - but also treat as text search
      if (this.INDONESIAN_MONTHS[term]) {
        isDateSearch = true;
        dateComponents.month = this.INDONESIAN_MONTHS[term];
        // Don't continue - also add as text search term
      }

      // Check date patterns like "28-07", "28/07", "2025-07-28" - but also treat as text search
      if (this.isDatePattern(term)) {
        isDateSearch = true;
        const parsed = this.parseDatePattern(term);
        if (parsed) {
          dateQueries.push(parsed);
          // Don't continue - also add as text search term
        }
      }

      // Always add as search term for comprehensive search
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

    // Debug logging
    console.log('🔍 Enhanced Search Parse Debug:', {
      originalQuery: searchQuery,
      parsedResult: {
        isDateSearch,
        searchTerms,
        dateQueries,
        dateComponents
      }
    });

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
   * Build enhanced search where clause - 2025 Best Practice Implementation
   */
  static buildEnhancedSearchClause(
    searchQuery: string, 
    config: EnhancedSearchConfig
  ): any {
    if (!searchQuery || searchQuery.trim().length === 0) {
      return {};
    }

    const trimmedQuery = searchQuery.trim();
    console.log('🔍 Building search for query:', trimmedQuery);
    
    // Strategy 1: Progressive Enhancement Search
    // Start with simple, then add complexity
    const whereClauses: any[] = [];
    
    // 1. Check for clear date patterns first (most specific)
    const datePattern = this.detectDatePattern(trimmedQuery);
    if (datePattern) {
      console.log('🔍 Date pattern detected:', datePattern);
      const dateClauses = this.buildSimpleDateClauses(datePattern, config.dateFields);
      whereClauses.push(...dateClauses);
      console.log('🔍 Date clauses added:', dateClauses.length);
      
      // For date patterns, also search as text in case it's part of descriptions
      for (const field of config.textFields) {
        if (field === 'ratingCode' || field === 'trainingName') {
          whereClauses.push({
            capabilityCots: {
              some: {
                capability: {
                  [field]: { contains: trimmedQuery, mode: 'insensitive' }
                }
              }
            }
          });
        } else {
          whereClauses.push({
            [field]: { contains: trimmedQuery, mode: 'insensitive' }
          });
        }
      }
    } else {
      // 2. Regular text search for non-date patterns
      const words = trimmedQuery.toLowerCase().split(/\s+/).filter(word => word.length > 0);
      console.log('🔍 Search words:', words);
      
      // Individual word search (most permissive)
      for (const word of words) {
        for (const field of config.textFields) {
          if (field === 'ratingCode' || field === 'trainingName') {
            whereClauses.push({
              capabilityCots: {
                some: {
                  capability: {
                    [field]: { contains: word, mode: 'insensitive' }
                  }
                }
              }
            });
          } else {
            whereClauses.push({
              [field]: { contains: word, mode: 'insensitive' }
            });
          }
        }
      }
      
      // Exact phrase search for multi-word queries (more specific)
      if (words.length > 1) {
        for (const field of config.textFields) {
          if (field === 'ratingCode' || field === 'trainingName') {
            whereClauses.push({
              capabilityCots: {
                some: {
                  capability: {
                    [field]: { contains: trimmedQuery, mode: 'insensitive' }
                  }
                }
              }
            });
          } else {
            whereClauses.push({
              [field]: { contains: trimmedQuery, mode: 'insensitive' }
            });
          }
        }
      }
    }
    
    console.log('🔍 Total search clauses:', whereClauses.length);
    
    // Return OR clause to find matches in any field or condition
    if (whereClauses.length > 0) {
      const finalClause = { OR: whereClauses };
      console.log('🔍 Final search clause structure:', JSON.stringify(finalClause, null, 2));
      return finalClause;
    }
    
    return {};
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

          case 'month': {
            // Simplified month search - current year only
            const currentYear = new Date().getFullYear();
            clauses.push({
              [field]: {
                gte: new Date(currentYear, dateQuery.month - 1, 1),
                lt: new Date(currentYear, dateQuery.month, 1)
              }
            });
            break;
          }

          case 'day': {
            // Very limited day search - only search if it's a clear date context
            // Skip individual day search to avoid too broad results
            console.log('⚠️ Skipping individual day search for better precision');
            break;
          }

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

          case 'partial-date': {
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
          }

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

          case 'combined-day-month': {
            // ✅ More precise day-month search: 22 juli
            if (dateQuery.month && dateQuery.day) {
              const currentYear = new Date().getFullYear();
              // Search only current year and next year for better precision
              for (let year = currentYear; year <= currentYear + 1; year++) {
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
          }

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
   * Detect simple date patterns - 2025 Best Practice
   */
  private static detectDatePattern(query: string): any {
    const trimmedQuery = query.toLowerCase().trim();
    
    // Pattern 1: "13 april" or "22 juli"
    const dayMonthPattern = /^(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|sep|okt|nov|des)$/;
    const dayMonthMatch = trimmedQuery.match(dayMonthPattern);
    if (dayMonthMatch) {
      const day = parseInt(dayMonthMatch[1]);
      const monthName = dayMonthMatch[2];
      const month = this.INDONESIAN_MONTHS[monthName];
      if (day >= 1 && day <= 31 && month) {
        return {
          type: 'day-month',
          day,
          month,
          query: `${day} ${monthName}`
        };
      }
    }
    
    // Pattern 2: "april 2025" or "juli 2024"
    const monthYearPattern = /^(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|sep|okt|nov|des)\s+(\d{4})$/;
    const monthYearMatch = trimmedQuery.match(monthYearPattern);
    if (monthYearMatch) {
      const monthName = monthYearMatch[1];
      const year = parseInt(monthYearMatch[2]);
      const month = this.INDONESIAN_MONTHS[monthName];
      if (month && year >= 1900 && year <= 2100) {
        return {
          type: 'month-year',
          month,
          year,
          query: `${monthName} ${year}`
        };
      }
    }
    
    // Pattern 3: "22 juli 2025"
    const fullDatePattern = /^(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|agu|sep|okt|nov|des)\s+(\d{4})$/;
    const fullDateMatch = trimmedQuery.match(fullDatePattern);
    if (fullDateMatch) {
      const day = parseInt(fullDateMatch[1]);
      const monthName = fullDateMatch[2];
      const year = parseInt(fullDateMatch[3]);
      const month = this.INDONESIAN_MONTHS[monthName];
      if (day >= 1 && day <= 31 && month && year >= 1900 && year <= 2100) {
        return {
          type: 'full-date',
          day,
          month,
          year,
          query: `${day} ${monthName} ${year}`
        };
      }
    }
    
    return null;
  }
  
  /**
   * Build simple date clauses - 2025 Best Practice
   */
  private static buildSimpleDateClauses(datePattern: any, dateFields: string[]): any[] {
    const clauses: any[] = [];
    const currentYear = new Date().getFullYear();
    
    for (const field of dateFields) {
      switch (datePattern.type) {
        case 'day-month': {
          // Search in current year and next year
          for (let year = currentYear; year <= currentYear + 1; year++) {
            const startDate = new Date(year, datePattern.month - 1, datePattern.day);
            const endDate = new Date(year, datePattern.month - 1, datePattern.day + 1);
            
            if (startDate.getMonth() === datePattern.month - 1 && startDate.getDate() === datePattern.day) {
              clauses.push({
                [field]: {
                  gte: startDate,
                  lt: endDate
                }
              });
            }
          }
          break;
        }
        
        case 'month-year': {
          const startDate = new Date(datePattern.year, datePattern.month - 1, 1);
          const endDate = new Date(datePattern.year, datePattern.month, 1);
          clauses.push({
            [field]: {
              gte: startDate,
              lt: endDate
            }
          });
          break;
        }
        
        case 'full-date': {
          const startDate = new Date(datePattern.year, datePattern.month - 1, datePattern.day);
          const endDate = new Date(datePattern.year, datePattern.month - 1, datePattern.day + 1);
          clauses.push({
            [field]: {
              gte: startDate,
              lt: endDate
            }
          });
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
