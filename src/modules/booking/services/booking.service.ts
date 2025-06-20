import { Injectable, NotFoundException, Logger, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument, FlightData } from '../schemas/booking.schema';
import { CreateBookingDto, BookingType, FlightType } from '../dto/create-booking.dto';
import { FlightService } from 'src/modules/flight/flight.service';
import { EmailService } from 'src/modules/email/email.service';
import { SeatAssignmentService } from './seat-assignment.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);
  private readonly bookingTimeoutMinutes: number;

  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    private readonly flightService: FlightService,
    private readonly emailService: EmailService,
    private readonly seatAssignmentService: SeatAssignmentService,
    private readonly configService: ConfigService,
  ) {
    this.bookingTimeoutMinutes = this.configService.get<number>('BOOKING_TIMEOUT_MINUTES', 5);
    this.logger.log(`Booking timeout set to ${this.bookingTimeoutMinutes} minutes`);
  }

  async createBooking(
    userId: string,
    createBookingDto: CreateBookingDto,
  ): Promise<BookingDocument> {
    this.logger.log(`Creating booking for userId: ${userId}`);

    // Determine booking type
    const bookingType = createBookingDto.bookingType || BookingType.ONE_WAY;

    // Validate booking data based on type
    this.validateBookingData(createBookingDto, bookingType);

    // Generate a unique bookingRef if not provided
    let bookingRef = createBookingDto.bookingRef;
    if (!bookingRef) {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const prefix =
        letters.charAt(Math.floor(Math.random() * letters.length)) +
        letters.charAt(Math.floor(Math.random() * letters.length));
      const numbers = Math.floor(Math.random() * 900000) + 100000;
      bookingRef = `${prefix}${numbers}`;
    }

    // Use the provided total price as the final amount
    // The frontend/mobile app should calculate and include the application fee
    // before sending the request
    const finalTotalPrice = createBookingDto.totalPrice;

    this.logger.log(
      `Creating ${bookingType} booking with total price: ${finalTotalPrice} ${createBookingDto.currency}`,
    );

    // Create booking object based on type
    const bookingData: any = {
      userId: new Types.ObjectId(userId),
      bookingType,
      totalPrice: finalTotalPrice,
      currency: createBookingDto.currency,
      travellersInfo: createBookingDto.travellersInfo,
      contactDetails: createBookingDto.contactDetails,
      status: 'pending',
      bookingRef,
    };

    if (bookingType === BookingType.ROUND_TRIP) {
      // Handle round-trip booking
      bookingData.flightData = createBookingDto.flightData?.map((flight) => ({
        flightID: flight.flightID,
        typeOfFlight: flight.typeOfFlight,
        numberOfStops: flight.numberOfStops,
        originAirportCode: flight.originAirportCode,
        destinationAirportCode: flight.destinationAirportCode,
        originCIty: flight.originCIty,
        destinationCIty: flight.destinationCIty,
        departureDate: new Date(flight.departureDate),
        arrivalDate: new Date(flight.arrivalDate),
        selectedBaggageOption: flight.selectedBaggageOption,
      }));
    } else {
      // Handle one-way booking (backward compatibility)
      bookingData.flightId = createBookingDto.flightID;
      bookingData.originAirportCode = createBookingDto.originAirportCode;
      bookingData.destinationAirportCode = createBookingDto.destinationAirportCode;
      bookingData.originCity = createBookingDto.originCIty;
      bookingData.destinationCity = createBookingDto.destinationCIty;
      bookingData.departureDate = new Date(createBookingDto.departureDate!);
      bookingData.arrivalDate = new Date(createBookingDto.arrivalDate!);
      bookingData.selectedBaggageOption = createBookingDto.selectedBaggageOption;
    }

    const newBooking = new this.bookingModel(bookingData);

    try {
      const savedBooking = await newBooking.save();
      this.logger.log(
        `${bookingType} booking created successfully with ID: ${savedBooking._id.toString()}`,
      );

      // Assign seats to travelers after booking is created
      try {
        await this.assignSeatsToBooking(savedBooking._id.toString());
        this.logger.log(`Seat assignment completed for booking: ${savedBooking._id.toString()}`);
      } catch (seatError) {
        this.logger.error(
          `Failed to assign seats for booking ${savedBooking._id.toString()}: ${seatError instanceof Error ? seatError.message : 'Unknown error'}`,
        );
        // Don't throw error here - booking is still valid even without seat assignments
      }

      // Return the updated booking with seat assignments
      const updatedBooking = await this.bookingModel.findById(savedBooking._id);
      return updatedBooking || savedBooking;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Failed to create booking: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error('Failed to create booking with unknown error');
      }
      throw error;
    }
  }

  /**
   * Assign seats to travelers in a booking
   */
  private async assignSeatsToBooking(bookingId: string): Promise<void> {
    this.logger.log(`Starting seat assignment for booking: ${bookingId}`);

    // Find the booking
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    // Generate seat assignments
    const seatAssignments = await this.seatAssignmentService.assignSeats(
      booking.travellersInfo,
      'economy' // Default to economy class
    );

    if (seatAssignments.length === 0) {
      this.logger.log(`No seat assignments needed for booking: ${bookingId}`);
      return;
    }

    // Apply seat assignments to travelers
    const updatedTravelers = await this.seatAssignmentService.applySeatAssignments(
      booking.travellersInfo,
      seatAssignments
    );

    // Update the booking with seat assignments
    await this.bookingModel.findByIdAndUpdate(
      bookingId,
      {
        $set: {
          travellersInfo: updatedTravelers
        }
      }
    );

    // Log seat assignment summary
    const summary = this.seatAssignmentService.getSeatAssignmentSummary(seatAssignments);
    this.logger.log(`Seat assignment completed for booking ${bookingId}: ${summary}`);

    // Validate assignments
    const validation = this.seatAssignmentService.validateSeatAssignments(seatAssignments);
    if (!validation.isValid) {
      this.logger.warn(`Seat assignment validation failed for booking ${bookingId}: ${validation.errors.join(', ')}`);
    }
  }

  private validateBookingData(createBookingDto: CreateBookingDto, bookingType: BookingType): void {
    if (bookingType === BookingType.ROUND_TRIP) {
      if (!createBookingDto.flightData || createBookingDto.flightData.length === 0) {
        throw new BadRequestException('Flight data is required for round-trip bookings');
      }

      if (createBookingDto.flightData.length !== 2) {
        throw new BadRequestException('Round-trip bookings must have exactly 2 flights (GO and RETURN)');
      }

      const goFlight = createBookingDto.flightData.find(f => f.typeOfFlight === FlightType.GO);
      const returnFlight = createBookingDto.flightData.find(f => f.typeOfFlight === FlightType.RETURN);

      if (!goFlight || !returnFlight) {
        throw new BadRequestException('Round-trip bookings must have one GO flight and one RETURN flight');
      }

      // Validate that return flight departs after go flight arrives
      const goArrival = new Date(goFlight.arrivalDate);
      const returnDeparture = new Date(returnFlight.departureDate);

      if (returnDeparture <= goArrival) {
        throw new BadRequestException('Return flight must depart after the arrival of the outbound flight');
      }
    } else {
      // Validate one-way booking fields
      if (!createBookingDto.flightID || !createBookingDto.originAirportCode ||
          !createBookingDto.destinationAirportCode || !createBookingDto.departureDate ||
          !createBookingDto.arrivalDate) {
        throw new BadRequestException('All flight details are required for one-way bookings');
      }
    }
  }

  async getUserBookings(userId: string): Promise<BookingDocument[]> {
    return this.bookingModel
      .find({
        userId: new Types.ObjectId(userId),
      })
      .exec();
  }
  async getBookingById(bookingId: string): Promise<BookingDocument> {
    if (!Types.ObjectId.isValid(bookingId)) {
      throw new NotFoundException(`Invalid booking ID format`);
    }

    const booking = await this.bookingModel
      .findById(new Types.ObjectId(bookingId))
      .exec();

    if (!booking) {
      throw new NotFoundException(`Booking with ID ${bookingId} not found`);
    }

    return booking;
  }

  /**
   * Manually assign seats to an existing booking
   * This can be used for bookings that were created before seat assignment was implemented
   */
  async assignSeatsToExistingBooking(
    bookingId: string,
    cabinClass: 'economy' | 'business' = 'economy'
  ): Promise<BookingDocument> {
    this.logger.log(`Manually assigning seats to booking: ${bookingId}`);

    const booking = await this.getBookingById(bookingId);

    // Check if seats are already assigned
    const hasSeats = booking.travellersInfo.some(traveler => traveler.seatNumber);
    if (hasSeats) {
      this.logger.warn(`Booking ${bookingId} already has seat assignments`);
      return booking;
    }

    // Generate and apply seat assignments
    const seatAssignments = await this.seatAssignmentService.assignSeats(
      booking.travellersInfo,
      cabinClass
    );

    if (seatAssignments.length === 0) {
      this.logger.log(`No seat assignments needed for booking: ${bookingId}`);
      return booking;
    }

    const updatedTravelers = await this.seatAssignmentService.applySeatAssignments(
      booking.travellersInfo,
      seatAssignments
    );

    // Update the booking
    const updatedBooking = await this.bookingModel.findByIdAndUpdate(
      bookingId,
      {
        $set: {
          travellersInfo: updatedTravelers
        }
      },
      { new: true }
    );

    const summary = this.seatAssignmentService.getSeatAssignmentSummary(seatAssignments);
    this.logger.log(`Manual seat assignment completed for booking ${bookingId}: ${summary}`);

    return updatedBooking;
  }

  /**
   * Calculate application fee based on base price
   * This is a public method that can be used by frontend/mobile to calculate the fee
   * You can customize this logic based on your business requirements
   */
  public calculateApplicationFee(basePrice: number): number {
    // Example: 2.5% application fee with minimum $5 and maximum $50
    const feePercentage = 0.025; // 2.5%
    const minFee = 5;
    const maxFee = 50;

    let fee = basePrice * feePercentage;
    fee = Math.max(fee, minFee); // Ensure minimum fee
    fee = Math.min(fee, maxFee); // Ensure maximum fee

    return Math.round(fee * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate total price including application fee
   * This method can be used by frontend/mobile to get the final total
   */
  public calculateTotalWithFee(basePrice: number): {
    basePrice: number;
    applicationFee: number;
    totalPrice: number;
  } {
    const applicationFee = this.calculateApplicationFee(basePrice);
    const totalPrice = basePrice + applicationFee;

    return {
      basePrice: Math.round(basePrice * 100) / 100,
      applicationFee,
      totalPrice: Math.round(totalPrice * 100) / 100,
    };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handlePendingBookingsTimeout() {
    const timeoutDate = new Date(Date.now() - this.bookingTimeoutMinutes * 60 * 1000);

    try {
      const result = await this.bookingModel.updateMany(
        {
          status: 'pending',
          paymentStatus: 'pending',
          createdAt: { $lt: timeoutDate }
        },
        {
          $set: {
            status: 'cancelled',
            paymentStatus: 'failed'
          }
        }
      );

      if (result.modifiedCount > 0) {
        this.logger.log(`Cancelled ${result.modifiedCount} pending bookings due to timeout`);
        
        // Get the cancelled bookings to send notifications
        const cancelledBookings = await this.bookingModel.find({
          status: 'cancelled',
          paymentStatus: 'failed',
          updatedAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // Last 5 minutes
        });

        // Send notifications for each cancelled booking
        for (const booking of cancelledBookings) {
          try {
            const html = `
              <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Booking Cancelled - Payment Timeout</h2>
                <p>Your booking (${booking.bookingRef}) has been cancelled due to payment timeout.</p>
                <p>Please try booking again if you still wish to proceed.</p>
                <p style="margin-top: 20px; color: #666;">
                  Best regards,<br>
                  The Airport Team
                </p>
              </div>
            `;

            await this.emailService.sendImportantEmail(
              booking.contactDetails.email,
              'Booking Cancelled - Payment Timeout',
              html
            );
          } catch (emailError) {
            this.logger.error(`Failed to send cancellation email for booking ${booking.bookingRef}:`, emailError);
          }
        }
      }
    } catch (error) {
      this.logger.error('Error handling pending bookings timeout:', error);
    }
  }

  async cancelBooking(
    bookingId: string,
    userId: string,
    reason?: string
  ): Promise<BookingDocument> {
    this.logger.log(`Attempting to cancel booking ${bookingId} for user ${userId}`);

    // 1. Find and validate booking
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // 2. Verify ownership
    if (booking.userId.toString() !== userId) {
      throw new ForbiddenException('You are not authorized to cancel this booking');
    }

    // 3. Check if booking is already cancelled
    if (booking.status === 'cancelled') {
      throw new BadRequestException('Booking is already cancelled');
    }

    // 4. Check if booking is in a cancellable state
    if (booking.status !== 'confirmed') {
      throw new BadRequestException('This booking cannot be cancelled');
    }

    // 5. Update booking status
    const updatedBooking = await this.bookingModel.findByIdAndUpdate(
      bookingId,
      {
        $set: {
          status: 'cancelled',
          cancellationReason: reason,
          cancelledAt: new Date()
        }
      },
      { new: true }
    );

    // 6. Send cancellation notification
    try {
      const html = `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Booking Cancelled</h2>
          <p>Your booking (${booking.bookingRef}) has been cancelled.</p>
          ${reason ? `<p>Cancellation reason: ${reason}</p>` : ''}
          <p style="margin-top: 20px; color: #666;">
            Best regards,<br>
            The Airport Team
          </p>
        </div>
      `;

      await this.emailService.sendImportantEmail(
        booking.contactDetails.email,
        'Booking Cancelled',
        html
      );
    } catch (emailError) {
      this.logger.error(`Failed to send cancellation email for booking ${booking.bookingRef}:`, emailError);
    }

    this.logger.log(`Booking ${bookingId} cancelled successfully`);
    return updatedBooking;
  }
}
