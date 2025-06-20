export interface JwtUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  roles?: string[];
}
