import { HttpException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/service/prisma.service.js';
import { ActionAccessRights } from '../../model/web.model.js';

interface UniqueFieldCheck {
  field: string;
  value: any;
  message: string;
}

/**
 *
 */
@Injectable()
export class CoreHelper {
  // Tambahkan properti signatures untuk menyimpan tanda tangan tipe file
  private readonly signatures: { [key: string]: Buffer } = {
    'image/png': Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG
    'image/jpeg': Buffer.from([0xff, 0xd8, 0xff]), // JPEG
    'application/pdf': Buffer.from([0x25, 0x50, 0x44, 0x46]), // PDF
  };

  /**
   *
   * @param prismaService
   */
  constructor(private prismaService: PrismaService) {}

  /**
   *
   * @param table
   * @param fields
   * @param excludeId
   * @param prismaInstance
   */
  async ensureUniqueFields(
    table: string,
    fields: UniqueFieldCheck[],
    excludeId?: string,
    prismaInstance?: any
  ): Promise<void> {
    if (!table || !fields || fields.length === 0) {
      throw new HttpException('Invalid parameters', 400);
    }

    const db = prismaInstance || this.prismaService;
    for (const { field, value, message } of fields) {
      if (value === null || value === '' || value === undefined) {
        continue;
      }

      const condition: any = { [field]: value };
      if (excludeId) {
        condition.NOT = { id: excludeId };
      }

      const count = await db[table].count({
        where: condition,
      });

      if (count > 0) {
        throw new HttpException(message, 400);
      }
    }
  }

  /**
   *
   * @param currentRole
   */
  validateActions(
    currentRole: string,
    accessMap: { [role: string]: ActionAccessRights }
  ): ActionAccessRights {
    const defaultAccess: ActionAccessRights = {
      canEdit: false,
      canDelete: false,
      canView: false,
      canPrint: false,
    };
    return accessMap[currentRole] || defaultAccess;
  }

  /**
   *
   * @param value
   */
  transformEmptyToNull(value: any): any {
    return value === '' ? null : value;
  }

  /**
   * Mendeteksi tipe media berdasarkan buffer file.
   * @param buffer Buffer dari file yang akan diperiksa.
   * @returns MIME type dari file (contoh: 'image/png').
   * @throws HttpException jika tipe file tidak didukung atau buffer invalid.
   */
  getMediaType(buffer: Buffer): string {
    // Validasi input
    if (!buffer || buffer.length < 4) {
      throw new HttpException(
        'Buffer file tidak valid atau terlalu pendek',
        400
      );
    }

    // Iterasi melalui signatures
    for (const [type, signature] of Object.entries(this.signatures)) {
      if (
        buffer.length >= signature.length &&
        buffer.subarray(0, signature.length).equals(signature)
      ) {
        return type;
      }
    }

    throw new HttpException('Tipe file tidak didukung', 400);
  }
}
