/**
 * Request untuk membuat role baru.
 */
export interface CreateRoleRequest {
  name: string;
}

/**
 * Request untuk memperbarui role.
 */
export interface UpdateRoleRequest {
  name?: string;
}

/**
 * Response untuk data role.
 * @remarks Mencakup semua field relevan dari model Role.
 */
export interface RoleResponse {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
