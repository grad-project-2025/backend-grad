import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FavoritesService } from './favorites.service';
import { Request } from 'express';
import { RequestUser } from 'src/common/interfaces/request-user.interface';
import { SuccessResponse } from './favorites.model';
import { FavoritDto } from './dto/favorites.dto';
import { ObjectId } from 'mongoose';

@UseGuards(AuthGuard('jwt'))
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  // get favorites
  @Get('')
  async getFavorites(@Req() req: Request): Promise<{ flights: ObjectId[] }> {
    const user = req.user as RequestUser;
    return await this.favoritesService.getFavorites(user.id);
  }

  // get favorites count
  @Get('count')
  async getFavoritesCount(@Req() req: Request): Promise<{ count: number }> {
    const user = req.user as RequestUser;
    return await this.favoritesService.getFavoritesCount(user.id);
  }

  // add to favorites
  @Post('add')
  async addToFavorites(
    @Req() req: Request,
    @Body() body: FavoritDto,
  ): Promise<SuccessResponse> {
    const user = req.user as RequestUser;
    return await this.favoritesService.addToFavorites(user.id, body.flightId);
  }

  //remove one from favorites
  @Post('remove')
  async removeFromFavorites(
    @Req() req: Request,
    @Body() body: FavoritDto,
  ): Promise<SuccessResponse> {
    const user = req.user as RequestUser;
    return await this.favoritesService.removeFromFavorites(
      user.id,
      body.flightId,
    );
  }

  // remove all favorites
  @Post('remove-all')
  async removeAllFavorites(@Req() req: Request): Promise<SuccessResponse> {
    const user = req.user as RequestUser;
    return await this.favoritesService.removeAllFavorites(user.id);
  }

  // check if the flight is already in favorites
  @Post('is-favorited')
  async isFlightFavorited(
    @Req() req: Request,
    @Body() body: FavoritDto,
  ): Promise<{ isFavorited: boolean }> {
    const user = req.user as RequestUser;
    const isFavorited = await this.favoritesService.isFlightFavorited(
      user.id,
      body.flightId,
    );
    return { isFavorited };
  }
}
