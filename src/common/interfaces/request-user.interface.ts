import { Role } from 'src/common/enums/role.enum';

export interface RequestUser {
  id: string;
  roles: Role[];
}
