import { HttpException, Injectable } from "@nestjs/common";
import { PrismaService } from "src/common/service/prisma.service";
import { ValidationService } from "src/common/service/validation.service";
import { CotResponse, CreateCot, UpdateCot, DashboardStatsResponse, MonthlyStats } from "src/model/cot.model";
import { CotValidation } from "./cot.validation";
import { ActionAccessRights, ListRequest, Paging } from "src/model/web.model";
import { CurrentUserRequest } from "src/model/auth.model";
import { CoreHelper } from "src/common/helpers/core.helper";
import { naturalSort } from '../common/helpers/natural-sort';
import { SortingHelper, SortingConfigBuilder } from '../common/helpers/sorting.helper';
import { EnhancedSearchHelper, EnhancedSearchConfig } from '../common/helpers/enhanced-search.helper';

@Injectable()
export class CotService {
    constructor(
        private readonly prismaService: PrismaService,
        private readonly validationService: ValidationService,
        private readonly coreHelper: CoreHelper,
    ) { }

    async createCot(request: CreateCot): Promise<string> {
        request.startDate = new Date(request.startDate);
        request.endDate = new Date(request.endDate);

        const { capabilityId, ...createCotData } = this.validationService.validate(CotValidation.CREATE, request);

        const createCot = await this.prismaService.cOT.create({
            data: createCotData
        });

        if (createCot) {
            await this.prismaService.capabilityCOT.create({
                data: {
                    cotId: createCot.id,
                    capabilityId: capabilityId
                }
            });
        }

        return 'Cot berhasil dibuat';
    }

