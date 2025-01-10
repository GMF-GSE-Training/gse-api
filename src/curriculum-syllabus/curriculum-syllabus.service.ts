import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/service/prisma.service';
import { ValidationService } from 'src/common/service/validation.service';
import {
  CreateCurriculumSyllabus,
  UpdateCurriculumSyllabus,
} from 'src/model/curriculum-syllabus.model';
import { CurriculumSyllabusValidation } from './curriculum-syllabus.validation';

@Injectable()
export class CurriculumSyllabusService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly validationService: ValidationService, // jika diperlukan
  ) {}

  async createCurriculumSyllabus(
    request: CreateCurriculumSyllabus,
  ): Promise<string> {
    const curriculumSyllabusRequest = this.validationService.validate(
      CurriculumSyllabusValidation.CREATE,
      request,
    );
    const { curriculumSyllabus } = curriculumSyllabusRequest;

    await this.prismaService.curriculumSyllabus.createMany({
      data: curriculumSyllabus.map((curriculumSyllabus) => ({
        capabilityId: curriculumSyllabus.capabilityId,
        name: curriculumSyllabus.name,
        theoryDuration: curriculumSyllabus.theoryDuration,
        practiceDuration: curriculumSyllabus.practiceDuration,
        type: curriculumSyllabus.type,
      })),
    });

    const capabilityId = curriculumSyllabus[0].capabilityId;

    // Menghitung total theoryDuration dari semua item di curriculumSyllabus
    const totalTheoryDurationRegGse = curriculumSyllabus
      .filter((item) => item.type.toLocaleLowerCase() === 'regulasi gse')
      .reduce((total, item) => {
        return total + item.theoryDuration;
      }, 0);

    // Menghitung total practiceDuration dari semua item di curriculumSyllabus
    const totalPracticeDurationRegGse = curriculumSyllabus
      .filter((item) => item.type.toLocaleLowerCase() === 'regulasi gse')
      .reduce((total, item) => {
        return total + item.practiceDuration;
      }, 0);

    // Menghitung total practiceDuration dari semua item di curriculumSyllabus
    const totalTheoryDurationCompetency = curriculumSyllabus
      .filter((item) => item.type.toLocaleLowerCase() === 'kompetensi')
      .reduce((total, item) => {
        return total + item.theoryDuration;
      }, 0);

    // Menghitung total practiceDuration dari semua item di curriculumSyllabus
    const totalPracticeDurationCompetency = curriculumSyllabus
      .filter((item) => item.type.toLocaleLowerCase() === 'kompetensi')
      .reduce((total, item) => {
        return total + item.practiceDuration;
      }, 0);

    const totalDuration =
      totalTheoryDurationRegGse +
      totalPracticeDurationRegGse +
      totalTheoryDurationCompetency +
      totalPracticeDurationCompetency;

    await this.prismaService.capability.update({
      where: {
        id: capabilityId,
      },
      data: {
        totalTheoryDurationRegGse: totalTheoryDurationRegGse,
        totalPracticeDurationRegGse: totalPracticeDurationRegGse,
        totalTheoryDurationCompetency: totalTheoryDurationCompetency,
        totalPracticeDurationCompetency: totalPracticeDurationCompetency,
        totalDuration: totalDuration,
      },
    });

    return 'Berhasil membuat Curriculum & Syllabus';
  }

  async updateCurriculumSyllabus(
    capabilityId: string,
    request: UpdateCurriculumSyllabus,
  ): Promise<string> {
    const updateCurriculumSyllabusRequest = this.validationService.validate(
      CurriculumSyllabusValidation.UPDATE,
      request,
    );

    const capability = await this.prismaService.capability.findUnique({
      where: {
        id: capabilityId,
      },
    });

    if (!capability) {
      throw new HttpException('Capability tidak ditemukan', 404);
    }

    const { curriculumSyllabus } = updateCurriculumSyllabusRequest;

    // Dapatkan semua data yang ada di database untuk capabilityId ini
    const existingSyllabus =
      await this.prismaService.curriculumSyllabus.findMany({
        where: { capabilityId },
      });

    // Simpan semua ID yang ada dalam request
    const requestIds = curriculumSyllabus.map((item) => item.id);

    // Hapus data di database yang tidak ada di request
    const idsToDelete = existingSyllabus
      .filter((item) => !requestIds.includes(item.id)) // Cari data yang tidak ada di request
      .map((item) => item.id);

    await this.prismaService.curriculumSyllabus.deleteMany({
      where: { id: { in: idsToDelete } },
    });

    // Perbarui atau buat data baru
    for (const syllabus of curriculumSyllabus) {
      if (syllabus.id) {
        // Jika data ada (id tidak null), lakukan update
        await this.prismaService.curriculumSyllabus.update({
          where: {
            id: syllabus.id,
          },
          data: {
            capabilityId,
            name: syllabus.name,
            theoryDuration: syllabus.theoryDuration,
            practiceDuration: syllabus.practiceDuration,
            type: syllabus.type,
          },
        });
      } else {
        // Jika id tidak ada, buat data baru
        await this.prismaService.curriculumSyllabus.create({
          data: {
            capabilityId,
            name: syllabus.name,
            theoryDuration: syllabus.theoryDuration,
            practiceDuration: syllabus.practiceDuration,
            type: syllabus.type,
          },
        });
      }
    }

    // Hitung total durasi dan perbarui capability
    const totalTheoryDurationRegGse = curriculumSyllabus
      .filter((item) => item.type.toLowerCase() === 'regulasi gse')
      .reduce((total, item) => total + item.theoryDuration, 0);

    const totalPracticeDurationRegGse = curriculumSyllabus
      .filter((item) => item.type.toLowerCase() === 'regulasi gse')
      .reduce((total, item) => total + item.practiceDuration, 0);

    const totalTheoryDurationCompetency = curriculumSyllabus
      .filter((item) => item.type.toLowerCase() === 'kompetensi')
      .reduce((total, item) => total + item.theoryDuration, 0);

    const totalPracticeDurationCompetency = curriculumSyllabus
      .filter((item) => item.type.toLowerCase() === 'kompetensi')
      .reduce((total, item) => total + item.practiceDuration, 0);

    const totalDuration =
      totalTheoryDurationRegGse +
      totalPracticeDurationRegGse +
      totalTheoryDurationCompetency +
      totalPracticeDurationCompetency;

    // Update Capability dengan total durasi
    await this.prismaService.capability.update({
      where: { id: capability.id },
      data: {
        totalTheoryDurationRegGse,
        totalPracticeDurationRegGse,
        totalTheoryDurationCompetency,
        totalPracticeDurationCompetency,
        totalDuration,
      },
    });

    return 'Curriculum & Syllabus berhasil diperbarui';
  }
}
