import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  HttpStatus,
  HttpCode,
  ForbiddenException,
  Logger,
  Query,
  Put,
} from '@nestjs/common';
import { BookingService } from '../services/booking.service';
import { CreateBookingDto } from '../dto/create-booking.dto';
import { CancelBookingDto } from '../dto/cancel-booking.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { VerifiedUserGuard } from 'src/common/guards/verifiedUser.guard';
import { User } from 'src/common/decorators/user.decorator';
import { JwtUser } from 'src/common/interfaces/jwtUser.interface';

@Controller('booking')
export class BookingController {
  private readonly logger = new Logger(BookingController.name);

  constructor(private readonly bookingService: BookingService) {}

  @Post('book-flight')
  @UseGuards(JwtAuthGuard, VerifiedUserGuard)
  @HttpCode(HttpStatus.CREATED)
  async bookFlight(
    @User() user: JwtUser,
    @Body() createBookingDto: CreateBookingDto,
  ) {
    this.logger.log(`Creating booking for user: ${user.id}`);

    // Store booking with all details
    const booking = await this.bookingService.createBooking(
      user.id,
      createBookingDto,
    );

    return {
      success: true,
      message: 'Flight booked successfully',
      data: {
        success: true,
        message: 'Flight booked successfully',
        bookingId: booking._id,
        bookingRef: booking.bookingRef,
        status: booking.status,
      },
      error: null,
      meta: null,
    };
  }

  @Get('my-bookings')
  @UseGuards(JwtAuthGuard)
  async getMyBookings(@User() user: JwtUser) {
    const bookings = await this.bookingService.getUserBookings(user.id);

    return {
      success: true,
      message: 'response.success',
      data: {
        success: true,
        bookings,
      },
      error: null,
      meta: null,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getBookingDetails(@Param('id') id: string, @User() user: JwtUser) {
    const booking = await this.bookingService.getBookingById(id);
    if (booking.userId.toString() !== user.id) {
      throw new ForbiddenException(
        'You are not authorized to view this booking',
      );
    }

    return {
      success: true,
      message: 'response.success',
      data: {
        success: true,
        booking,
      },
      error: null,
      meta: null,
    };
  }

  @Get('calculate-fee')
  async calculateApplicationFee(@Query('basePrice') basePrice: string) {
    const price = parseFloat(basePrice);

    if (isNaN(price) || price <= 0) {
      return {
        success: false,
        message: 'Invalid base price provided',
        error: 'Bad Request',
        statusCode: 400,
      };
    }

    const calculation = this.bookingService.calculateTotalWithFee(price);

    return {
      success: true,
      message: 'Application fee calculated successfully',
      data: {
        success: true,
        calculation,
      },
      error: null,
      meta: null,
    };
  }

  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, VerifiedUserGuard)
  @HttpCode(HttpStatus.OK)
  async cancelBooking(
    @Param('id') bookingId: string,
    @User() user: JwtUser,
    @Body() cancelBookingDto: CancelBookingDto
  ) {
    this.logger.log(`Cancelling booking ${bookingId} for user ${user.id}`);

    const cancelledBooking = await this.bookingService.cancelBooking(
      bookingId,
      user.id,
      cancelBookingDto.reason
    );

    return {
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        bookingId: cancelledBooking._id,
        bookingRef: cancelledBooking.bookingRef,
        status: cancelledBooking.status,
        cancelledAt: cancelledBooking.cancelledAt,
        cancellationReason: cancelledBooking.cancellationReason
      },
      error: null,
      meta: null
    };
  }

  @Put(':id/assign-seats')
  @UseGuards(JwtAuthGuard, VerifiedUserGuard)
  @HttpCode(HttpStatus.OK)
  async assignSeats(
    @Param('id') bookingId: string,
    @User() user: JwtUser,
    @Query('cabinClass') cabinClass?: 'economy' | 'business'
  ) {
    this.logger.log(`Assigning seats to booking ${bookingId} for user ${user.id}`);

    // First verify the booking belongs to the user
    const booking = await this.bookingService.getBookingById(bookingId);
    if (booking.userId.toString() !== user.id) {
      throw new ForbiddenException(
        'You are not authorized to modify this booking',
      );
    }

    const updatedBooking = await this.bookingService.assignSeatsToExistingBooking(
      bookingId,
      cabinClass || 'economy'
    );

    return {
      success: true,
      message: 'Seats assigned successfully',
      data: {
        bookingId: updatedBooking._id,
        bookingRef: updatedBooking.bookingRef,
        travellersInfo: updatedBooking.travellersInfo,
        seatAssignments: updatedBooking.travellersInfo
          .filter(traveler => traveler.seatNumber)
          .map(traveler => ({
            name: `${traveler.firstName} ${traveler.lastName}`,
            travelerType: traveler.travelerType,
            seatNumber: traveler.seatNumber,
            assignedAt: traveler.seatAssignedAt
          }))
      },
      error: null,
      meta: null
    };
  }
}
