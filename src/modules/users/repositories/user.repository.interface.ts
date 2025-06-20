import { User, UserDocument } from '../schemas/user.schema';
import { UpdateQuery, ClientSession } from 'mongoose';

export interface IUserRepository {
  withTransaction<T>(
    callback: (session: ClientSession) => Promise<T>,
  ): Promise<T>;
  findAll(options?: { session: ClientSession }): Promise<UserDocument[]>;
  findByEmail(
    email: string,
    options?: { session: ClientSession },
  ): Promise<UserDocument | null>;
  findByEmailWithPassword(
    email: string,
    options?: { session: ClientSession },
  ): Promise<UserDocument | null>;
  findById(
    userId: string,
    options?: { session: ClientSession },
  ): Promise<UserDocument | null>;
  findByResetCode(
    code: string,
    options?: { session: ClientSession },
  ): Promise<UserDocument | null>;
  create(
    user: Partial<User>,
    options?: { session: ClientSession },
  ): Promise<UserDocument>;
  findByIdWithPassword(
    userId: string,
    options?: { session: ClientSession },
  ): Promise<UserDocument | null>;
  findByToken(
    token: string,
    options?: { session: ClientSession },
  ): Promise<UserDocument | null>;
  updateRefreshToken(
    userId: string,
    refreshToken: string | null,
    options?: { session?: ClientSession },
  ): Promise<void>;
  findByPhoneNumber(
    phoneNumber: string,
    options?: { session: ClientSession },
  ): Promise<UserDocument | null>;
  findByIdAndUpdate(
    userId: string,
    options?: { session: ClientSession },
  ): Promise<{ message: string }>;
  update(
    userId: string,
    updateData: UpdateQuery<UserDocument>,
    options?: { query?: any; new?: boolean; session?: ClientSession },
  ): Promise<UserDocument | null>;
  updateRoles(
    userId: string,
    roles: string[],
    options?: { session: ClientSession },
  ): Promise<UserDocument | null>;
  delete(email: string, options?: { session: ClientSession }): Promise<void>;
  countByRole(
    role: string,
    options?: { session: ClientSession },
  ): Promise<number>;
}
