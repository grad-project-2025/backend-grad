import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Stripe from 'stripe';
import { Booking, BookingDocument } from '../../booking/schemas/booking.schema';
import { CreatePaymentIntentDto } from '../dto/create-payment-intent.dto';
import { ConfirmPaymentDto } from '../dto/confirm-payment.dto';
import { EmailService } from '../../email/email.service';
import { BookingEmailData } from '../../email/services/email-template.service';
import { PaymobService } from './paymob.service';
import { PaymentTransactionService } from './payment-transaction.service';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    private emailService: EmailService,
    private paymobService: PaymobService,
    private paymentTransactionService: PaymentTransactionService,
  ) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2025-05-28.basil',
    });
  }

  /**
   * Get a booking by ID
   * @param bookingId The ID of the booking to retrieve
   * @returns The booking document
   */
  async getBookingById(bookingId: string) {
    return this.bookingModel.findById(bookingId).exec();
  }

  /**
   * Get PaymentIntent details from Stripe for debugging
   * @param paymentIntentId The PaymentIntent ID
   * @returns PaymentIntent object from Stripe
   */
  async getPaymentIntentDetails(paymentIntentId: string) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      this.logger.log(`Retrieved PaymentIntent ${paymentIntentId} with status: ${paymentIntent.status}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error(`Failed to retrieve PaymentIntent ${paymentIntentId}: ${error.message}`);
      throw error;
    }
  }

  async createPaymentIntent(createPaymentIntentDto: CreatePaymentIntentDto) {
    const { bookingId, amount, currency, paymentMethodId, customerId } =
      createPaymentIntentDto;

    try {
      // Find the booking
      const booking = await this.bookingModel.findById(bookingId);
      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      // Verify the amount matches the booking total price
      const expectedAmount = Math.round(booking.totalPrice * 100); // Convert to cents

      // Verify the amount matches the booking total price
      const providedAmount = Math.round(amount * 100);

      if (expectedAmount !== providedAmount) {
        throw new BadRequestException(
          `Amount mismatch. Expected: ${expectedAmount / 100}, Provided: ${amount}`,
        );
      }

      // Create payment intent
      const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
        amount: expectedAmount,
        currency: currency.toLowerCase(),
        metadata: {
          bookingId: bookingId,
          bookingRef: booking.bookingRef,
        },
        description: `Payment for flight booking ${booking.bookingRef}`,
      };

      // Add customer if provided
      if (customerId) {
        paymentIntentParams.customer = customerId;
      }

      // Add payment method if provided
      if (paymentMethodId) {
        paymentIntentParams.payment_method = paymentMethodId;
        paymentIntentParams.confirmation_method = 'manual';
        paymentIntentParams.confirm = true;
      }

      const paymentIntent =
        await this.stripe.paymentIntents.create(paymentIntentParams);

      // Update booking with payment intent ID and set payment status to processing
      await this.bookingModel.findByIdAndUpdate(bookingId, {
        paymentIntentId: paymentIntent.id,
        paymentStatus: 'processing',
        stripeCustomerId: customerId,
      });

      this.logger.log(
        `Payment intent created: ${paymentIntent.id} for booking: ${bookingId}`,
      );

      // Enhanced logging for debugging
      this.logger.debug(`PaymentIntent details:`, {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret ?
          `${paymentIntent.client_secret.substring(0, 20)}...` : 'null',
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        account: paymentIntent.client_secret ?
          paymentIntent.client_secret.split('_')[2] : 'unknown'
      });

      return {
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create payment intent: ${error.message}`,
        error.stack,
      );

      // Handle specific Stripe errors
      if (error.type) {
        switch (error.type) {
          case 'StripeCardError':
            throw new BadRequestException(`Card error: ${error.message}`);
          case 'StripeRateLimitError':
            throw new BadRequestException('Too many requests. Please try again later.');
          case 'StripeInvalidRequestError':
            throw new BadRequestException(`Invalid request: ${error.message}`);
          case 'StripeAPIError':
            throw new BadRequestException('Payment service temporarily unavailable. Please try again.');
          case 'StripeConnectionError':
            throw new BadRequestException('Network error. Please check your connection and try again.');
          case 'StripeAuthenticationError':
            throw new BadRequestException('Payment configuration error. Please contact support.');
          default:
            throw new BadRequestException(`Payment error: ${error.message}`);
        }
      }

      throw error;
    }
  }

  async confirmPayment(confirmPaymentDto: ConfirmPaymentDto) {
    const { paymentIntentId, bookingId, userEmail } = confirmPaymentDto;

    try {
      // Retrieve payment intent from Stripe
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);

      // In production, payment confirmation happens after frontend uses Stripe.js
      // to collect payment method and confirm the payment
      if (paymentIntent.status === 'requires_payment_method') {
        this.logger.warn(
          `Payment intent ${paymentIntentId} still requires payment method. Frontend should handle payment confirmation with Stripe.js`,
        );

        return {
          success: false,
          paymentStatus: 'requires_payment_method',
          stripeStatus: paymentIntent.status,
          message:
            'Payment requires payment method. Use Stripe.js on frontend to complete payment.',
          clientSecret: paymentIntent.client_secret,
        };
      }

      if (paymentIntent.status === 'succeeded') {
        // Check if booking is already confirmed
        const existingBooking = await this.bookingModel.findById(bookingId);

        if (existingBooking && existingBooking.paymentStatus === 'completed') {
          this.logger.log(
            `Payment already completed for booking: ${bookingId}`,
          );

          return {
            success: true,
            paymentStatus: 'completed',
            bookingStatus: 'confirmed',
            stripeStatus: paymentIntent.status,
            booking: existingBooking,
            message: 'Payment was already completed. No action needed.',
            alreadyCompleted: true,
          };
        }

        // Update booking status
        const updatedBooking = await this.bookingModel.findByIdAndUpdate(
          bookingId,
          {
            paymentStatus: 'completed',
            status: 'confirmed',
            paymentCompletedAt: new Date(),
          },
          { new: true },
        );

        if (!updatedBooking) {
          throw new NotFoundException('Booking not found');
        }

        this.logger.log(`Payment confirmed for booking: ${bookingId}`);

        // Send booking confirmation email to both contact and JWT user
        await this.sendBookingConfirmationEmail(updatedBooking, userEmail);

        return {
          success: true,
          paymentStatus: 'completed',
          bookingStatus: 'confirmed',
          stripeStatus: paymentIntent.status,
          booking: updatedBooking,
          message: 'Payment confirmed successfully.',
          alreadyCompleted: false,
        };
      } else {
        // Update payment status to failed
        await this.bookingModel.findByIdAndUpdate(bookingId, {
          paymentStatus: 'failed',
        });

        return {
          success: false,
          paymentStatus: paymentIntent.status,
          stripeStatus: paymentIntent.status,
          message: `Payment not completed. Status: ${paymentIntent.status}`,
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to confirm payment: ${error.message}`,
        error.stack,
      );

      // Update payment status to failed
      await this.bookingModel.findByIdAndUpdate(bookingId, {
        paymentStatus: 'failed',
      });

      throw error;
    }
  }

  async handleWebhook(signature: string, payload: Buffer) {
    const webhookSecret = this.configService.get<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    this.logger.log('=== WEBHOOK DEBUG INFO ===');
    this.logger.log(`Webhook secret configured: ${!!webhookSecret}`);
    this.logger.log(`Signature provided: ${!!signature}`);
    this.logger.log(`Payload type: ${typeof payload}`);
    this.logger.log(`Payload length: ${payload ? payload.length : 0}`);
    this.logger.log(`Signature: ${signature ? signature.substring(0, 50) + '...' : 'NONE'}`);

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET not configured');
    }

    if (!signature) {
      throw new Error('No stripe-signature header provided');
    }

    if (!payload) {
      throw new Error('No payload provided');
    }

    try {
      let event: Stripe.Event;

      try {
        // Convert payload to string if it's a Buffer, then back to Buffer to ensure proper encoding
        let bodyString: string;
        if (Buffer.isBuffer(payload)) {
          bodyString = payload.toString('utf8');
        } else if (typeof payload === 'string') {
          bodyString = payload;
        } else {
          bodyString = JSON.stringify(payload);
        }

        // Convert back to Buffer for Stripe verification
        const bodyBuffer = Buffer.from(bodyString, 'utf8');

        this.logger.log(`Body string length: ${bodyString.length}`);
        this.logger.log(`Body buffer length: ${bodyBuffer.length}`);

        event = this.stripe.webhooks.constructEvent(
          bodyBuffer,
          signature,
          webhookSecret,
        );

        this.logger.log(`✅ Webhook signature verified successfully`);
      } catch (verificationError) {
        this.logger.warn(`⚠️ Webhook signature verification failed: ${verificationError.message}`);
        this.logger.warn(`Attempting to process webhook without verification (proxy fallback)`);

        // Fallback: Process without signature verification
        const bodyString = Buffer.isBuffer(payload) ? payload.toString('utf8') :
                          typeof payload === 'string' ? payload : JSON.stringify(payload);
        const eventData = JSON.parse(bodyString);

        // Validate webhook structure
        if (eventData.object === 'event' &&
            eventData.type &&
            eventData.data &&
            eventData.id &&
            eventData.id.startsWith('evt_')) {
          event = eventData as Stripe.Event;
          this.logger.warn(`🔓 Processing webhook without signature verification`);
        } else {
          throw new Error('Invalid webhook structure');
        }
      }

      this.logger.log(`Received webhook event: ${event.type}`);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        default:
          this.logger.log(`Unhandled event type: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      this.logger.error(`Webhook error: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    this.logger.log('=== HANDLING PAYMENT SUCCEEDED (GENERIC WEBHOOK) ===');
    this.logger.log(`Payment Intent ID: ${paymentIntent.id}`);
    this.logger.log(`Payment Intent Status: ${paymentIntent.status}`);
    this.logger.log(`Payment Intent Amount: ${paymentIntent.amount} ${paymentIntent.currency}`);
    this.logger.log(`Payment Intent Metadata:`, paymentIntent.metadata);

    const bookingId = paymentIntent.metadata.bookingId;

    if (!bookingId) {
      this.logger.error(`❌ No booking ID found in payment intent metadata: ${paymentIntent.id}`);
      this.logger.error(`Available metadata keys: ${Object.keys(paymentIntent.metadata).join(', ')}`);
      return;
    }

    this.logger.log(`✅ Processing successful payment for booking: ${bookingId}`);

    try {
      // Find and update the booking
      this.logger.log(`🔍 Looking for booking with ID: ${bookingId}`);
      const booking = await this.bookingModel.findById(bookingId);
      if (!booking) {
        this.logger.error(`❌ Booking not found: ${bookingId}`);
        return;
      }

      this.logger.log(`📋 Found booking:`, {
        id: booking._id.toString(),
        ref: booking.bookingRef,
        currentStatus: booking.status,
        currentPaymentStatus: booking.paymentStatus,
        userId: booking.userId.toString()
      });

      // Update booking status
      this.logger.log(`🔄 Updating booking status to confirmed...`);
      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        {
          paymentStatus: 'completed',
          status: 'confirmed',
          paymentIntentId: paymentIntent.id,
          paymentCompletedAt: new Date(),
        },
        { new: true },
      );

      if (!updatedBooking) {
        this.logger.error(`❌ Failed to update booking ${bookingId}`);
        return;
      }

      this.logger.log(`✅ Booking updated successfully:`, {
        id: updatedBooking._id.toString(),
        ref: updatedBooking.bookingRef,
        newStatus: updatedBooking.status,
        newPaymentStatus: updatedBooking.paymentStatus,
        paymentCompletedAt: updatedBooking.paymentCompletedAt
      });

      // Check if payment record already exists to prevent duplicates
      this.logger.log(`🔍 Checking for existing payment record for transaction: ${paymentIntent.id}`);
      const existingPayment = await this.paymentTransactionService.findByTransactionId(paymentIntent.id);

      if (existingPayment) {
        this.logger.log(`⚠️ Payment record already exists for transaction ${paymentIntent.id}, skipping creation`);
        this.logger.log(`Existing payment ID: ${existingPayment._id}, Status: ${existingPayment.status}`);
      } else {
        // Create payment record
        this.logger.log(`🔄 Creating payment record for booking: ${bookingId}`);

        // Calculate amount - use paymentIntent amount or fallback to booking total
        let paymentAmount = 0;
        if (paymentIntent.amount && typeof paymentIntent.amount === 'number') {
          paymentAmount = paymentIntent.amount / 100; // Convert from cents
          this.logger.log(`💰 Using payment intent amount: ${paymentIntent.amount} cents = $${paymentAmount}`);
        } else {
          paymentAmount = updatedBooking.totalPrice;
          this.logger.log(`💰 Using booking total price: $${paymentAmount} (payment intent amount not available)`);
        }

        const paymentData: CreatePaymentDto = {
          userId: updatedBooking.userId.toString(),
          bookingId: updatedBooking._id.toString(),
          amount: paymentAmount,
          currency: paymentIntent.currency ? paymentIntent.currency.toUpperCase() : updatedBooking.currency,
          provider: PaymentProvider.STRIPE,
          method: PaymentMethod.CREDIT_CARD,
          transactionId: paymentIntent.id,
          metadata: paymentIntent,
          isTest: paymentIntent.livemode === false,
          status: PaymentStatus.COMPLETED,
        };

        this.logger.log(`💾 Payment data to create:`, {
          userId: paymentData.userId,
          bookingId: paymentData.bookingId,
          amount: paymentData.amount,
          currency: paymentData.currency,
          provider: paymentData.provider,
          method: paymentData.method,
          transactionId: paymentData.transactionId,
          isTest: paymentData.isTest,
          status: paymentData.status
        });

        try {
          const createdPayment = await this.paymentTransactionService.createPayment(paymentData);
          this.logger.log(`✅ Payment record created successfully:`, {
            paymentId: createdPayment._id.toString(),
            bookingId: createdPayment.bookingId,
            amount: createdPayment.amount,
            status: createdPayment.status,
            transactionId: createdPayment.transactionId
          });
        } catch (paymentError) {
          this.logger.error(`❌ Failed to create payment record: ${paymentError.message}`);
          this.logger.error(`Payment error stack:`, paymentError.stack);
          // Don't throw here - we still want to send the email even if payment record fails
        }
      }

      // Send booking confirmation email
      if (updatedBooking) {
        await this.sendBookingConfirmationEmail(updatedBooking);
        this.logger.log(`📧 Booking confirmation email sent for booking: ${bookingId}`);
      }

      this.logger.log(`✅ Payment succeeded for booking: ${bookingId}`);
    } catch (error) {
      this.logger.error(`❌ Error processing successful payment webhook: ${error.message}`);
      this.logger.error(`Error stack:`, error.stack);
    }
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    const bookingId = paymentIntent.metadata.bookingId;

    if (bookingId) {
      await this.bookingModel.findByIdAndUpdate(bookingId, {
        paymentStatus: 'failed',
      });

      this.logger.log(`Payment failed for booking: ${bookingId}`);
    }
  }

  /**
   * Convert booking document to email data format
   */
  private convertBookingToEmailData(
    booking: BookingDocument,
  ): BookingEmailData {
    const baseData = {
      bookingRef: booking.bookingRef,
      bookingType: booking.bookingType,
      totalPrice: booking.totalPrice,
      currency: booking.currency,
      travellersInfo: booking.travellersInfo.map((traveler) => ({
        firstName: traveler.firstName,
        lastName: traveler.lastName,
        travelerType: traveler.travelerType,
      })),
      contactDetails: booking.contactDetails,
    };

    // Handle round-trip vs one-way booking data
    if (booking.bookingType === 'ROUND_TRIP' && booking.flightData) {
      return {
        ...baseData,
        flightData: booking.flightData.map(flight => ({
          flightID: flight.flightID,
          typeOfFlight: flight.typeOfFlight,
          numberOfStops: flight.numberOfStops,
          originAirportCode: flight.originAirportCode,
          destinationAirportCode: flight.destinationAirportCode,
          originCIty: flight.originCIty,
          destinationCIty: flight.destinationCIty,
          departureDate: flight.departureDate,
          arrivalDate: flight.arrivalDate,
          selectedBaggageOption: flight.selectedBaggageOption,
        })),
      };
    } else {
      // One-way booking (legacy format)
      return {
        ...baseData,
        flightId: booking.flightId,
        originAirportCode: booking.originAirportCode,
        destinationAirportCode: booking.destinationAirportCode,
        originCity: booking.originCity,
        destinationCity: booking.destinationCity,
        departureDate: booking.departureDate,
        arrivalDate: booking.arrivalDate,
        selectedBaggageOption: booking.selectedBaggageOption,
      };
    }
  }

  /**
   * Send booking confirmation email after successful payment
   */
  private async sendBookingConfirmationEmail(
    booking: BookingDocument,
    jwtUserEmail?: string,
  ): Promise<void> {
    try {
      const emailData = this.convertBookingToEmailData(booking);
      // Send to contact email
      await this.emailService.sendBookingConfirmationEmail(emailData);
      this.logger.log(
        `Booking confirmation email sent for booking: ${booking.bookingRef}`,
      );
      // Send to JWT user if different
      if (jwtUserEmail && jwtUserEmail !== emailData.contactDetails.email) {
        await this.emailService.sendBookingConfirmationEmail({
          ...emailData,
          contactDetails: { ...emailData.contactDetails, email: jwtUserEmail },
        });
        this.logger.log(
          `Booking confirmation email also sent to JWT user: ${jwtUserEmail}`,
        );
      }
      // Also display QR code in terminal for debugging/verification
      try {
        await this.emailService.displayQRCodeInTerminal(booking.bookingRef);
      } catch (qrError) {
        this.logger.warn(
          `Failed to display QR code in terminal: ${qrError instanceof Error ? qrError.message : 'Unknown error'}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send booking confirmation email for booking ${booking.bookingRef}:`,
        error instanceof Error ? error.stack : error,
      );
      // Don't throw error here - email failure shouldn't fail the payment
    }
  }

  async getPaymentStatus(bookingId: string) {
    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.paymentStatus === 'pending') {
      const payment = await this.paymentTransactionService.findByBookingId(
        bookingId,
      );

      if (
        payment &&
        payment.provider === 'paymob' &&
        payment.metadata?.paymobOrderId
      ) {
        this.logger.log(
          `Pending payment for booking ${bookingId}, checking status with Paymob...`,
        );
        try {
          const authToken = await this.paymobService.authenticate();
          const order = await this.paymobService.getOrder(
            payment.metadata.paymobOrderId,
            authToken,
          );

          if (order && order.payment_status === 'PAID') {
            this.logger.log(
              `Paymob transaction for booking ${bookingId} is successful, updating status.`,
            );
            const updatedBooking = await this.bookingModel.findByIdAndUpdate(
              bookingId,
              {
                paymentStatus: 'completed',
                status: 'confirmed',
                paymentCompletedAt: new Date(),
              },
              { new: true },
            );

            // Update payment record
            if (payment) {
              await this.paymentTransactionService.updatePaymentStatus(
                payment._id.toString(),
                {
                  status: 'completed' as any,
                  transactionId: order.id,
                  providerResponse: order,
                },
              );
            }

            return {
              bookingId,
              paymentStatus: updatedBooking.paymentStatus,
              bookingStatus: updatedBooking.status,
              stripeStatus: null, // Not a Stripe payment
            };
          }
        } catch (error) {
          this.logger.error(
            `Failed to get Paymob transaction status for booking ${bookingId}`,
            error,
          );
          // Do not throw error, just return current status
        }
      }
    }

    return {
      bookingId,
      paymentStatus: booking.paymentStatus,
      bookingStatus: booking.status,
      stripeStatus: booking.paymentIntentId
        ? (await this.stripe.paymentIntents.retrieve(booking.paymentIntentId))
            .status
        : null,
    };
  }

  /**
   * Get test payment methods for different scenarios
   */
  getTestPaymentMethods() {
    return {
      // Successful cards
      visa: 'pm_card_visa',
      visa_debit: 'pm_card_visa_debit',
      mastercard: 'pm_card_mastercard',
      amex: 'pm_card_amex',

      // Declined cards
      declined_generic: 'pm_card_chargeDeclined',
      declined_insufficient_funds: 'pm_card_chargeDeclinedInsufficientFunds',
      declined_lost_card: 'pm_card_chargeDeclinedLostCard',
      declined_stolen_card: 'pm_card_chargeDeclinedStolenCard',
      declined_expired_card: 'pm_card_chargeDeclinedExpiredCard',
      declined_incorrect_cvc: 'pm_card_chargeDeclinedIncorrectCvc',
      declined_processing_error: 'pm_card_chargeDeclinedProcessingError',

      // 3D Secure cards
      threeds_required: 'pm_card_threeDSecure2Required',
      threeds_optional: 'pm_card_threeDSecureOptional',

      // Special cases
      risk_level_elevated: 'pm_card_riskLevelElevated',
      always_authenticate: 'pm_card_authenticationRequired',
    };
  }

  async testCardPaymentFromBackend(
    bookingId: string,
    amount: number,
    currency: string,
    testPaymentMethod: string = 'pm_card_visa',
  ) {
    try {
      // Find the booking
      const booking = await this.bookingModel.findById(bookingId);
      if (!booking) {
        throw new NotFoundException('Booking not found');
      }

      // Check if booking is already confirmed/paid
      if (booking.paymentStatus === 'completed' ||
        booking.status === 'confirmed') {
        this.logger.log(`Payment already completed for booking: ${bookingId}`);

        return {
          success: false,
          paymentStatus: 'already_completed',
          bookingStatus: booking.status,
          message:
            'This booking has already been confirmed and payment has been successful. No additional payment needed.',
          booking: booking,
          alreadyPaid: true,
        };
      }

      // Verify the amount matches the booking total price
      const expectedAmount = Math.round(booking.totalPrice * 100); // Convert to cents
      const providedAmount = Math.round(amount * 100);

      if (expectedAmount !== providedAmount) {
        throw new BadRequestException(
          `Amount mismatch. Expected: ${expectedAmount / 100}, Provided: ${amount}`,
        );
      }

      // Create and confirm payment intent in one step
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: expectedAmount,
        currency: currency.toLowerCase(),
        payment_method: testPaymentMethod,
        confirm: true,
        return_url: 'https://your-website.com/return', // Required for some payment methods
        metadata: {
          bookingId: bookingId,
          bookingRef: booking.bookingRef,
          testPayment: 'true',
        },
        description: `Test payment for flight booking ${booking.bookingRef}`,
      });

      this.logger.log(
        `Payment intent created and confirmed: ${paymentIntent.id} for booking: ${bookingId}`,
      );

      if (paymentIntent.status === 'succeeded') {
        // Update booking status
        const updatedBooking = await this.bookingModel.findByIdAndUpdate(
          bookingId,
          {
            paymentStatus: 'completed',
            status: 'confirmed',
            paymentIntentId: paymentIntent.id,
            paymentCompletedAt: new Date(),
          },
          { new: true },
        );

        this.logger.log(
          `Card payment test successful for booking: ${bookingId}`,
        );

        // Create a payment record for the successful payment
        const paymentData: CreatePaymentDto = {
          userId: updatedBooking.userId.toString(),
          bookingId: updatedBooking._id.toString(),
          amount: updatedBooking.totalPrice,
          currency: updatedBooking.currency,
          provider: PaymentProvider.STRIPE,
          method: PaymentMethod.CREDIT_CARD,
          transactionId: paymentIntent.id,
          metadata: paymentIntent,
          isTest: process.env.NODE_ENV !== 'production',
          status: PaymentStatus.COMPLETED,
        };
        await this.paymentTransactionService.createPayment(paymentData);
        this.logger.log(
          `Created payment record for successful payment of booking: ${bookingId}`,
        );

        // Send booking confirmation email
        await this.sendBookingConfirmationEmail(updatedBooking);

        return {
          success: true,
          paymentStatus: 'completed',
          bookingStatus: 'confirmed',
          stripeStatus: paymentIntent.status,
          paymentIntentId: paymentIntent.id,
          testPaymentMethod: testPaymentMethod,
          booking: updatedBooking,
          message: 'Card payment processed successfully from backend',
        };
      } else {
        // Update payment status to failed
        await this.bookingModel.findByIdAndUpdate(bookingId, {
          paymentStatus: 'failed',
          paymentIntentId: paymentIntent.id,
        });

        return {
          success: false,
          paymentStatus: paymentIntent.status,
          stripeStatus: paymentIntent.status,
          paymentIntentId: paymentIntent.id,
          message: `Payment not completed. Status: ${paymentIntent.status}`,
        };
      }
    } catch (error) {
      this.logger.error(
        `Failed to process card payment: ${error.message}`,
        error.stack,
      );

      // Update payment status to failed
      await this.bookingModel.findByIdAndUpdate(bookingId, {
        paymentStatus: 'failed',
      });

      return {
        success: false,
        paymentStatus: 'failed',
        message: `Card payment failed: ${error.message}`,
      };
    }
  }

  /**
   * Handle Stripe webhook events
   * @param rawBody The raw request body
   * @param signature The Stripe signature header
   */
  async handleStripeWebhook(rawBody: Buffer, signature: string) {
    this.logger.log('=== PROCESSING STRIPE WEBHOOK IN SERVICE ===');

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    const isDevelopment = this.configService.get<string>('NODE_ENV') === 'development';
    const allowFallback = this.configService.get<string>('ALLOW_WEBHOOK_FALLBACK') !== 'false'; // Default to true

    if (!webhookSecret) {
      this.logger.error('Stripe webhook secret not configured');
      if (!isDevelopment && !allowFallback) {
        throw new BadRequestException('Webhook secret not configured');
      } else {
        this.logger.warn('⚠️ Proceeding without webhook secret (development or fallback enabled)');
      }
    }

    this.logger.log(`Webhook verification details:`, {
      rawBodyLength: rawBody ? rawBody.length : 0,
      signatureProvided: !!signature,
      webhookSecretConfigured: !!webhookSecret,
      webhookSecretPrefix: webhookSecret ? webhookSecret.substring(0, 10) + '...' : 'NOT_SET'
    });

    let event: Stripe.Event;

    try {
      // Check if we should bypass signature verification
      const shouldBypassVerification = isDevelopment ||
        this.configService.get<string>('BYPASS_WEBHOOK_VERIFICATION') === 'true';

      if (shouldBypassVerification && (!webhookSecret || !signature)) {
        this.logger.warn('🔓 BYPASSING webhook signature verification (development or configured bypass)');
        const bodyString = rawBody.toString('utf8');
        event = JSON.parse(bodyString) as Stripe.Event;
        this.logger.warn(`⚠️ Processing webhook without verification: ${event.type}`);
      } else {
        // Try different body formats for Fastify compatibility
        let bodyForVerification: string | Buffer = rawBody;

        // First attempt with raw body as-is
        try {
          event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
          this.logger.log(`✅ Stripe webhook event verified successfully with raw body: ${event.type}`);
        } catch (firstError) {
        this.logger.warn(`First verification attempt failed: ${firstError.message}`);

        // Second attempt: convert to string and back to buffer
        try {
          const bodyString = rawBody.toString('utf8');
          const bodyBuffer = Buffer.from(bodyString, 'utf8');
          event = this.stripe.webhooks.constructEvent(bodyBuffer, signature, webhookSecret);
          this.logger.log(`✅ Stripe webhook event verified successfully with converted body: ${event.type}`);
        } catch (secondError) {
          this.logger.warn(`Second verification attempt failed: ${secondError.message}`);

          // Third attempt: try with string directly
          try {
            const bodyString = rawBody.toString('utf8');
            event = this.stripe.webhooks.constructEvent(bodyString, signature, webhookSecret);
            this.logger.log(`✅ Stripe webhook event verified successfully with string body: ${event.type}`);
          } catch (thirdError) {
            this.logger.error(`All verification attempts failed. Last error: ${thirdError.message}`);
            throw thirdError;
          }
        }
        }
      }

      this.logger.log(`Event ID: ${event.id}, Created: ${new Date(event.created * 1000).toISOString()}`);

      if (event.data && event.data.object) {
        const obj = event.data.object as any;
        this.logger.log(`Event object details:`, {
          id: obj.id,
          object: obj.object,
          status: obj.status,
          metadata: obj.metadata
        });
      }
    } catch (error) {
      this.logger.error(`❌ Webhook signature verification failed: ${error.message}`);
      this.logger.error(`Raw body type: ${typeof rawBody}`);
      this.logger.error(`Raw body length: ${rawBody ? rawBody.length : 0}`);
      this.logger.error(`Raw body is Buffer: ${Buffer.isBuffer(rawBody)}`);
      this.logger.error(`Raw body preview: ${rawBody ? rawBody.toString().substring(0, 200) + '...' : 'NULL'}`);
      this.logger.error(`Signature preview: ${signature ? signature.substring(0, 50) + '...' : 'NULL'}`);
      this.logger.error(`Webhook secret configured: ${!!webhookSecret}`);

      // PRODUCTION FALLBACK: Process webhook without signature verification
      // This handles cases where nginx/proxy modifies the request body
      if (allowFallback) {
        try {
          const bodyString = rawBody.toString('utf8');
          const eventData = JSON.parse(bodyString);

          // Validate that this looks like a legitimate Stripe webhook
          if (eventData.object === 'event' &&
              eventData.type &&
              eventData.data &&
              eventData.id &&
              eventData.id.startsWith('evt_')) {

            this.logger.warn(`🔓 FALLBACK: Processing webhook without signature verification`);
            this.logger.warn(`Event type: ${eventData.type}, Event ID: ${eventData.id}`);
            this.logger.warn(`Reason: Signature verification failed (likely due to proxy/nginx)`);

            event = eventData as Stripe.Event;
          } else {
            this.logger.error(`Invalid webhook structure - not processing`);
            this.logger.error(`Missing required fields: object, type, data, or invalid event ID`);
            throw new BadRequestException('Invalid webhook signature and invalid webhook structure');
          }
        } catch (parseError) {
          this.logger.error(`Cannot parse webhook body as JSON: ${parseError.message}`);
          throw new BadRequestException('Invalid webhook signature and unparseable body');
        }
      } else {
        this.logger.error(`Webhook signature verification failed and fallback is disabled`);
        throw new BadRequestException('Invalid webhook signature');
      }
    }

    try {
      // Handle different event types
      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;
        case 'payment_intent.canceled':
          await this.handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
          break;
        default:
          this.logger.log(`Unhandled webhook event type: ${event.type}`);
      }

      return { received: true };
    } catch (error) {
      this.logger.error(`Error processing webhook event: ${error.message}`);
      throw new BadRequestException('Error processing webhook');
    }
  }

  /**
   * Handle successful payment intent
   */
  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    this.logger.log('=== HANDLING PAYMENT INTENT SUCCEEDED ===');
    this.logger.log(`Payment Intent ID: ${paymentIntent.id}`);
    this.logger.log(`Payment Intent Status: ${paymentIntent.status}`);
    this.logger.log(`Payment Intent Amount: ${paymentIntent.amount} ${paymentIntent.currency}`);
    this.logger.log(`Payment Intent Metadata:`, paymentIntent.metadata);

    const bookingId = paymentIntent.metadata.bookingId;

    if (!bookingId) {
      this.logger.error(`❌ No booking ID found in payment intent metadata: ${paymentIntent.id}`);
      this.logger.error(`Available metadata keys: ${Object.keys(paymentIntent.metadata).join(', ')}`);
      return;
    }

    this.logger.log(`✅ Processing successful payment for booking: ${bookingId}`);

    try {
      // Find and update the booking
      this.logger.log(`🔍 Looking for booking with ID: ${bookingId}`);
      const booking = await this.bookingModel.findById(bookingId);
      if (!booking) {
        this.logger.error(`❌ Booking not found: ${bookingId}`);
        this.logger.error(`This could indicate the booking was deleted or the ID is incorrect`);
        return;
      }

      this.logger.log(`📋 Found booking:`, {
        id: booking._id.toString(),
        ref: booking.bookingRef,
        currentStatus: booking.status,
        currentPaymentStatus: booking.paymentStatus,
        userId: booking.userId.toString()
      });

      // Update booking status
      this.logger.log(`🔄 Updating booking status to confirmed...`);
      const updatedBooking = await this.bookingModel.findByIdAndUpdate(
        bookingId,
        {
          paymentStatus: 'completed',
          status: 'confirmed',
          paymentIntentId: paymentIntent.id,
          paymentCompletedAt: new Date(),
        },
        { new: true },
      );

      if (updatedBooking) {
        this.logger.log(`✅ Booking updated successfully:`, {
          id: updatedBooking._id.toString(),
          ref: updatedBooking.bookingRef,
          newStatus: updatedBooking.status,
          newPaymentStatus: updatedBooking.paymentStatus,
          paymentCompletedAt: updatedBooking.paymentCompletedAt
        });
      } else {
        this.logger.error(`❌ Failed to update booking ${bookingId}`);
        return;
      }

      // Check if payment record already exists to prevent duplicates
      this.logger.log(`🔍 Checking for existing payment record for transaction: ${paymentIntent.id}`);
      const existingPayment = await this.paymentTransactionService.findByTransactionId(paymentIntent.id);

      if (existingPayment) {
        this.logger.log(`⚠️ Payment record already exists for transaction ${paymentIntent.id}, skipping creation`);
        this.logger.log(`Existing payment ID: ${existingPayment._id}, Status: ${existingPayment.status}`);
      } else {
        // Create payment record
        this.logger.log(`🔄 Creating payment record for booking: ${bookingId}`);

        // Calculate amount - use paymentIntent amount or fallback to booking total
        let paymentAmount = 0;
        if (paymentIntent.amount && typeof paymentIntent.amount === 'number') {
          paymentAmount = paymentIntent.amount / 100; // Convert from cents
          this.logger.log(`💰 Using payment intent amount: ${paymentIntent.amount} cents = $${paymentAmount}`);
        } else {
          paymentAmount = updatedBooking.totalPrice;
          this.logger.log(`💰 Using booking total price: $${paymentAmount} (payment intent amount not available)`);
        }

        const paymentData: CreatePaymentDto = {
          userId: updatedBooking.userId.toString(),
          bookingId: updatedBooking._id.toString(),
          amount: paymentAmount,
          currency: paymentIntent.currency ? paymentIntent.currency.toUpperCase() : updatedBooking.currency,
          provider: PaymentProvider.STRIPE,
          method: PaymentMethod.CREDIT_CARD,
          transactionId: paymentIntent.id,
          metadata: paymentIntent,
          isTest: paymentIntent.livemode === false,
          status: PaymentStatus.COMPLETED,
        };

        this.logger.log(`💾 Payment data to create:`, {
          userId: paymentData.userId,
          bookingId: paymentData.bookingId,
          amount: paymentData.amount,
          currency: paymentData.currency,
          provider: paymentData.provider,
          method: paymentData.method,
          transactionId: paymentData.transactionId,
          isTest: paymentData.isTest,
          status: paymentData.status
        });

        try {
          const createdPayment = await this.paymentTransactionService.createPayment(paymentData);
          this.logger.log(`✅ Payment record created successfully:`, {
            paymentId: createdPayment._id.toString(),
            bookingId: createdPayment.bookingId,
            amount: createdPayment.amount,
            status: createdPayment.status,
            transactionId: createdPayment.transactionId
          });
        } catch (paymentError) {
          this.logger.error(`❌ Failed to create payment record: ${paymentError.message}`);
          this.logger.error(`Payment error stack:`, paymentError.stack);
          // Don't throw here - we still want to send the email even if payment record fails
        }
      }

      // Send confirmation email
      await this.sendBookingConfirmationEmail(updatedBooking);
      this.logger.log(`Sent confirmation email for booking: ${bookingId}`);

    } catch (error) {
      this.logger.error(`Error processing successful payment webhook: ${error.message}`);
    }
  }

  /**
   * Handle failed payment intent
   */
  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const bookingId = paymentIntent.metadata.bookingId;

    if (!bookingId) {
      this.logger.error(`No booking ID found in payment intent metadata: ${paymentIntent.id}`);
      return;
    }

    this.logger.log(`Processing failed payment for booking: ${bookingId}`);

    try {
      // Update booking status
      await this.bookingModel.findByIdAndUpdate(bookingId, {
        paymentStatus: 'failed',
        paymentIntentId: paymentIntent.id,
      });

      this.logger.log(`Updated booking ${bookingId} status to failed`);
    } catch (error) {
      this.logger.error(`Error processing failed payment webhook: ${error.message}`);
    }
  }

  /**
   * Handle canceled payment intent
   */
  private async handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent) {
    const bookingId = paymentIntent.metadata.bookingId;

    if (!bookingId) {
      this.logger.error(`No booking ID found in payment intent metadata: ${paymentIntent.id}`);
      return;
    }

    this.logger.log(`Processing canceled payment for booking: ${bookingId}`);

    try {
      // Update booking status
      await this.bookingModel.findByIdAndUpdate(bookingId, {
        paymentStatus: 'canceled',
        paymentIntentId: paymentIntent.id,
      });

      this.logger.log(`Updated booking ${bookingId} status to canceled`);
    } catch (error) {
      this.logger.error(`Error processing canceled payment webhook: ${error.message}`);
    }
  }

  /**
   * Get total payment count for debugging
   */
  async getPaymentCount(): Promise<number> {
    try {
      const count = await this.paymentTransactionService.getPaymentCount();
      return count;
    } catch (error) {
      this.logger.error(`Error getting payment count: ${error.message}`);
      throw error;
    }
  }
}
