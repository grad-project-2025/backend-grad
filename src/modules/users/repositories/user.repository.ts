import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, UpdateQuery, ClientSession } from 'mongoose';
import { User, UserDocument } from '../schemas/user.schema';
import { IUserRepository } from './user.repository.interface';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async withTransaction<T>(
    callback: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.userModel.db.startSession();
    try {
      session.startTransaction();
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async findAll(options?: { session: ClientSession }): Promise<UserDocument[]> {
    return this.userModel
      .find()
      .session(options?.session ?? null)
      .exec();
  }

  async findByEmail(
    email: string,
    options?: { session: ClientSession },
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email })
      .session(options?.session ?? null)
      .exec();
  }

  async findByEmailWithPassword(
    email: string,
    options?: { session: ClientSession },
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email })
      .select('+password')
      .session(options?.session ?? null)
      .exec();
  }
  async findByIdWithPassword(
    userId: string,
    options?: { session: ClientSession },
  ): Promise<UserDocument | null> {
    return this.userModel
      .findById(userId)
      .select('+password')
      .session(options?.session ?? null)
      .exec();
  }
  async findById(
    userId: string,
    options?: { session: ClientSession },
  ): Promise<UserDocument | null> {
    return this.userModel
      .findById(userId)
      .session(options?.session ?? null)
      .exec();
  }

  async create(
    user: Partial<User>,
    options?: { session: ClientSession },
  ): Promise<UserDocument> {
    const newUser = new this.userModel(user);
    return newUser.save({ session: options?.session ?? null });
  }

  async findByToken(
    token: string,
    options?: { session: ClientSession },
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ verificationToken: token })
      .session(options?.session ?? null)
      .exec();
  }

  async updateRefreshToken(
    userId: string,
    refreshToken: string | null,
    options?: { session: ClientSession },
  ): Promise<void> {
    try {
      console.log(`Updating refresh token for user ID: ${userId}`);
      await this.userModel
        .findByIdAndUpdate(
          userId,
          { refreshToken },
          { new: true, session: options?.session ?? null },
        )
        .exec();
      console.log('Refresh token updated successfully.');
    } catch (error) {
      console.error('Error updating refresh token:', error);
      throw error;
    }
  }

  async findByPhoneNumber(
    phoneNumber: string,
    options?: { session: ClientSession },
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ phoneNumber })
      .session(options?.session ?? null)
      .exec();
  }

  async findByIdAndUpdate(
    userId: string,
    options?: { session: ClientSession },
  ): Promise<{ message: string }> {
    await this.userModel
      .findByIdAndUpdate(
        userId,
        { refreshToken: null },
        { new: true, session: options?.session ?? null },
      )
      .exec();
    return { message: 'Logged out successfully' };
  }

  async update(
    userId: string,
    updateData: UpdateQuery<UserDocument>,
    options?: { query?: any; new?: boolean; session?: ClientSession },
  ): Promise<UserDocument | null> {
    const filter = { _id: userId, ...(options?.query || {}) };
    return this.userModel
      .findOneAndUpdate(filter, updateData, {
        new: options?.new ?? true,
        session: options?.session ?? null,
      })
      .exec();
  }

  async updateRoles(
    userId: string,
    roles: string[],
    options?: { session: ClientSession },
  ): Promise<UserDocument | null> {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { roles },
        { new: true, session: options?.session ?? null },
      )
      .exec();
  }

  async delete(
    email: string,
    options?: { session: ClientSession },
  ): Promise<void> {
    const result = await this.userModel
      .findOneAndDelete({ email })
      .session(options?.session ?? null)
      .exec();
    if (!result) {
      throw new NotFoundException(`User with email ${email} not found`);
    }
  }

  async countByRole(
    role: string,
    options?: { session: ClientSession },
  ): Promise<number> {
    return this.userModel
      .countDocuments({ roles: role })
      .session(options?.session ?? null)
      .exec();
  }

  async findByResetCode(
    code: string,
    options?: { session: ClientSession },
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ resetCode: code })
      .select('+password') // Explicitly include the password field
      .session(options?.session ?? null)
      .exec();
  }
}
