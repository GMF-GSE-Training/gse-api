export interface UserMinimal {
  id: string;
  email: string;
  name?: string;
}

export type UserResponse = UserMinimal;
