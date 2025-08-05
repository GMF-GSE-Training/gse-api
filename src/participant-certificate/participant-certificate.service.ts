import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/service/prisma.service';
import { CurrentUserRequest } from 'src/model/auth.model';
import { ListRequest, Paging } from 'src/model/web.model';
import { naturalSort } from '../common/helpers/natural-sort';

export interface CertificateResponse {
  id: string;
  trainingName: string;
  expiryDate: Date;
  certificateNumber?: string;
  status: string;
}

@Injectable()
export class ParticipantCertificateService {
  constructor(
    private readonly prismaService: PrismaService,
  ) {}

  async listParticipantCertificates(
    participantId: string,
    user: CurrentUserRequest,
    request: ListRequest,
  ): Promise<{ data: CertificateResponse[], paging: Paging }> {
    // Validasi akses participant
    const participant = await this.prismaService.participant.findUnique({
      where: { id: participantId },
    });

    if (!participant) {
      throw new Error('Participant not found');
    }

    const userRole = user.role.name.toLowerCase();
    
    // Validasi akses berdasarkan role
    if (userRole === 'user' && user.participantId !== participantId) {
      throw new Error('Access denied');
    }

    if (userRole === 'lcu' && participant.dinas !== user.dinas) {
      throw new Error('LCU can only access participants from the same dinas');
    }

    // Ambil data sertifikat actual dari tabel Certificate
    // Hanya tampilkan sertifikat dari COT yang sudah selesai
    let whereClause: any = {
      participantId: participantId,
      cot: {
        status: 'Selesai', // Hanya COT yang sudah selesai
      },
    };

    if (request.searchQuery) {
      whereClause.cot = {
        ...whereClause.cot, // Preserve existing COT filters (like status)
        capabilityCots: {
          some: {
            capability: {
              OR: [
                { trainingName: { contains: request.searchQuery, mode: 'insensitive' } },
                { ratingCode: { contains: request.searchQuery, mode: 'insensitive' } },
              ],
            },
          },
        },
      };
    }

    // Hitung total untuk pagination
    const totalCertificates = await this.prismaService.certificate.count({
      where: whereClause,
    });

    const page = request.page || 1;
    const size = request.size || 10;
    const totalPage = Math.ceil(totalCertificates / size);

    // Sorting universal
    const allowedSortFields = ['trainingName', 'expiryDate', 'certificateNumber', 'status'];
    const naturalSortFields = ['trainingName', 'certificateNumber'];
    const dateFields = ['expiryDate'];
    
    let sortBy = request.sortBy && allowedSortFields.includes(request.sortBy) ? request.sortBy : 'trainingName';
    let sortOrder: 'asc' | 'desc' = request.sortOrder === 'desc' ? 'desc' : 'asc';

    let certificates: any[];

    if (naturalSortFields.includes(sortBy)) {
      // Natural sort global: ambil seluruh data, sort, lalu pagination manual
      const allCertificates = await this.prismaService.certificate.findMany({
        where: whereClause,
        include: {
          cot: {
            include: {
              capabilityCots: {
                include: {
                  capability: true,
                },
              },
            },
          },
        },
      });

      // Transform dan sort manual
      certificates = allCertificates
        .map(cert => this.transformToCertificateResponse(cert))
        .sort((a, b) => naturalSort(a[sortBy] || '', b[sortBy] || '', sortOrder));

      // Pagination manual
      certificates = certificates.slice((page - 1) * size, page * size);
    } else if (dateFields.includes(sortBy)) {
      // Date sort global: ambil seluruh data, sort berdasarkan tanggal, lalu pagination manual
      const allCertificates = await this.prismaService.certificate.findMany({
        where: whereClause,
        include: {
          cot: {
            include: {
              capabilityCots: {
                include: {
                  capability: true,
                },
              },
            },
          },
        },
      });

      // Transform dan sort berdasarkan tanggal
      certificates = allCertificates
        .map(cert => this.transformToCertificateResponse(cert))
        .sort((a, b) => {
          const aDate = new Date(a.expiryDate);
          const bDate = new Date(b.expiryDate);
          const comparison = aDate.getTime() - bDate.getTime();
          return sortOrder === 'asc' ? comparison : -comparison;
        });

      // Pagination manual
      certificates = certificates.slice((page - 1) * size, page * size);
    } else {
      // Untuk field lainnya, gunakan fallback ke natural sort
      const allCertificates = await this.prismaService.certificate.findMany({
        where: whereClause,
        include: {
          cot: {
            include: {
              capabilityCots: {
                include: {
                  capability: true,
                },
              },
            },
          },
        },
        skip: (page - 1) * size,
        take: size,
      });

      certificates = allCertificates.map(cert => this.transformToCertificateResponse(cert));
    }

    return {
      data: certificates,
      paging: {
        currentPage: page,
        totalPage: totalPage,
        size: size,
      },
    };
  }

  private transformToCertificateResponse(certificate: any): CertificateResponse {
    const capability = certificate.cot.capabilityCots[0]?.capability;
    const cotEndDate = new Date(certificate.cot.endDate);
    const now = new Date();
    
    // Sertifikat berlaku 6 bulan dari tanggal selesai COT (endDate), bukan tanggal pembuatan
    const expiryDate = new Date(cotEndDate);
    expiryDate.setMonth(expiryDate.getMonth() + 6);

    // Tentukan status berdasarkan tanggal expiry
    let status = 'Valid';
    if (now > expiryDate) {
      status = 'Expired';
    } else if (now.getTime() > (expiryDate.getTime() - (30 * 24 * 60 * 60 * 1000))) {
      // Jika kurang dari 30 hari sebelum expired
      status = 'Expiring Soon';
    }

    return {
      id: certificate.id,
      trainingName: capability?.trainingName || 'Unknown Training',
      expiryDate: expiryDate,
      certificateNumber: certificate.certificateNumber,
      status: status,
    };
  }
}
