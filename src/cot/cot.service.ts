import { HttpException, Injectable } from "@nestjs/common";
import { PrismaService } from "src/common/service/prisma.service";
import { ValidationService } from "src/common/service/validation.service";
import { CotResponse, CreateCot, UpdateCot } from "src/model/cot.model";
import { CotValidation } from "./cot.validation";
import { ActionAccessRights, ListRequest, Paging } from "src/model/web.model";
import { CurrentUserRequest } from "src/model/auth.model";
import { CoreHelper } from "src/common/helpers/core.helper";
import { naturalSort } from '../common/helpers/natural-sort';

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

    async listCot(request: ListRequest, user: CurrentUserRequest): Promise<{ data: CotResponse[], actions: ActionAccessRights, paging: Paging }> {
        const userRole = user.role.name.toLowerCase();
        const dateFilter: any = {};
    
        if (request.startDate && request.endDate) {
            // Range
            dateFilter.AND = [
                {
                    startDate: {
                        gte: request.startDate,
                    },
                },
                {
                    endDate: {
                        lte: request.endDate,
                    },
                },
            ];
        } else if (request.startDate) {
            dateFilter.startDate = {
                equals: request.startDate
            };
        } else if (request.endDate) {
            dateFilter.endDate = {
                equals: request.endDate
            };
        }
    
        let whereClauseCapability: any = {};
        if(request.searchQuery) {
            const searchQuery = request.searchQuery;
            whereClauseCapability.OR = [
                { ratingCode: { contains: searchQuery, mode: 'insensitive' } },
                { trainingName: { contains: searchQuery, mode: 'insensitive' } },
            ]
        }
    
        const whereCondition = userRole === 'user' ? {
            participantsCots: {
                some: {
                    participant: {
                        id: user.participantId,
                    },
                    ...dateFilter,
                },
            },
            capabilityCots: {
                some: {
                    capability: whereClauseCapability,
                },
            },
        } : {
            ...dateFilter,
            capabilityCots: {
                some: {
                    capability: whereClauseCapability,
                },
            },
        };

        // Hitung total data untuk pagination
        const totalCot = await this.prismaService.cOT.count({
            where: whereCondition,
        });

        // Pagination parameters
        const page = request.page || 1;
        const size = request.size || 10;
        const totalPage = Math.ceil(totalCot / size);
    
        // ✅ Sorting universal dengan field yang benar dari database
        const allowedSortFields = ['startDate', 'endDate', 'trainingLocation', 'status', 'id', 'trainingName', 'ratingCode', 'numberOfParticipants'];
        const naturalSortFields = ['trainingName', 'ratingCode'];
        const computedFields = ['numberOfParticipants'];
        const dbSortFields = ['startDate', 'endDate', 'trainingLocation', 'status', 'id'];
        
        let sortBy = request.sortBy && allowedSortFields.includes(request.sortBy) ? request.sortBy : 'startDate';
        let sortOrder: "asc" | "desc" = request.sortOrder === 'desc' ? 'desc' : 'asc';
        
        // ✅ Debug logging untuk sorting
        console.log('🔍 Backend Sorting Debug:', {
            originalSortBy: request.sortBy,
            validatedSortBy: sortBy,
            originalSortOrder: request.sortOrder,
            validatedSortOrder: sortOrder,
            allowedFields: allowedSortFields,
            isAllowed: allowedSortFields.includes(request.sortBy || '')
        });
        
        let cot: any[];
        
        // Optimasi: Strategi berbeda berdasarkan field type
        if (naturalSortFields.includes(sortBy) || computedFields.includes(sortBy)) {
            // Untuk field yang perlu natural sort atau computed, ambil semua data dulu
            cot = await this.prismaService.cOT.findMany({
                where: whereCondition,
                include: {
                    capabilityCots: {
                        select: {
                            capability: {
                                select: {
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
                orderBy: { startDate: 'asc' }, // Default sorting untuk konsistensi
            });
            
            // Mapping hasil query ke bentuk CotResponse
            let cotResponses: CotResponse[] = cot.map(this.formatCotList);
            
            // Application level sorting untuk field capability dan computed fields
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
                    if (sortOrder === 'asc') {
                        return aValue - bValue;
                    } else {
                        return bValue - aValue;
                    }
                });
            }
            
            // Pagination manual setelah sorting
            cotResponses = cotResponses.slice((page - 1) * size, page * size);
            
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
        } else {
            // Untuk field biasa, gunakan DB sorting dan pagination
            const orderBy: any = {};
            orderBy[sortBy] = sortOrder;
            
            // ✅ Debug logging untuk orderBy
            console.log('🔍 Backend OrderBy Debug:', {
                sortBy,
                sortOrder,
                orderBy,
                isDatabaseSort: !['trainingName', 'ratingCode', 'numberOfParticipants'].includes(sortBy)
            });
            
            cot = await this.prismaService.cOT.findMany({
                where: whereCondition,
                include: {
                    capabilityCots: {
                        select: {
                            capability: {
                                select: {
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
                    ratingCode: cot.capabilityCots[0].capability.ratingCode,
                    trainingName: cot.capabilityCots[0].capability.trainingName
                }
                : null // Jika tidak ada capability, set null
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