import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/service/prisma.service';
import { ValidationService } from 'src/common/service/validation.service';
import { CurrentUserRequest } from 'src/model/auth.model';
import {
  addParticipantToCot,
  ParticipantCotResponse,
} from 'src/model/participant-cot.model';
import { ListParticipantResponse } from 'src/model/participant.model';
import { ActionAccessRights, ListRequest, Paging } from 'src/model/web.model';
import { ParticipantCotValidation } from './participant-cot.validation';
import { CoreHelper } from 'src/common/helpers/core.helper';

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

    // Construct base where clause
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

    // Add search filters if provided
    if (request.searchQuery) {
      baseWhereClause.AND.push({
        OR: [
          { idNumber: { contains: request.searchQuery, mode: 'insensitive' } },
          { name: { contains: request.searchQuery, mode: 'insensitive' } },
          { dinas: { contains: request.searchQuery, mode: 'insensitive' } },
          { company: { contains: request.searchQuery, mode: 'insensitive' } },
        ],
      });
    }

    const [unregisteredParticipants, totalParticipants] = await Promise.all([
      this.prismaService.participant.findMany({
        where: baseWhereClause,
        select: {
          id: true,
          idNumber: true,
          name: true,
          dinas: true,
          bidang: true,
          company: true,
        },
        skip: (request.page - 1) * request.size,
        take: request.size,
      }),
      this.prismaService.participant.count({ where: baseWhereClause }),
    ]);

    const totalPage = Math.ceil(totalParticipants / request.size);

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
  ): Promise<string> {
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

    // Filter hanya ID yang valid
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

    const participantData = newParticipantIds.map((participantId) => ({
      participantId,
      cotId,
    }));

    await this.prismaService.participantsCOT.createMany({
      data: participantData,
    });

    return `${newParticipantIds.length} participant berhasil ditambahkan`;
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
        ],
      };
    }

    const participantSelect = {
      id: true,
      idNumber: true,
      name: true,
      dinas: true,
      // hanya tambahkan simB, simA, tglKeluarSuratSehatButaWarna, dan tglKeluarSuratBebasNarkoba jika bukan role 'user'
      ...(userRole !== 'user' && {
        simB: true,
        simA: true,
        tglKeluarSuratSehatButaWarna: true,
        tglKeluarSuratBebasNarkoba: true,
      }),
    };

    const participantCot = await this.prismaService.cOT.findUnique({
      where: { id: cotId },
      include: {
        participantsCots: {
          where:
            userRole === 'lcu'
              ? {
                  participantId: { not: null },
                  participant: {
                    dinas: user.dinas,
                    ...participantCotWhereClause,
                  },
                }
              : {
                  participantId: { not: null },
                  participant: participantCotWhereClause,
                },
          select: {
            participant: {
              select: participantSelect,
            },
          },
          skip: (request.page - 1) * request.size,
          take: request.size,
        },
        _count: { select: { participantsCots: true } },
      },
    });

    if (!participantCot) {
      throw new HttpException('COT tidak ditemukan', 404);
    }

    // Validasi akses untuk user
    if (isUser) {
      const isParticipantLinked =
        await this.prismaService.participantsCOT.count({
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

    const totalParticipants = participantCot._count.participantsCots;
    const totalPage = Math.ceil(totalParticipants / request.size);

    const participants = participantCot.participantsCots
      .map((pc) => pc.participant)
      .filter((p) => p !== null)
      .map((participant) => {
        const participantData = {
          ...participant,
          // Jika role bukan 'user', simB dan simA akan tetap ada
          ...(userRole !== 'user' && {
            simB: !!participant.simB,
            simA: !!participant.simA,
          }),
        };
        return participantData;
      });

    const actions = this.validateActions(userRole);

    const response: ParticipantCotResponse = {
      cot: {
        id: participantCot.id,
        startDate: participantCot.startDate,
        endDate: participantCot.endDate,
        trainingLocation: participantCot.trainingLocation,
        theoryInstructorRegGse: participantCot.theoryInstructorRegGse,
        theoryInstructorCompetency: participantCot.theoryInstructorCompetency,
        practicalInstructor1: participantCot.practicalInstructor1,
        practicalInstructor2: participantCot.practicalInstructor2,
        totalParticipants,
        status: participantCot.status,
        participants: {
          data: participants,
          paging: {
            currentPage: request.page,
            totalPage,
            size: request.size,
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

    // Jika tidak ada data yang dihapus
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
}
