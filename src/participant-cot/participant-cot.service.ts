import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/service/prisma.service';
import { ValidationService } from 'src/common/service/validation.service';
import { CurrentUserRequest } from 'src/model/auth.model';
import {
  addParticipantToCot,
  ParticipantCotResponse,
  AddParticipantResponse,
} from 'src/model/participant-cot.model';
import { ListParticipantResponse } from 'src/model/participant.model';
import { ActionAccessRights, ListRequest, Paging } from 'src/model/web.model';
import { ParticipantCotValidation } from './participant-cot.validation';
import { CoreHelper } from 'src/common/helpers/core.helper';
import { naturalSort } from '../common/helpers/natural-sort';

@Injectable()
export class ParticipantCotService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly validationService: ValidationService,
    private readonly coreHelper: CoreHelper,
  ) {}

  async getUnregisteredParticipants(
    cotId: string,
    user: CurrentUserRequest,
    request: ListRequest,
  ): Promise<{ data: ListParticipantResponse[]; paging: Paging }> {
    const userRole = user.role.name.toLowerCase();

    const currentCot = await this.prismaService.cOT.findUnique({
      where: { id: cotId },
      include: { capabilityCots: true },
    });

    if (!currentCot) {
      throw new Error('COT not found');
    }

    const capabilityIds = currentCot.capabilityCots.map(
      (cc) => cc.capabilityId,
    );
    const { startDate, endDate } = currentCot;

    const baseWhereClause: any = {
      AND: [],
      NOT: {
        participantsCots: {
          some: { cotId: cotId },
        },
      },
      ...(userRole === 'lcu' && {
        dinas: {
          equals: user.dinas,
          mode: 'insensitive',
        },
      }),
    };

    if (request.searchQuery) {
      baseWhereClause.AND.push({
        OR: [
          { idNumber: { contains: request.searchQuery, mode: 'insensitive' } },
          { name: { contains: request.searchQuery, mode: 'insensitive' } },
          { dinas: { contains: request.searchQuery, mode: 'insensitive' } },
          { company: { contains: request.searchQuery, mode: 'insensitive' } },
          { bidang: { contains: request.searchQuery, mode: 'insensitive' } },
        ],
      });
    }

    // Count total participants for pagination
    const totalParticipants = await this.prismaService.participant.count({ where: baseWhereClause });
    const totalPage = Math.ceil(totalParticipants / request.size);

    // Sorting configuration
    const allowedSortFields = ['idNumber', 'name', 'dinas', 'bidang', 'company', 'id'];
    const naturalSortFields = ['idNumber', 'name', 'company', 'dinas', 'bidang'];
    let sortBy = request.sortBy && allowedSortFields.includes(request.sortBy) ? request.sortBy : 'idNumber';
    let sortOrder: 'asc' | 'desc' = request.sortOrder === 'desc' ? 'desc' : 'asc';

    const participantSelect = {
      id: true,
      idNumber: true,
      name: true,
      dinas: true,
      bidang: true,
      company: true,
    };

    let unregisteredParticipants: any[];

    // Apply sorting strategy based on field type
    if (naturalSortFields.includes(sortBy)) {
      // Natural sort: fetch all data, sort manually, then paginate
      const allParticipants = await this.prismaService.participant.findMany({
        where: baseWhereClause,
        select: participantSelect,
      });

      // Sort manually with natural sort
      const sortedParticipants = allParticipants.sort((a, b) => 
        naturalSort(a[sortBy] || '', b[sortBy] || '', sortOrder)
      );

      // Manual pagination after sorting
      unregisteredParticipants = sortedParticipants.slice(
        (request.page - 1) * request.size,
        request.page * request.size
      );
    } else {
      // For regular fields, use database sorting and pagination
      let orderBy: any;
      if (sortBy !== 'id') {
        orderBy = [
          { [sortBy]: sortOrder },
          { id: 'asc' }
        ];
      } else {
        orderBy = { id: sortOrder };
      }

      unregisteredParticipants = await this.prismaService.participant.findMany({
        where: baseWhereClause,
        select: participantSelect,
        orderBy,
        skip: (request.page - 1) * request.size,
        take: request.size,
      });
    }

    return {
      data: unregisteredParticipants,
      paging: {
        currentPage: request.page,
        totalPage: totalPage,
        size: request.size,
      },
    };
  }

  async addParticipantToCot(
    cotId: string,
    user: CurrentUserRequest,
    request: addParticipantToCot,
  ): Promise<AddParticipantResponse> {
    const AddParticipantToCotRequest = this.validationService.validate(
      ParticipantCotValidation.ADD,
      request,
    );

    const userRole = user.role.name.toLowerCase();

    const cot = await this.prismaService.cOT.findUnique({
      where: { id: cotId },
      include: { capabilityCots: true },
    });

    if (!cot) {
      throw new HttpException('COT tidak ditemukan', 404);
    }

    if (cot.status === 'Selesai') {
      throw new HttpException('Tidak dapat menambah peserta ke COT yang sudah selesai', 400);
    }

    const participants = await this.prismaService.participant.findMany({
      where: {
        id: { in: AddParticipantToCotRequest.participantIds },
        ...(userRole === 'lcu' && {
          dinas: user.dinas,
        }),
      },
    });

    const validParticipantIds = participants.map((p) => p.id);

    if (
      userRole === 'lcu' &&
      validParticipantIds.length !==
        AddParticipantToCotRequest.participantIds.length
    ) {
      throw new HttpException(
        `LCU hanya dapat menambahkan participant dari dinas yang sama (${user.dinas})`,
        403,
      );
    }

    if (validParticipantIds.length === 0) {
      throw new HttpException(
        'Tidak ada participant yang valid ditemukan',
        404,
      );
    }

    const overlappingParticipants =
      await this.prismaService.participantsCOT.findMany({
        where: {
          participantId: { in: validParticipantIds },
          cot: {
            capabilityCots: {
              some: {
                capabilityId: {
                  in: cot.capabilityCots.map((cc) => cc.capabilityId),
                },
              },
            },
            OR: [
              {
                startDate: { lte: cot.endDate },
                endDate: { gte: cot.startDate },
              },
            ],
          },
        },
        include: { cot: true },
      });

    if (overlappingParticipants.length > 0) {
      const overlappingIds = overlappingParticipants.map(
        (op) => op.participantId,
      );
      throw new HttpException(
        `Participant dengan ID berikut tidak dapat didaftarkan karena jadwal bertabrakan: ${overlappingIds.join(', ')}`,
        400,
      );
    }

    const existingParticipants =
      await this.prismaService.participantsCOT.findMany({
        where: {
          cotId,
          participantId: { in: validParticipantIds },
        },
      });

    const existingParticipantIds = existingParticipants.map(
      (p) => p.participantId,
    );
    const newParticipantIds = validParticipantIds.filter(
      (id) => !existingParticipantIds.includes(id),
    );

    if (newParticipantIds.length === 0) {
      throw new HttpException(
        'Semua participant yang valid sudah terdaftar di COT ini',
        400,
      );
    }

    console.log('Sebelum menambah peserta:', await this.prismaService.participantsCOT.findMany({ where: { cotId } }));

    const participantData = newParticipantIds.map((participantId) => ({
      participantId,
      cotId,
    }));

    await this.prismaService.participantsCOT.createMany({
      data: participantData,
    });

    console.log('Setelah menambah peserta:', await this.prismaService.participantsCOT.findMany({ where: { cotId } }));

    const updatedCount = await this.prismaService.participantsCOT.count({
      where: {
        cotId,
        participantId: { not: null },
      },
    });

    return {
      message: `${newParticipantIds.length} participant berhasil ditambahkan`,
      updatedCount,
      addedParticipants: newParticipantIds,
    };
  }

  async listParticipantsCot(
    cotId: string,
    user: CurrentUserRequest,
    request: ListRequest,
  ): Promise<ParticipantCotResponse> {
    const userRole = user.role.name.toLowerCase();

    const isUser = userRole === 'user';

    let participantCotWhereClause: any = {};
    if (request.searchQuery) {
      const query = request.searchQuery.toLowerCase();
      participantCotWhereClause = {
        OR: [
          { idNumber: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
          { dinas: { contains: query, mode: 'insensitive' } },
          { company: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
          { bidang: { contains: query, mode: 'insensitive' } },
        ],
      };
    }

    const participantSelect = {
      id: true,
      idNumber: true,
      name: true,
      dinas: true,
      bidang: true,
      company: true,
      email: true,
      phoneNumber: true,
      nationality: true,
      placeOfBirth: true,
      dateOfBirth: true,
      simAPath: true,
      simAFileName: true,
      simBPath: true,
      simBFileName: true,
      ktpPath: true,
      ktpFileName: true,
      fotoPath: true,
      fotoFileName: true,
      suratSehatButaWarnaPath: true,
      suratSehatButaWarnaFileName: true,
      suratBebasNarkobaPath: true,
      suratBebasNarkobaFileName: true,
      tglKeluarSuratSehatButaWarna: true,
      tglKeluarSuratBebasNarkoba: true,
      gmfNonGmf: true,
      qrCodePath: true,
    };

    // Validasi akses user terlebih dahulu
    if (isUser) {
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

    // Ambil data COT dan capability terlebih dahulu
    const cot = await this.prismaService.cOT.findUnique({
      where: { id: cotId },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        trainingLocation: true,
        theoryInstructorRegGse: true,
        theoryInstructorCompetency: true,
        practicalInstructor1: true,
        practicalInstructor2: true,
        status: true,
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
      },
    });

    if (!cot) {
      throw new HttpException('COT tidak ditemukan', 404);
    }

    // Hitung total participants untuk pagination
    const totalParticipants = await this.prismaService.participantsCOT.count({
      where: {
        cotId: cotId,
        participantId: { not: null },
        participant: userRole === 'lcu' 
          ? { dinas: user.dinas, ...participantCotWhereClause }
          : participantCotWhereClause,
      },
    });

    // Pagination parameters
    const page = request.page || 1;
    const size = request.size || 10;
    const totalPage = Math.ceil(totalParticipants / size);

    // Sorting universal
    const allowedSortFields = ['idNumber', 'name', 'dinas', 'bidang', 'company', 'email', 'id', 'expSuratSehatButaWarna', 'expSuratBebasNarkoba'];
    const naturalSortFields = ['idNumber', 'name', 'company', 'dinas', 'bidang', 'email'];
    const dateFields = ['expSuratSehatButaWarna', 'expSuratBebasNarkoba'];
    let sortBy = request.sortBy && allowedSortFields.includes(request.sortBy) ? request.sortBy : 'idNumber';
    let sortOrder: 'asc' | 'desc' = request.sortOrder === 'desc' ? 'desc' : 'asc';

    // Optimasi: Strategi berbeda berdasarkan field type
    let participants: any[];
    
    if (naturalSortFields.includes(sortBy)) {
      // Natural sort global: ambil seluruh data, sort, lalu pagination manual
      const allParticipants = await this.prismaService.participantsCOT.findMany({
        where: {
          cotId: cotId,
          participantId: { not: null },
          participant: userRole === 'lcu' 
            ? { dinas: user.dinas, ...participantCotWhereClause }
            : participantCotWhereClause,
        },
        select: {
          participant: {
            select: participantSelect,
          },
        },
      });

      // Sort manual dengan natural sort
      participants = allParticipants
        .map((pc) => pc.participant)
        .filter((p) => p !== null)
        .sort((a, b) => naturalSort(a[sortBy] || '', b[sortBy] || '', sortOrder));

      // Pagination manual setelah sorting
      participants = participants.slice((page - 1) * size, page * size);
    } else if (dateFields.includes(sortBy)) {
      // Date sort global: ambil seluruh data, sort berdasarkan tanggal, lalu pagination manual
      const allParticipants = await this.prismaService.participantsCOT.findMany({
        where: {
          cotId: cotId,
          participantId: { not: null },
          participant: userRole === 'lcu' 
            ? { dinas: user.dinas, ...participantCotWhereClause }
            : participantCotWhereClause,
        },
        select: {
          participant: {
            select: participantSelect,
          },
        },
      });

      // Sort manual berdasarkan tanggal
      participants = allParticipants
        .map((pc) => pc.participant)
        .filter((p) => p !== null)
        .sort((a, b) => {
          let aDate: Date | null = null;
          let bDate: Date | null = null;
          
          if (sortBy === 'expSuratSehatButaWarna') {
            aDate = a.tglKeluarSuratSehatButaWarna ? new Date(a.tglKeluarSuratSehatButaWarna) : null;
            bDate = b.tglKeluarSuratSehatButaWarna ? new Date(b.tglKeluarSuratSehatButaWarna) : null;
          } else if (sortBy === 'expSuratBebasNarkoba') {
            aDate = a.tglKeluarSuratBebasNarkoba ? new Date(a.tglKeluarSuratBebasNarkoba) : null;
            bDate = b.tglKeluarSuratBebasNarkoba ? new Date(b.tglKeluarSuratBebasNarkoba) : null;
          }
          
          // Handle null values - put them at the end
          if (!aDate && !bDate) return 0;
          if (!aDate) return 1;
          if (!bDate) return -1;
          
          const comparison = aDate.getTime() - bDate.getTime();
          return sortOrder === 'asc' ? comparison : -comparison;
        });

      // Pagination manual setelah sorting
      participants = participants.slice((page - 1) * size, page * size);
    } else {
      // Untuk field biasa, gunakan DB sorting dan pagination
      let orderBy: any;
      if (sortBy !== 'id') {
        orderBy = [
          { participant: { [sortBy]: sortOrder } },
          { participant: { id: 'asc' } }
        ];
      } else {
        orderBy = { participant: { id: sortOrder } };
      }

      const participantCots = await this.prismaService.participantsCOT.findMany({
        where: {
          cotId: cotId,
          participantId: { not: null },
          participant: userRole === 'lcu' 
            ? { dinas: user.dinas, ...participantCotWhereClause }
            : participantCotWhereClause,
        },
        select: {
          participant: {
            select: participantSelect,
          },
        },
        orderBy,
        skip: (page - 1) * size,
        take: size,
      });

      participants = participantCots
        .map((pc) => pc.participant)
        .filter((p) => p !== null);
    }

    const actions = this.validateActions(userRole);
    const capability = cot.capabilityCots[0]?.capability || {
      ratingCode: '',
      trainingName: '',
    };
    const response: ParticipantCotResponse = {
      cot: {
        id: cot.id,
        startDate: cot.startDate,
        endDate: cot.endDate,
        trainingLocation: cot.trainingLocation,
        theoryInstructorRegGse: cot.theoryInstructorRegGse,
        theoryInstructorCompetency: cot.theoryInstructorCompetency,
        practicalInstructor1: cot.practicalInstructor1,
        practicalInstructor2: cot.practicalInstructor2,
        totalParticipants,
        status: cot.status,
        capability: {
          ratingCode: capability.ratingCode,
          trainingName: capability.trainingName,
        },
        participants: {
          data: participants.map((p) => this.toParticipantCotResponse(p)),
          paging: {
            currentPage: page,
            totalPage: totalPage,
            size: size,
          },
          actions,
        },
      },
    };
    return response;
  }

  async deleteParticipantFromCot(
    participantId: string,
    cotId: string,
  ): Promise<string> {
    const deletedParticipantFromCot =
      await this.prismaService.participantsCOT.deleteMany({
        where: {
          AND: [
            { participantId: { not: null, equals: participantId } },
            { cotId: cotId },
          ],
        },
      });

    if (deletedParticipantFromCot.count === 0) {
      throw new HttpException('Data tidak ditemukan', 404);
    }

    return 'Participant berhasil dihapus dari COT';
  }

  private validateActions(userRole: string): ActionAccessRights {
    const accessMap = {
      'super admin': { canPrint: true, canDelete: true, canView: true },
      supervisor: { canPrint: false, canDelete: false, canView: true },
      lcu: { canPrint: false, canDelete: true, canView: true },
      user: { canPrint: false, canDelete: false, canView: false },
    };

    return this.coreHelper.validateActions(userRole, accessMap);
  }

  private toParticipantCotResponse(participant: any): {
    name: string;
    id: string;
    idNumber: string;
    dinas: string;
    simA?: boolean;
    simB?: boolean;
    tglKeluarSuratSehatButaWarna?: Date;
    tglKeluarSuratBebasNarkoba?: Date;
  } {
    return {
      name: participant.name,
      id: participant.id,
      idNumber: participant.idNumber,
      dinas: participant.dinas,
      simA: participant.simAPath ? true : false,
      simB: participant.simBPath ? true : false,
      tglKeluarSuratSehatButaWarna: participant.tglKeluarSuratSehatButaWarna,
      tglKeluarSuratBebasNarkoba: participant.tglKeluarSuratBebasNarkoba,
    };
  }
}
