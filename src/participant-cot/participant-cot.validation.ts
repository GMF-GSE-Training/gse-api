import { z, ZodType } from 'zod';

export class ParticipantCotValidation {
  static readonly ADD: ZodType = z.object({
    participantIds: z.array(z.string().uuid()).nonempty({
      message: 'Mohon pilih minimal satu peserta untuk ditambahkan',
    }),
  });
}
