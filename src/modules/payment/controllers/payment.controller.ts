import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Param,
  HttpStatus,
  HttpCode,
  Headers,
  RawBodyRequest,
  Req,
  Logger,
  Query,
} from '@nestjs/common';
import { PaymentService } from '../services/payment.service';
import { CreatePaymentIntentDto } from '../dto/create-payment-intent.dto';
import { ConfirmPaymentDto } from '../dto/confirm-payment.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { VerifiedUserGuard } from 'src/common/guards/verifiedUser.guard';
import { User } from 'src/common/decorators/user.decorator';
import { JwtUser } from 'src/common/interfaces/jwtUser.interface';

import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  HttpException,
} from '@nestjs/common';
import { PaymobService } from '../services/paymob.service';
import { PaymentTransactionService } from '../services/payment-transaction.service';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import {
  CreatePaymobPaymentDto,
  PaymobPaymentResponseDto,
} from '../dto/paymob-payment.dto';
import { BookingService } from '../../booking/services/booking.service';

@Controller('payment')
export class PaymentController {
  private readonly logger = new Logger(PaymentController.name);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly paymobService: PaymobService,
    private readonly paymentTransactionService: PaymentTransactionService,
    private readonly configService: ConfigService,
    private readonly bookingService: BookingService,
  ) {}

  @Post('create-payment-intent')
  @UseGuards(JwtAuthGuard, VerifiedUserGuard)
  @HttpCode(HttpStatus.OK)
  async createPaymentIntent(
    @User() user: JwtUser,
    @Body() createPaymentIntentDto: CreatePaymentIntentDto,
  ) {
    this.logger.log(`Creating payment intent for testing`);

    const paymentIntent = await this.paymentService.createPaymentIntent(
      createPaymentIntentDto,
    );

    return {
      success: true,
      message: 'Payment intent created successfully',
      data: paymentIntent,
      error: null,
      meta: null,
    };
  }

  @Post('confirm-payment')
  @UseGuards(JwtAuthGuard, VerifiedUserGuard)
  @HttpCode(HttpStatus.OK)
  async confirmPayment(
    @User() user: JwtUser,
    @Body() confirmPaymentDto: ConfirmPaymentDto,
  ) {
    this.logger.log(`Confirming payment for user: ${user.id}`);

    // Attach the JWT user's email to the DTO
    confirmPaymentDto.userEmail = user.email;

    const result = await this.paymentService.confirmPayment(confirmPaymentDto);

    // Use the message from the service if available, otherwise use default
    const message =
      result.message ||
      (result.success
        ? 'Payment confirmed successfully'
        : 'Payment confirmation failed');

    return {
      success: result.success,
      message: message,
      data: result,
      error: null,
      meta: null,
    };
  }

  @Get('status/:bookingId')
  @UseGuards(JwtAuthGuard)
  async getPaymentStatus(
    @Param('bookingId') bookingId: string,
    @User() user: JwtUser,
  ) {
    this.logger.log(
      `Getting payment status for booking: ${bookingId}, user: ${user.id}`,
    );

    const status = await this.paymentService.getPaymentStatus(bookingId);

    return {
      success: true,
      message: 'Payment status retrieved successfully',
      data: status,
      error: null,
      meta: null,
    };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Headers('x-paymob-signature') paymobSignature: string,
    @Headers('x-provider') provider: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    this.logger.log('=== GENERIC WEBHOOK RECEIVED ===');
    this.logger.log(`Headers received:`, {
      'stripe-signature': signature ? `${signature.substring(0, 20)}...` : 'NOT_PROVIDED',
      'x-paymob-signature': paymobSignature ? `${paymobSignature.substring(0, 20)}...` : 'NOT_PROVIDED',
      'x-provider': provider || 'NOT_PROVIDED',
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent'],
    });

    try {
      if (provider === 'paymob') {
        this.logger.log('Processing as Paymob webhook');
        return this.paymobService.handleWebhook(paymobSignature, req.rawBody);
      } else if (provider === 'stripe' || signature) {
        this.logger.log('Processing as Stripe webhook via generic endpoint');
        return this.paymentService.handleWebhook(signature, req.rawBody);
      } else {
        this.logger.warn('Unknown webhook provider or missing signature');
        this.logger.warn('If this is a Stripe webhook, use /payment/stripe/webhook endpoint instead');
        return { received: false, error: 'Unknown provider or missing signature' };
      }
    } catch (error) {
      this.logger.error(`Generic webhook processing failed: ${error.message}`);
      throw error;
    }
  }

  @Post('test-card-payment')
  @UseGuards(JwtAuthGuard, VerifiedUserGuard)
  @HttpCode(HttpStatus.OK)
  async testCardPayment(
    @User() user: JwtUser,
    @Body()
    body: {
      bookingId: string;
      testCard?: string;
      amount: number;
      currency: string;
    },
  ) {
    this.logger.log(`Testing card payment`);

    const result = await this.paymentService.testCardPaymentFromBackend(
      body.bookingId,
      body.amount,
      body.currency,
      body.testCard || 'pm_card_visa',
    );

    return {
      success: result.success,
      message: result.success
        ? 'Card payment test successful'
        : 'Card payment test failed',
      data: result,
      error: null,
      meta: null,
    };
  }

  @Post('stripe/webhook')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() request: any,
    @Headers('stripe-signature') signature: string,
  ) {
    this.logger.log('=== STRIPE WEBHOOK RECEIVED ===');
    this.logger.log(`Stripe webhook details:`, {
      'stripe-signature': signature ? `${signature.substring(0, 20)}...` : 'NOT_PROVIDED',
      'content-type': request.headers['content-type'],
      'user-agent': request.headers['user-agent'],
      'content-length': request.headers['content-length'],
      'rawBodyExists': !!request.rawBody,
      'rawBodyLength': request.rawBody ? request.rawBody.length : 0,
    });

    try {
      const result = await this.paymentService.handleStripeWebhook(request.rawBody, signature);
      this.logger.log('Stripe webhook processed successfully');
      return result;
    } catch (error) {
      this.logger.error(`Stripe webhook processing failed: ${error.message}`);
      this.logger.error(`Error stack: ${error.stack}`);
      throw error;
    }
  }

  @Get('stripe/config')
  @HttpCode(HttpStatus.OK)
  async getStripeConfig() {
    const stripePublicKey = this.configService.get<string>('STRIPE_PUBLIC_KEY');
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');

    return {
      success: true,
      data: {
        publicKey: stripePublicKey,
        secretKeyPrefix: stripeSecretKey ? stripeSecretKey.substring(0, 12) + '...' : 'NOT_SET',
        keysMatch: stripePublicKey && stripeSecretKey &&
                   stripePublicKey.includes(stripeSecretKey.split('_')[2]) // Extract account ID
      },
      message: 'Stripe configuration retrieved'
    };
  }

  @Get('stripe/test-cards')
  @HttpCode(HttpStatus.OK)
  async getTestCards() {
    return {
      success: true,
      data: this.paymentService.getTestPaymentMethods(),
      message: 'Test payment methods retrieved'
    };
  }

  // Test endpoints removed for production security

  @Get('debug/payment-intent/:paymentIntentId')
  @UseGuards(JwtAuthGuard, VerifiedUserGuard)
  @HttpCode(HttpStatus.OK)
  async debugPaymentIntent(
    @User() user: JwtUser,
    @Param('paymentIntentId') paymentIntentId: string,
  ) {
    this.logger.log(`Debugging payment intent: ${paymentIntentId} for user: ${user.id}`);

    try {
      const paymentIntent = await this.paymentService.getPaymentIntentDetails(paymentIntentId);

      return {
        success: true,
        data: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          client_secret_prefix: paymentIntent.client_secret ?
            paymentIntent.client_secret.substring(0, 20) + '...' : 'null',
          metadata: paymentIntent.metadata,
          created: new Date(paymentIntent.created * 1000),
        },
        message: 'Payment intent details retrieved'
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve payment intent: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to retrieve payment intent details'
      };
    }
  }

  @Post('paymob/create-payment-key')
  @UseGuards(JwtAuthGuard, VerifiedUserGuard)
  @HttpCode(HttpStatus.CREATED)
  async createPaymobPaymentKey(
    @User() user: JwtUser,
    @Body() createPaymobPaymentDto: CreatePaymobPaymentDto,
  ): Promise<PaymobPaymentResponseDto> {
    this.logger.log(
      `Creating Paymob payment key for user: ${user.id}, booking: ${createPaymobPaymentDto.bookingId}`,
    );

    // Get the booking details
    const booking = await this.paymentService.getBookingById(
      createPaymobPaymentDto.bookingId,
    );

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    // Verify the booking belongs to the user
    if (booking.userId.toString() !== user.id) {
      throw new ForbiddenException(
        'You are not authorized to pay for this booking',
      );
    }

    // Check if booking is already paid
    if (booking.paymentStatus === 'paid') {
      throw new BadRequestException('This booking is already paid');
    }

    // Convert amount to cents (Paymob expects amount in the smallest currency unit)
    const amountCents = Math.round(booking.totalPrice * 100);

    // Create billing data for Paymob
    const billingData = {
      apartment: 'NA',
      email: createPaymobPaymentDto.email || user.email,
      floor: 'NA',
      first_name: user.firstName || 'User',
      street: 'NA',
      building: 'NA',
      phone_number: createPaymobPaymentDto.mobileNumber || '+201234567890', // Default number if not provided
      shipping_method: 'NA',
      postal_code: 'NA',
      city: 'NA',
      country: 'EG',
      last_name: user.lastName || 'NA',
      state: 'NA',
    };

    // Create SDK payment data using the new method
    const sdkPaymentData = await this.paymobService.createSDKPaymentData(
      createPaymobPaymentDto.bookingId,
      amountCents,
      billingData,
      'EGP', // Force EGP for Paymob
    );

    // Create a payment record with PENDING status
    const paymentData: CreatePaymentDto = {
      userId: user.id,
      bookingId: createPaymobPaymentDto.bookingId,
      amount: booking.totalPrice,
      currency: 'EGP',
      provider: PaymentProvider.PAYMOB,
      method: PaymentMethod.CREDIT_CARD,
      paymentKey: sdkPaymentData.paymentKey,
      metadata: {
        paymobOrderId: sdkPaymentData.orderId,
        integrationId: sdkPaymentData.integrationId,
        expiresAt: sdkPaymentData.expiresAt,
      },
      isTest: process.env.NODE_ENV !== 'production',
    };
    const payment = await this.paymentTransactionService.createPayment(
      paymentData,
    );
    this.logger.log(
      `Created initial payment record ${payment._id.toString()} with pending status for booking ${
        createPaymobPaymentDto.bookingId
      }`,
    );

    // Return SDK-compatible data for Flutter integration
    return {
      success: true,
      paymentKey: sdkPaymentData.paymentKey,
      integrationId: sdkPaymentData.integrationId,
      orderId: sdkPaymentData.orderId,
      amountCents: sdkPaymentData.amountCents,
      currency: sdkPaymentData.currency,
      expiresAt: sdkPaymentData.expiresAt,
      merchantOrderId: sdkPaymentData.merchantOrderId,
    };
  }

  /**
   * Verify payment status for SDK integration
   * This endpoint allows the Flutter app to check payment status after SDK completion
   */
  @Post('paymob/verify-payment')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Verify Paymob payment status for SDK integration' })
  @ApiResponse({
    status: 200,
    description: 'Payment verification result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        paymentStatus: { type: 'string' },
        transactionId: { type: 'string' },
        amount: { type: 'number' },
        currency: { type: 'string' },
        paidAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async verifyPaymobPayment(
    @Body() verifyPaymentDto: { bookingId: string; transactionId?: string },
    @Req() req,
  ) {
    const user = req.user;
    this.logger.log(
      `Verifying Paymob payment for booking ${verifyPaymentDto.bookingId} by user ${user.id}`,
    );

    try {
      // Find the payment record
      const payment = await this.paymentTransactionService.findPaymentByBookingId(
        verifyPaymentDto.bookingId,
      );

      if (!payment) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }

      // Verify user owns this payment
      if (payment.userId.toString() !== user.id) {
        throw new HttpException('Unauthorized access to payment', HttpStatus.FORBIDDEN);
      }

      return {
        success: true,
        paymentStatus: payment.status,
        transactionId: payment.transactionId,
        amount: payment.amount,
        currency: payment.currency,
        paidAt: payment.paidAt,
        metadata: payment.metadata,
      };
    } catch (error) {
      this.logger.error(
        `Failed to verify payment for booking ${verifyPaymentDto.bookingId}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }

  /**
   * Get payment status by booking ID for SDK integration
   */
  @Get('paymob/status/:bookingId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get payment status by booking ID for SDK integration' })
  @ApiParam({ name: 'bookingId', description: 'Booking ID to check payment status for' })
  @ApiResponse({
    status: 200,
    description: 'Payment status information',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        paymentStatus: { type: 'string' },
        paymentKey: { type: 'string' },
        integrationId: { type: 'string' },
        orderId: { type: 'number' },
        amount: { type: 'number' },
        currency: { type: 'string' },
        expiresAt: { type: 'string', format: 'date-time' },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async getPaymobPaymentStatus(
    @Param('bookingId') bookingId: string,
    @Req() req,
  ) {
    const user = req.user;
    this.logger.log(
      `Getting payment status for booking ${bookingId} by user ${user.id}`,
    );

    try {
      // Find the payment record
      const payment = await this.paymentTransactionService.findPaymentByBookingId(bookingId);

      if (!payment) {
        throw new HttpException('Payment not found', HttpStatus.NOT_FOUND);
      }

      // Verify user owns this payment
      if (payment.userId.toString() !== user.id) {
        throw new HttpException('Unauthorized access to payment', HttpStatus.FORBIDDEN);
      }

      return {
        success: true,
        paymentStatus: payment.status,
        paymentKey: payment.paymentKey,
        integrationId: payment.metadata?.integrationId,
        orderId: payment.metadata?.paymobOrderId,
        amount: payment.amount,
        currency: payment.currency,
        expiresAt: payment.metadata?.expiresAt,
        createdAt: payment.createdAt,
        transactionId: payment.transactionId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get payment status for booking ${bookingId}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }

  /**
   * Debug endpoint to manually check and sync payment status with Stripe
   * This endpoint helps debug webhook issues by manually checking payment status
   */
  @Post('debug/sync-payment-status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Debug: Manually sync payment status with Stripe' })
  @ApiResponse({
    status: 200,
    description: 'Payment status sync result',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        bookingId: { type: 'string' },
        paymentIntentId: { type: 'string' },
        stripeStatus: { type: 'string' },
        bookingStatus: { type: 'string' },
        paymentStatus: { type: 'string' },
        syncPerformed: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  async debugSyncPaymentStatus(
    @Body() body: { bookingId: string },
    @Req() req,
  ) {
    const user = req.user;
    this.logger.log(
      `Debug: Syncing payment status for booking ${body.bookingId} by user ${user.id}`,
    );

    try {
      // Find the booking
      const booking = await this.paymentService.getBookingById(body.bookingId);

      if (!booking) {
        throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
      }

      // Verify user owns this booking
      if (booking.userId.toString() !== user.id) {
        throw new HttpException('Unauthorized access to booking', HttpStatus.FORBIDDEN);
      }

      this.logger.log(`Found booking:`, {
        id: booking._id.toString(),
        ref: booking.bookingRef,
        status: booking.status,
        paymentStatus: booking.paymentStatus,
        paymentIntentId: booking.paymentIntentId
      });

      if (!booking.paymentIntentId) {
        return {
          success: false,
          bookingId: body.bookingId,
          message: 'No payment intent ID found for this booking',
          syncPerformed: false
        };
      }

      // Get payment intent details from Stripe
      const paymentIntentDetails = await this.paymentService.getPaymentIntentDetails(booking.paymentIntentId);

      this.logger.log(`Stripe payment intent details:`, {
        id: paymentIntentDetails.id,
        status: paymentIntentDetails.status,
        amount: paymentIntentDetails.amount,
        currency: paymentIntentDetails.currency,
        metadata: paymentIntentDetails.metadata
      });

      let syncPerformed = false;
      let message = 'Payment status is already in sync';

      // Check if we need to sync the status
      if (paymentIntentDetails.status === 'succeeded' && booking.paymentStatus !== 'completed') {
        this.logger.log(`Payment succeeded on Stripe but booking not updated. Syncing...`);

        // Manually trigger the payment success handler
        await this.paymentService.confirmPayment({
          paymentIntentId: booking.paymentIntentId,
          userEmail: user.email
        });

        syncPerformed = true;
        message = 'Payment status synced successfully';
      }

      return {
        success: true,
        bookingId: body.bookingId,
        paymentIntentId: booking.paymentIntentId,
        stripeStatus: paymentIntentDetails.status,
        bookingStatus: booking.status,
        paymentStatus: booking.paymentStatus,
        syncPerformed,
        message
      };

    } catch (error) {
      this.logger.error(
        `Failed to sync payment status for booking ${body.bookingId}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }

  /**
   * Debug endpoint to get detailed payment and booking information
   */
  @Get('debug/payment-details/:bookingId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Debug: Get detailed payment and booking information' })
  @ApiParam({ name: 'bookingId', description: 'Booking ID to get details for' })
  async debugGetPaymentDetails(
    @Param('bookingId') bookingId: string,
    @Req() req,
  ) {
    const user = req.user;
    this.logger.log(
      `Debug: Getting payment details for booking ${bookingId} by user ${user.id}`,
    );

    try {
      // Find the booking
      const booking = await this.paymentService.getBookingById(bookingId);

      if (!booking) {
        throw new HttpException('Booking not found', HttpStatus.NOT_FOUND);
      }

      // Verify user owns this booking
      if (booking.userId.toString() !== user.id) {
        throw new HttpException('Unauthorized access to booking', HttpStatus.FORBIDDEN);
      }

      let stripeDetails = null;
      if (booking.paymentIntentId) {
        try {
          stripeDetails = await this.paymentService.getPaymentIntentDetails(booking.paymentIntentId);
        } catch (error) {
          this.logger.warn(`Could not fetch Stripe details: ${error.message}`);
        }
      }

      // Find payment records
      const paymentRecords = await this.paymentTransactionService.findPaymentsByBookingId(bookingId);

      return {
        success: true,
        booking: {
          id: booking._id.toString(),
          ref: booking.bookingRef,
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          paymentIntentId: booking.paymentIntentId,
          paymentCompletedAt: booking.paymentCompletedAt,
          totalPrice: booking.totalPrice,
          currency: booking.currency,
          createdAt: booking.createdAt,
          updatedAt: booking.updatedAt
        },
        stripeDetails: stripeDetails ? {
          id: stripeDetails.id,
          status: stripeDetails.status,
          amount: stripeDetails.amount,
          currency: stripeDetails.currency,
          created: new Date(stripeDetails.created * 1000),
          metadata: stripeDetails.metadata
        } : null,
        paymentRecords: paymentRecords || []
      };

    } catch (error) {
      this.logger.error(
        `Failed to get payment details for booking ${bookingId}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }

  /**
   * Force process a webhook for debugging
   * This endpoint bypasses signature verification for testing
   */
  @Post('debug/force-process-webhook')
  @HttpCode(HttpStatus.OK)
  async forceProcessWebhook(@Body() webhookData: any) {
    this.logger.log('=== FORCE PROCESSING WEBHOOK FOR DEBUG ===');
    this.logger.log(`Event type: ${webhookData.type}`);
    this.logger.log(`Event ID: ${webhookData.id}`);

    try {
      if (webhookData.type === 'payment_intent.succeeded') {
        const paymentIntent = webhookData.data.object;
        this.logger.log(`Processing payment intent: ${paymentIntent.id}`);
        this.logger.log(`Booking ID from metadata: ${paymentIntent.metadata?.bookingId}`);

        // Call the service method directly
        await this.paymentService['handlePaymentIntentSucceeded'](paymentIntent);

        return {
          success: true,
          message: 'Webhook processed successfully',
          eventType: webhookData.type,
          paymentIntentId: paymentIntent.id,
          bookingId: paymentIntent.metadata?.bookingId
        };
      } else {
        return {
          success: false,
          message: `Event type ${webhookData.type} not supported in debug mode`
        };
      }
    } catch (error) {
      this.logger.error(`Error force processing webhook: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Test webhook signature verification
   * This endpoint helps test if webhook signature verification is working
   */
  @Post('debug/test-webhook-signature')
  @HttpCode(HttpStatus.OK)
  async testWebhookSignature(
    @Req() request: any,
    @Headers('stripe-signature') signature: string,
  ) {
    this.logger.log('=== TESTING WEBHOOK SIGNATURE VERIFICATION ===');

    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');

    this.logger.log('Test webhook details:', {
      signatureProvided: !!signature,
      signatureLength: signature ? signature.length : 0,
      webhookSecretConfigured: !!webhookSecret,
      webhookSecretLength: webhookSecret ? webhookSecret.length : 0,
      rawBodyExists: !!request.rawBody,
      rawBodyLength: request.rawBody ? request.rawBody.length : 0,
      rawBodyType: request.rawBody ? typeof request.rawBody : 'undefined',
      contentType: request.headers['content-type'],
    });

    if (!webhookSecret) {
      return {
        success: false,
        error: 'STRIPE_WEBHOOK_SECRET not configured',
        details: 'Check your environment variables'
      };
    }

    if (!signature) {
      return {
        success: false,
        error: 'No stripe-signature header provided',
        details: 'Add stripe-signature header to your request'
      };
    }

    if (!request.rawBody) {
      return {
        success: false,
        error: 'No raw body available',
        details: 'Raw body is required for webhook signature verification'
      };
    }

    try {
      // Try to construct a Stripe event (this will test signature verification)
      const stripe = require('stripe')(this.configService.get<string>('STRIPE_SECRET_KEY'));
      const event = stripe.webhooks.constructEvent(request.rawBody, signature, webhookSecret);

      return {
        success: true,
        message: 'Webhook signature verification successful',
        eventType: event.type,
        eventId: event.id
      };
    } catch (error) {
      return {
        success: false,
        error: 'Webhook signature verification failed',
        details: error.message,
        troubleshooting: {
          checkWebhookSecret: 'Verify STRIPE_WEBHOOK_SECRET matches Stripe dashboard',
          checkSignature: 'Ensure stripe-signature header is correctly set',
          checkRawBody: 'Ensure raw body is preserved and not parsed as JSON'
        }
      };
    }
  }

  /**
   * Get payment count for debugging
   */
  @Get('debug/payment-count')
  @HttpCode(HttpStatus.OK)
  async getPaymentCount() {
    this.logger.log('=== CHECKING PAYMENT COUNT ===');

    try {
      const count = await this.paymentService.getPaymentCount();
      this.logger.log(`Total payments in database: ${count}`);

      return {
        success: true,
        message: 'Payment count retrieved',
        data: {
          totalPayments: count
        }
      };
    } catch (error) {
      this.logger.error(`Error getting payment count: ${error.message}`);
      return {
        success: false,
        message: 'Failed to get payment count',
        error: error.message
      };
    }
  }

  /**
   * Get recent payments for debugging
   */
  @Get('debug/recent-payments')
  @HttpCode(HttpStatus.OK)
  async getRecentPayments(@Query('limit') limit?: string) {
    this.logger.log('=== CHECKING RECENT PAYMENTS ===');

    try {
      const paymentLimit = limit ? parseInt(limit, 10) : 10;
      const payments = await this.paymentTransactionService.getRecentPayments(paymentLimit);

      this.logger.log(`Found ${payments.length} recent payments`);

      return {
        success: true,
        message: 'Recent payments retrieved',
        data: {
          payments: payments.map(payment => ({
            id: payment._id.toString(),
            bookingId: payment.bookingId,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            provider: payment.provider,
            method: payment.method,
            transactionId: payment.transactionId,
            createdAt: payment.createdAt,
            isTest: payment.isTest
          })),
          count: payments.length
        }
      };
    } catch (error) {
      this.logger.error(`Error getting recent payments: ${error.message}`);
      return {
        success: false,
        message: 'Failed to get recent payments',
        error: error.message
      };
    }
  }

  /**
   * Check payment record for specific booking
   */
  @Get('debug/booking/:bookingId/payment')
  @HttpCode(HttpStatus.OK)
  async getPaymentByBooking(@Param('bookingId') bookingId: string) {
    this.logger.log(`=== CHECKING PAYMENT FOR BOOKING: ${bookingId} ===`);

    try {
      const payment = await this.paymentTransactionService.findByBookingId(bookingId);

      if (payment) {
        this.logger.log(`Found payment record for booking ${bookingId}`);
        return {
          success: true,
          message: 'Payment record found',
          data: {
            payment: {
              id: payment._id.toString(),
              bookingId: payment.bookingId,
              amount: payment.amount,
              currency: payment.currency,
              status: payment.status,
              provider: payment.provider,
              method: payment.method,
              transactionId: payment.transactionId,
              createdAt: payment.createdAt,
              paidAt: payment.paidAt,
              isTest: payment.isTest
            }
          }
        };
      } else {
        this.logger.warn(`No payment record found for booking ${bookingId}`);
        return {
          success: false,
          message: 'No payment record found for this booking',
          data: {
            bookingId: bookingId,
            paymentExists: false
          }
        };
      }
    } catch (error) {
      this.logger.error(`Error checking payment for booking ${bookingId}: ${error.message}`);
      return {
        success: false,
        message: 'Failed to check payment record',
        error: error.message
      };
    }
  }
}
