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
    table: string,
    fields: { field: string; value: string; message: string }[],
    prismaInstance?: any
  ): Promise<void> {
    const db = prismaInstance || this.prismaService;
    for (const { field, value, message } of fields) {
      const count = await db[table].count({
        where: { [field]: value },
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
