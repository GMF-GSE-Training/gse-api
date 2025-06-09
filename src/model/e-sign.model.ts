import { ApiProperty } from '@nestjs/swagger';
import { SignatureType } from '@prisma/client';

/**
 * Request untuk membuat E-Sign baru.
 */
export interface CreateESign {
  idNumber: string;
  role: string;
  name: string;
  eSign: Express.Multer.File;
  signatureType: SignatureType;
  status: boolean;
}

/**
 * Request untuk memperbarui E-Sign.
 */
export interface UpdateESign {
  idNumber?: string;
  role?: string;
  name?: string;
  eSign?: Express.Multer.File;
  signatureType?: SignatureType;
  status?: boolean;
}

/**
 * Respons untuk data E-Sign.
 */
export class ESignResponse {
  @ApiProperty({
    description: 'ID unik E-Sign',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id!: string;

  @ApiProperty({
    description: 'Nomor ID pengguna',
    example: 'EMP001',
  })
  idNumber!: string;

  @ApiProperty({
    description: 'Peran pengguna',
    example: 'Direktur',
  })
  role!: string;

  @ApiProperty({
    description: 'Nama pengguna',
    example: 'John Doe',
  })
  name!: string;

  @ApiProperty({
    description: 'ID file tanda tangan (opsional)',
    example: 1,
    required: false,
    nullable: true,
  })
  eSignId?: number | null;

  @ApiProperty({
    description: 'Tipe tanda tangan',
    enum: SignatureType,
    example: SignatureType.SIGNATURE1,
  })
  signatureType!: SignatureType;

  @ApiProperty({
    description: 'Status E-Sign',
    example: true,
  })
  status!: boolean;

  @ApiProperty({
    description: 'Tanggal pembuatan E-Sign',
    example: '2025-05-10T10:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Tanggal pembaruan E-Sign',
    example: '2025-05-10T10:00:00.000Z',
  })
  updatedAt!: Date;
}