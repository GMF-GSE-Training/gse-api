import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/service/prisma.service';
import { ActionAccessRights } from 'src/model/web.model';

interface UniqueFieldCheck {
  field: string;
  value: any;
  message: string;
}

@Injectable()
export class CoreHelper {
  constructor(private prismaService: PrismaService) {}

  async ensureUniqueFields(
    tableName: string,
    data: UniqueFieldCheck[],
    excludeId?: string,
  ): Promise<void> {
    for (const { field, value, message } of data) {
      if (!value || value === null || value === '') {
        continue;
      }

      const condition: any = { [field]: value };
      if (excludeId) {
        condition.NOT = { id: excludeId };
      }

      const count = await this.prismaService[tableName].count({
        where: condition,
      });

      if (count > 0) {
        throw new HttpException(message, 400);
      }
    }
  }

  validateActions(
    currentRole: string,
    accessMap: { [role: string]: ActionAccessRights },
  ): ActionAccessRights {
    // Default hak akses jika role tidak ditemukan
    const defaultAccess: ActionAccessRights = {
      canEdit: false,
      canDelete: false,
      canView: false,
      canPrint: false,
    };

    // Kembalikan hak akses berdasarkan role, atau default jika role tidak ditemukan
    return accessMap[currentRole] || defaultAccess;
  }

  transformEmptyToNull(value: any): any {
    return value === '' ? null : value;
  }
}