    async getCot(cotId: string, user: CurrentUserRequest): Promise<CotResponse> {
        const userRole = user.role.name.toLowerCase();

        const cot = await this.prismaService.cOT.findUnique({
            where: { id: cotId },
            include: {
                capabilityCots: {
                    select: {
                        capability: {
                            select: {
                                id: true,
                                ratingCode: true,
                                trainingName: true,
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        participantsCots: {
                            where: {
                                participantId: { not: null },
                                ...(userRole === 'lcu' ? { participant: { dinas: user.dinas } } : {})
                            }
                        }
                    }
                },
            }
        });

        if (!cot) {
            throw new HttpException('Cot Tidak ditemukan', 404);
        }
    
        if (userRole === 'user') {
            const isParticipantLinked = await this.prismaService.participantsCOT.count({
                where: {
                    cotId: cotId,
                    participantId: user.participantId,
                },
            });
    
            if (!isParticipantLinked) {
                throw new HttpException(
                    'Anda tidak bisa mengakses COT ini karena anda belum terdaftar',
                    403,
                );
            }
        }
    
        // Mapping hasil query ke bentuk CotResponse
        let cotResponse: CotResponse = {
            id: cot.id,
            startDate: cot.startDate,
            endDate: cot.endDate,
            trainingLocation: cot.trainingLocation,
            theoryInstructorRegGse: cot.theoryInstructorRegGse,
            theoryInstructorCompetency: cot.theoryInstructorCompetency,
            practicalInstructor1: cot.practicalInstructor1,
            practicalInstructor2: cot.practicalInstructor2,
            numberOfParticipants: cot._count.participantsCots,
            status: cot.status,
            capability: cot.capabilityCots[0]?.capability || null,
        };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let updateCOt: any;
        if (cot.startDate > today) {
            updateCOt = await this.prismaService.cOT.update({
                where: {
                    id: cot.id
                },
                data: {
                    status: 'Akan datang'
                }
            });

            cotResponse.status = updateCOt.status;
        } else if(cot.startDate <= today && cot.endDate > today) {
            updateCOt = await this.prismaService.cOT.update({
                where: {
                    id: cot.id
                },
                data: {
                    status: 'Sedang berjalan',
                }
            });
            
            cotResponse.status = updateCOt.status;
        } else if(cot.endDate < today) {
            updateCOt = await this.prismaService.cOT.update({
                where: {
                    id: cot.id
                },
                data: {
                    status: 'Selesai',
                }
            });
            
            cotResponse.status = updateCOt.status;
        }

        return cotResponse;
    }

    async updateCot(cotId: string, request: UpdateCot): Promise<string> {
        const updateCotRequest = this.validationService.validate(CotValidation.UPDATE, request);
        const cot = await this.prismaService.cOT.findUnique({
            where: {
                id: cotId
            },
            include: {
                capabilityCots: true
            }
        });
    
        if(!cot) {
            throw new HttpException('COT tidak ditemukan', 404);
        }
    
        // Pisahkan data untuk tabel COT dan relasi CapabilityCOT
        const { capabilityId, ...cotData } = updateCotRequest;
    
         // Persiapkan transaksi untuk memastikan atomicity
        return await this.prismaService.$transaction(async (prisma) => {
            // 1. Update data COT
            await prisma.cOT.update({
                where: {
                    id: cotId
                },
                data: {
                    ...cotData,
                    // Jika ada capabilityId, update relasi CapabilityCOT
                    ...(capabilityId && {
                        capabilityCots: {
                            // Hapus relasi yang ada
                            deleteMany: {
                                cotId: cotId
                            },
                            // Buat relasi baru
                            create: {
                                capabilityId: capabilityId
                            }
                        }
                    })
                }
            });
        
            return 'COT berhasil diperbarui';
        });
    }

    async deleteCot(cotId: string): Promise<string> {
        const cot = await this.prismaService.cOT.findUnique({
            where : {
                id: cotId
            },
        });
    
        if(!cot) {
            throw new HttpException('COT tidak ditemukan', 404);
        }
    
        await this.prismaService.$transaction(async (prisma) => {
            // Hapus peserta terkait
            await prisma.participantsCOT.deleteMany({
                where: { cotId: cot.id },
            });
        
            // Hapus kemampuan terkait
            await prisma.capabilityCOT.deleteMany({
                where: { cotId: cot.id },
            });
        
            // Hapus COT
            await prisma.cOT.delete({
                where: { id: cot.id },
            });
        });        
    
        return 'Berhasil menghapus COT';
    }

    async listCot(request: ListRequest, user: CurrentUserRequest): Promise<{ data: CotResponse[], actions: ActionAccessRights, paging: Paging, info?: string }> {
        const userRole = user.role.name.toLowerCase();
        const dateFilter: any = {};
    
        // ✅ Fixed date filter logic - use OR for date range to be more inclusive
        if (request.startDate && request.endDate) {
            // Range: COTs that overlap with the specified range
            dateFilter.OR = [
                {
                    // COTs that start within the range
                    AND: [
                        { startDate: { gte: request.startDate } },
                        { startDate: { lte: request.endDate } }
                    ]
                },
                {
                    // COTs that end within the range
                    AND: [
                        { endDate: { gte: request.startDate } },
                        { endDate: { lte: request.endDate } }
                    ]
                },
                {
                    // COTs that span across the entire range
                    AND: [
                        { startDate: { lte: request.startDate } },
                        { endDate: { gte: request.endDate } }
                    ]
                }
            ];
        } else if (request.startDate) {
            dateFilter.OR = [
                { startDate: { equals: request.startDate } },
                { endDate: { equals: request.startDate } }
            ];
        } else if (request.endDate) {
            dateFilter.OR = [
                { startDate: { equals: request.endDate } },
                { endDate: { equals: request.endDate } }
            ];
        }
    
        // ✅ Simplified and working search logic
        let searchClause: any = {};
        if(request.searchQuery) {
            const searchQuery = request.searchQuery.trim();
            console.log('🔍 Search Query:', searchQuery);
            
            // Build search clauses for different fields
            const searchClauses: any[] = [];
            
            // 1. Search in trainingLocation (direct field)
            searchClauses.push({
                trainingLocation: {
                    contains: searchQuery,
                    mode: 'insensitive'
                }
            });
            
            // 2. Search in status (direct field)
            searchClauses.push({
                status: {
                    contains: searchQuery,
                    mode: 'insensitive'
                }
            });
            
            // 3. Search in capability ratingCode (nested field)
            searchClauses.push({
                capabilityCots: {
                    some: {
                        capability: {
                            ratingCode: {
                                contains: searchQuery,
                                mode: 'insensitive'
                            }
                        }
                    }
                }
            });
            
            // 4. Search in capability trainingName (nested field)
            searchClauses.push({
                capabilityCots: {
                    some: {
                        capability: {
                            trainingName: {
                                contains: searchQuery,
                                mode: 'insensitive'
                            }
                        }
                    }
                }
            });
            
            // 5. Check for date patterns (enhanced)
            const datePattern = EnhancedSearchHelper.parseSearchQuery(searchQuery);
            if (datePattern.isDateSearch && datePattern.dateQueries.length > 0) {
                console.log('🔍 Date search detected:', datePattern.dateQueries);
                
                // Add date search clauses
                for (const dateQuery of datePattern.dateQueries) {
                    const currentYear = new Date().getFullYear();
                    
                    if (dateQuery.type === 'combined-day-month') {
                        // Search for specific day and month in current year
                        const targetDate = new Date(currentYear, dateQuery.month - 1, dateQuery.day);
                        const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
                        
                        searchClauses.push({
                            OR: [
                                {
                                    startDate: {
                                        gte: targetDate,
                                        lt: nextDay
                                    }
                                },
                                {
                                    endDate: {
                                        gte: targetDate,
                                        lt: nextDay
                                    }
                                }
                            ]
                        });
                    } else if (dateQuery.type === 'year') {
                        // Search for specific year
                        const startOfYear = new Date(dateQuery.year, 0, 1);
                        const endOfYear = new Date(dateQuery.year + 1, 0, 1);
                        
                        searchClauses.push({
                            OR: [
                                {
                                    startDate: {
                                        gte: startOfYear,
                                        lt: endOfYear
                                    }
                                },
                                {
                                    endDate: {
                                        gte: startOfYear,
                                        lt: endOfYear
                                    }
                                }
                            ]
                        });
                    } else if (dateQuery.type === 'month') {
                        // Search for specific month in current year and next year
                        for (let year = currentYear; year <= currentYear + 1; year++) {
                            const startOfMonth = new Date(year, dateQuery.month - 1, 1);
                            const endOfMonth = new Date(year, dateQuery.month, 1);
                            
                            searchClauses.push({
                                OR: [
                                    {
                                        startDate: {
                                            gte: startOfMonth,
                                            lt: endOfMonth
                                        }
                                    },
                                    {
                                        endDate: {
                                            gte: startOfMonth,
                                            lt: endOfMonth
                                        }
                                    }
                                ]
                            });
                        }
                    } else if (dateQuery.type === 'day') {
                        // Enhanced day search - search for specific day in both startDate and endDate
                        const currentYear = new Date().getFullYear();
                        
                        // Search in all months of current year and next 2 years for comprehensive coverage
                        for (let year = currentYear; year <= currentYear + 2; year++) {
                            for (let month = 0; month < 12; month++) {
                                // Check if the day exists in this month
                                const targetDate = new Date(year, month, dateQuery.day);
                                if (targetDate.getDate() === dateQuery.day && targetDate.getMonth() === month) {
                                    const nextDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
                                    
                                    searchClauses.push({
                                        OR: [
                                            {
                                                startDate: {
                                                    gte: targetDate,
                                                    lt: nextDay
                                                }
                                            },
                                            {
                                                endDate: {
                                                    gte: targetDate,
                                                    lt: nextDay
                                                }
                                            }
                                        ]
                                    });
                                }
                            }
                        }
                    }
                }
            }
            
            // Combine all search clauses with OR
            if (searchClauses.length > 0) {
                searchClause = { OR: searchClauses };
            }
            
            console.log('🔍 Generated Search Clause:', JSON.stringify(searchClause, null, 2));
        }
    
        // ✅ Build whereCondition properly - handle multiple OR clauses
        let whereCondition: any = {};
        const conditions: any[] = [];
        
        // Base condition for user role
        if (userRole === 'user') {
            whereCondition.participantsCots = {
                some: {
                    participant: {
                        id: user.participantId,
                    },
                },
            };
        }
        
        // Combine date filter and search clause intelligently
        const hasDateFilter = Object.keys(dateFilter).length > 0;
        const hasSearchClause = Object.keys(searchClause).length > 0;
        
        if (hasDateFilter && hasSearchClause) {
            // Both date filter and search exist - combine with AND logic
            whereCondition.AND = [
                dateFilter,
                searchClause
            ];
        } else if (hasDateFilter) {
            // Only date filter
            whereCondition = { ...whereCondition, ...dateFilter };
        } else if (hasSearchClause) {
            // Only search clause
            whereCondition = { ...whereCondition, ...searchClause };
        }
        
        // ✅ Debug logging untuk whereCondition
        console.log('🔍 Final Where Condition:', JSON.stringify(whereCondition, null, 2));

        // Hitung total data untuk pagination
        const totalCot = await this.prismaService.cOT.count({
            where: whereCondition,
        });

        // Pagination parameters
        const page = request.page || 1;
        const size = request.size || 10;
        const totalPage = Math.ceil(totalCot / size);
    
        // ✅ Create sorting configuration
        const sortingConfig = SortingConfigBuilder.create()
            .allowFields(['startDate', 'endDate', 'trainingLocation', 'status', 'id', 'trainingName', 'ratingCode', 'numberOfParticipants'])
            .naturalSort(['trainingName', 'ratingCode'])
            .computedSort(['numberOfParticipants'])
            .databaseSort(['startDate', 'endDate', 'trainingLocation', 'status', 'id'])
            .defaultSort('startDate')
            .build();
        
        // ✅ Validate sorting with search awareness
        const sortingResult = SortingHelper.validateAndNormalizeSorting(
            request.sortBy,
            request.sortOrder,
            sortingConfig,
            request.searchQuery
        );
        
        const { sortBy, sortOrder, strategy, searchActive, fallbackReason } = sortingResult;
        
        // ✅ Debug logging untuk sorting
        console.log('🔍 Backend Sorting Debug:', {
            originalSortBy: request.sortBy,
            validatedSortBy: sortBy,
            originalSortOrder: request.sortOrder,
            validatedSortOrder: sortOrder,
            strategy: strategy,
            searchActive: searchActive,
            searchQuery: request.searchQuery,
            fallbackReason: fallbackReason
        });
        
        // Hybrid natural sort threshold
        const NATURAL_SORT_THRESHOLD = 100000;
        let infoMessage = undefined;

        let cot: any[];
        let cotResponses: CotResponse[];

        // Get field arrays from config for comparison
        const naturalSortFields = sortingConfig.naturalSortFields || [];
        const computedFields = sortingConfig.computedFields || [];
        const dbSortFields = sortingConfig.dbSortFields || [];
        
        // Only show info messages that are actually useful to users
        // Technical strategy messages are not user-relevant
        if (searchActive && fallbackReason && fallbackReason.includes('threshold')) {
            // Only show messages about performance fallbacks, not technical strategies
            infoMessage = `ℹ️ ${fallbackReason}`;
        }
        
        if ((naturalSortFields.includes(sortBy) || computedFields.includes(sortBy))) {
          // Hitung total sesuai role dan filter (bukan total seluruh DB)
          if (totalCot < NATURAL_SORT_THRESHOLD) {
            // Natural sort global: ambil semua data, sort, pagination manual
            cot = await this.prismaService.cOT.findMany({
              where: whereCondition,
              include: {
                capabilityCots: {
                  select: {
                    capability: {
                      select: {
                        id: true,
                        ratingCode: true,
                        trainingName: true,
                      },
                    },
                  },
                },
                _count: {
                  select: {
                    participantsCots: true
                  }
                },
              },
              orderBy: { startDate: 'asc' },
            });
            cotResponses = cot.map(this.formatCotList);
            // Application level sorting
            if (naturalSortFields.includes(sortBy)) {
              cotResponses.sort((a, b) => {
                const aValue = a.capability?.[sortBy] || '';
                const bValue = b.capability?.[sortBy] || '';
                return naturalSort(aValue, bValue, sortOrder);
              });
            } else if (sortBy === 'numberOfParticipants') {
              cotResponses.sort((a, b) => {
                const aValue = a.numberOfParticipants || 0;
                const bValue = b.numberOfParticipants || 0;
                return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
              });
            }
            // Pagination manual
            cotResponses = cotResponses.slice((page - 1) * size, page * size);
          } else {
            // Fallback ke DB sort, gunakan field yang valid (misal: startDate)
            infoMessage = `info: Natural sort hanya tersedia untuk data < ${NATURAL_SORT_THRESHOLD}. Untuk data besar, data diurutkan berdasarkan startDate.`;
            const orderBy: any = {};
            orderBy['startDate'] = sortOrder; // fallback ke field DB yang valid
            cot = await this.prismaService.cOT.findMany({
              where: whereCondition,
              include: {
                capabilityCots: {
                  select: {
                    capability: {
                      select: {
                        id: true,
                        ratingCode: true,
                        trainingName: true,
                      },
                    },
                  },
                },
                _count: {
                  select: {
                    participantsCots: true
                  }
                },
              },
              orderBy,
              skip: (page - 1) * size,
              take: size,
            });
            cotResponses = cot.map(this.formatCotList);
          }
          const actions = this.validateActions(userRole);
          return {
            data: cotResponses,
            actions: actions,
            paging: {
              currentPage: page,
              totalPage: totalPage,
              size: size,
            },
            info: infoMessage,
          };
        } else {
            // Untuk field biasa, gunakan DB sorting dan pagination
            const orderBy: any = {};
            orderBy[sortBy] = sortOrder;
            
            // ✅ Debug logging untuk orderBy
            console.log('🔍 Backend OrderBy Debug:', {
                sortBy,
                sortOrder,
orderBy,
              skip: (page - 1) * size,
              take: size,
                isDatabaseSort: !['trainingName', 'ratingCode', 'numberOfParticipants'].includes(sortBy)
            });
            
            cot = await this.prismaService.cOT.findMany({
                where: whereCondition,
                include: {
                    capabilityCots: {
                        select: {
                            capability: {
                                select: {
                                    id: true,
                                    ratingCode: true,
                                    trainingName: true,
                                },
                            },
                        },
                    },
                    _count: {
                      select: {
                          participantsCots: true
                      }
                  },
                },
                orderBy,
                skip: (page - 1) * size,
                take: size,
            });
            
            // Mapping hasil query ke bentuk CotResponse
            const cotResponses: CotResponse[] = cot.map(this.formatCotList);
            console.log(cotResponses);
            
            const actions = this.validateActions(userRole);
            
            return {
                data: cotResponses,
                actions: actions,
                paging: {
                    currentPage: page,
                    totalPage: totalPage,
                    size: size,
                },
            };
        }
    }

    private formatCotList(cot: any): CotResponse {
        return {
            id: cot.id,
            startDate: cot.startDate,
            endDate: cot.endDate,
            numberOfParticipants: cot._count.participantsCots,
            trainingLocation: cot.trainingLocation,
            capability: cot.capabilityCots[0]?.capability
                ? {
                    id: cot.capabilityCots[0].capability.id,
                    ratingCode: cot.capabilityCots[0].capability.ratingCode,
                    trainingName: cot.capabilityCots[0].capability.trainingName
                }
                : null // Jika tidak ada capability, set null
        };
    }

    async getDashboardStats(year: number, user: CurrentUserRequest): Promise<DashboardStatsResponse> {
        const userRole = user.role.name.toLowerCase();
        
        // Date range for the target year
        const startOfYear = new Date(year, 0, 1);
        const endOfYear = new Date(year, 11, 31, 23, 59, 59);
        
        // Base where clause considering user role
        const baseWhereClause = userRole === 'user' ? {
            participantsCots: {
                some: {
                    participant: {
                        id: user.participantId,
                    },
                },
            },
        } : userRole === 'lcu' ? {
            participantsCots: {
                some: {
                    participant: {
                        dinas: user.dinas,
                    },
                },
            },
        } : {};
        
        // Get all COTs for the year with status updates
        const allCots = await this.prismaService.cOT.findMany({
            where: {
                ...baseWhereClause,
                OR: [
                    {
                        startDate: {
                            gte: startOfYear,
                            lte: endOfYear,
                        },
                    },
                    {
                        endDate: {
                            gte: startOfYear,
                            lte: endOfYear,
                        },
                    },
                ],
            },
            select: {
                id: true,
                startDate: true,
                endDate: true,
                status: true,
            },
        });
        
        // Update status for all COTs based on current date
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const updatedCots = await Promise.all(
            allCots.map(async (cot) => {
                let newStatus = cot.status;
                
                if (cot.startDate > today) {
                    newStatus = 'Akan datang';
                } else if (cot.startDate <= today && cot.endDate > today) {
                    newStatus = 'Sedang berjalan';
                } else if (cot.endDate < today) {
                    newStatus = 'Selesai';
                }
                
                // Update status if changed
                if (newStatus !== cot.status) {
                    await this.prismaService.cOT.update({
                        where: { id: cot.id },
                        data: { status: newStatus },
                    });
                }
                
                return {
                    ...cot,
                    status: newStatus,
                };
            })
        );
        
        // Initialize monthly stats
        const monthlyStats: MonthlyStats[] = Array.from({ length: 12 }, (_, i) => ({
            month: i + 1,
            akanDatang: 0,
            sedangBerjalan: 0,
            selesai: 0,
            total: 0,
        }));
        
        // Process each COT and count by month
        updatedCots.forEach((cot) => {
            const startMonth = cot.startDate.getMonth(); // 0-11
            const endMonth = cot.endDate.getMonth(); // 0-11
            
            // Count based on start month primarily
            const targetMonth = startMonth;
            
            if (monthlyStats[targetMonth]) {
                monthlyStats[targetMonth].total++;
                
                switch (cot.status) {
                    case 'Akan datang':
                        monthlyStats[targetMonth].akanDatang++;
                        break;
                    case 'Sedang berjalan':
                        monthlyStats[targetMonth].sedangBerjalan++;
                        break;
                    case 'Selesai':
                        monthlyStats[targetMonth].selesai++;
                        break;
                }
            }
        });
        
        // Calculate total stats
        const totalStats = {
            akanDatang: monthlyStats.reduce((sum, month) => sum + month.akanDatang, 0),
            sedangBerjalan: monthlyStats.reduce((sum, month) => sum + month.sedangBerjalan, 0),
            selesai: monthlyStats.reduce((sum, month) => sum + month.selesai, 0),
            total: monthlyStats.reduce((sum, month) => sum + month.total, 0),
        };
        
        // Get available years from database
        const availableYearsQuery = await this.prismaService.cOT.findMany({
            where: baseWhereClause,
            select: {
                startDate: true,
            },
            orderBy: {
                startDate: 'asc',
            },
        });
        
        const availableYears = Array.from(
            new Set(
                availableYearsQuery.map((cot) => cot.startDate.getFullYear())
            )
        ).sort((a, b) => b - a); // Sort descending (newest first)
        
        return {
            year,
            monthlyStats,
            totalStats,
            availableYears,
        };
    }

    private validateActions(userRole: string): ActionAccessRights {
        const accessMap = {
            'super admin': { canEdit: true, canDelete: true, canView: true },
            'supervisor': { canEdit: false, canDelete: false, canView: true },
            'lcu': { canEdit: false, canDelete: false, canView: true },
            'user': { canEdit: false, canDelete: false, canView: true },
        }
    
        return this.coreHelper.validateActions(userRole, accessMap);
    }
}