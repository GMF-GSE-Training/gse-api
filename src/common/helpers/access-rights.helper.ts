import type { CurrentUserRequest } from '../../model/auth.model.js';
import type { ActionAccessRights } from '../../model/web.model.js';

export function getAccessRights(
  user: CurrentUserRequest,
  dinas: string | null | undefined = null
): ActionAccessRights {
  const roleName = user.role.name.toLowerCase();
  let canEdit = false;
  let canDelete = false;
  let canPrint = false;

  if (roleName === 'admin' || roleName === 'super admin') {
    return { canEdit: true, canDelete: true, canPrint: true, canView: true };
  }

  if (roleName === 'lcu') {
    canEdit = true;
    canDelete = false;
    canPrint = true;
    if (user.dinas && user.dinas !== dinas) {
      return {
        canView: true,
        canEdit: false,
        canDelete: false,
        canPrint: false,
      };
    }
  }

  return { canEdit, canDelete, canPrint, canView: true };
}
