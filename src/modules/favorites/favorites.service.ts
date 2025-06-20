import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Favorit } from './schemas/favorite.schema';
import { Model, ObjectId } from 'mongoose';
import { SuccessResponse } from './favorites.model';

@Injectable()
export class FavoritesService {
  constructor(
    @InjectModel(Favorit.name) private favoritModel: Model<Favorit>,
  ) {}

  // get
  async getFavorites(userId: string): Promise<{ flights: ObjectId[] }> {
    const data = await this.favoritModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();
    const flightIds = data.map((item) => item.flightId);
    return { flights: flightIds };
  }

  async getFavoritesCount(userId: string): Promise<{ count: number }> {
    const count = await this.favoritModel.countDocuments({ userId }).exec();
    return { count };
  }

  // add to favorites
  async addToFavorites(
    userId: string,
    flightId: string,
  ): Promise<SuccessResponse> {
    // check if the flight is already in favorites
    const isExist = await this.isFlightFavorited(userId, flightId);
    if (isExist) throw new ConflictException('Flight is already in favorites');

    // add to favorites
    const favorit = new this.favoritModel({ userId, flightId });
    await favorit.save();
    return { success: true, message: 'Flight added to favorites' };
  }

  // remove from favorites
  async removeFromFavorites(
    userId: string,
    flightId: string,
  ): Promise<SuccessResponse> {
    await this.favoritModel.findOneAndDelete({ userId, flightId });
    return { success: true, message: 'Flight removed from favorites' };
  }

  async removeAllFavorites(userId: string): Promise<SuccessResponse> {
    await this.favoritModel.deleteMany({ userId }).exec();
    return { success: true, message: 'All flights removed from favorites' };
  }

  // check if the flight is already in favorites
  async isFlightFavorited(userId: string, flightId: string): Promise<boolean> {
    const favorit = await this.favoritModel.findOne({ userId, flightId });
    return !!favorit;
  }
}
