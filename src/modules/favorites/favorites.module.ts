import { MongooseModule } from '@nestjs/mongoose';
import { Module } from '@nestjs/common';
import { FavoritesController } from './favorites.controller';
import { FavoritesService } from './favorites.service';
import { Favorit, FavoritSchema } from './schemas/favorite.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Favorit.name, schema: FavoritSchema }]),
  ],
  controllers: [FavoritesController],
  providers: [FavoritesService],
})
export class FavoritesModule {}
