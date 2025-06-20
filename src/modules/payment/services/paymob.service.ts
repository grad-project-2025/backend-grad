import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import { createHmac } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Booking, BookingDocument } from '../../booking/schemas/booking.schema';
import { EmailService } from '../../email/email.service';
import { BookingEmailData } from '../../email/services/email-template.service';
import { PaymentTransactionService } from './payment-transaction.service';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { CreatePaymentDto } from '../dto/create-payment.dto';

// Types for Paymob API responses
interface PaymobAuthResponse {
  token: string;
  profile?: any;
}

interface PaymobOrderResponse {
  id: number;
  createdAt: string;
  [key: string]: any;
}

interface PaymentKeyResponse {
  token: string;
  [key: string]: any;
}

type PaymobWebhookData = {
  obj: {
    id: number;
    pending: boolean;
    amount_cents: number;
    success: boolean;
    is_auth: boolean;
    is_capture: boolean;
    is_standalone_payment: boolean;
    is_voided: boolean;
    is_refunded: boolean;
    is_3d_secure: boolean;
    integration_id: number;
    profile_id: number;
    has_parent_transaction: boolean;
    order: {
      id: number;
      [key: string]: any;
    };
    created_at: string;
    [key: string]: any;
  };
  [key: string]: any;
};

@Injectable()
export class PaymobService {
  private readonly paymobApiKey: string;
  private readonly paymobMerchantId: string;
  private readonly paymobHmacSecret: string;
  private readonly paymobCardIntegrationId: string;

  private readonly logger = new Logger(PaymobService.name);

  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second
  private readonly requestTimeout = 15000; // 15 seconds

  constructor(
    private readonly configService: ConfigService,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    private readonly emailService: EmailService,
    private readonly paymentTransactionService: PaymentTransactionService,
  ) {
    this.paymobApiKey = this.configService.get<string>('PAYMOB_API_KEY');
    this.paymobMerchantId =
      this.configService.get<string>('PAYMOB_MERCHANT_ID');
    this.paymobHmacSecret =
      this.configService.get<string>('PAYMOB_HMAC_SECRET');
    this.paymobCardIntegrationId = this.configService.get<string>(
      'PAYMOB_CARD_INTEGRATION_ID',
    );

    // Log initialization (without sensitive data)
    this.logger.log('PaymobService initialized');

    // Validate required configuration
    const requiredConfigs = {
      PAYMOB_API_KEY: this.paymobApiKey,
      PAYMOB_MERCHANT_ID: this.paymobMerchantId,
      PAYMOB_CARD_INTEGRATION_ID: this.paymobCardIntegrationId,
    };

    for (const [key, value] of Object.entries(requiredConfigs)) {
      if (!value) {
        const error = new Error(`${key} is required for PaymobService`);
        this.logger.error(error.message);
        throw error;
      }
    }
  }



  /**
   * Get transaction details from Paymob
   */
  async getTransaction(
    transactionId: string | number,
    token: string,
  ): Promise<any> {
    const url = `https://accept.paymob.com/api/acceptance/transactions/${transactionId}`;
    this.logger.debug(`Fetching transaction ${transactionId} from Paymob`);

    try {
      const response = await this.makeRequest({
        method: 'GET',
        url,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch transaction ${transactionId}`, error);
      throw new HttpException(
        `Failed to fetch transaction: ${error.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Get order details from Paymob
   */
  async getOrder(orderId: string | number, token: string): Promise<any> {
    const url = `https://accept.paymob.com/api/ecommerce/orders/${orderId}`;
    this.logger.debug(`Fetching order ${orderId} from Paymob`);

    try {
      const response = await this.makeRequest({
        method: 'GET',
        url,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      this.logger.debug(
        `Paymob getOrder response for order ${orderId}:`,
        JSON.stringify(response.data, null, 2),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to fetch order ${orderId}`, error);
      throw new HttpException(
        `Failed to fetch order: ${error.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Process Paymob webhook
   */
  async processWebhook(
    payload: PaymobWebhookData,
    hmac?: string,
  ): Promise<{
    success: boolean;
    transactionId: number;
    orderId: number;
    amount: number;
    isSuccess: boolean;
    isPending: boolean;
    isError: boolean;
    data: any;
  }> {
    const transaction = payload.obj;
    const transactionId = transaction.id;
    const orderId = transaction.order?.id;
    const amount = transaction.amount_cents / 100; // Convert to major currency

    // Verify HMAC if secret is configured
    if (hmac && this.paymobHmacSecret) {
      const isValidSignature = this.verifyWebhookSignature(payload, hmac);
      if (!isValidSignature) {
        this.logger.error(
          `Invalid webhook signature for transaction ${transactionId}`,
        );
        throw new HttpException(
          'Invalid webhook signature',
          HttpStatus.UNAUTHORIZED,
        );
      }
    }

    // Basic validation
    if (!transactionId || !orderId) {
      throw new HttpException(
        'Invalid webhook payload',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Determine transaction status
    const isSuccess = transaction.success === true;
    const isPending = transaction.pending === true;
    const isError = !isSuccess && !isPending;

    this.logger.log(`Processing webhook for transaction ${transactionId}`, {
      orderId,
      amount,
      isSuccess,
      isPending,
      isError,
      status: transaction.status,
    });

    return {
      success: isSuccess,
      transactionId,
      orderId,
      amount,
      isSuccess,
      isPending,
      isError,
      data: payload.obj,
    };
  }

  /**
   * Get the card integration ID for Paymob
   */
  getCardIntegrationId(): string {
    return this.paymobCardIntegrationId;
  }

  /**
   * Create payment data for Flutter SDK integration
   * This method combines authentication, order registration, and payment key generation
   * to provide all necessary data for the Flutter SDK
   */
  async createSDKPaymentData(
    merchantOrderId: string,
    amountCents: number,
    billingData: Record<string, any>,
    currency: string = 'EGP',
  ): Promise<{
    paymentKey: string;
    integrationId: string;
    orderId: number;
    amountCents: number;
    currency: string;
    expiresAt: Date;
    merchantOrderId: string;
  }> {
    try {
      // Step 1: Authenticate with Paymob
      const authToken = await this.authenticate();

      // Step 2: Register order with Paymob
      const { orderId } = await this.registerOrder(
        authToken,
        merchantOrderId,
        amountCents,
        currency,
      );

      // Step 3: Get payment key from Paymob
      const { paymentKey, expiresAt } = await this.requestPaymentKey(
        authToken,
        amountCents,
        orderId,
        billingData,
        currency,
      );

      return {
        paymentKey,
        integrationId: this.paymobCardIntegrationId,
        orderId,
        amountCents,
        currency,
        expiresAt,
        merchantOrderId,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create SDK payment data for order ${merchantOrderId}:`,
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw error;
    }
  }

  /**
   * Refund a transaction
   */
  async refundTransaction(
    transactionId: string | number,
    amountCents: number,
    token: string,
  ): Promise<{ success: boolean; refundId?: string; error?: string }> {
    const url = 'https://accept.paymob.com/api/acceptance/void_refund/refund';

    try {
      const response = await this.makeRequest({
        method: 'POST',
        url,
        data: {
          auth_token: token,
          transaction_id: transactionId.toString(),
          amount_cents: amountCents.toString(),
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.pending === true || response.data.success === true) {
        return {
          success: true,
          refundId: response.data.id?.toString(),
        };
      }

      return {
        success: false,
        error: response.data.detail || 'Refund request was not successful',
      };
    } catch (error) {
      this.logger.error(`Failed to refund transaction ${transactionId}`, error);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Verify Paymob webhook signature
   */
  verifyWebhookSignature(
    payload: PaymobWebhookData,
    receivedHmac: string,
  ): boolean {
    if (!this.paymobHmacSecret) {
      this.logger.warn(
        'PAYMOB_HMAC_SECRET is not configured, webhook verification is disabled',
      );
      return true; // Skip verification if no HMAC secret is configured
    }

    try {
      const { obj: transaction } = payload;

      // The data to be hashed is the concatenation of specific values from the transaction object
      // in a predefined order as per Paymob documentation.
      const concatenatedString = [
        transaction.amount_cents,
        transaction.created_at,
        transaction.currency,
        transaction.error_occured,
        transaction.has_parent_transaction,
        transaction.id,
        transaction.integration_id,
        transaction.is_3d_secure,
        transaction.is_auth,
        transaction.is_capture,
        transaction.is_refunded,
        transaction.is_standalone_payment,
        transaction.is_voided,
        transaction.order.id,
        transaction.owner,
        transaction.pending,
        transaction.success,
      ].join('');

      // Create HMAC signature
      const hash = createHmac('sha512', this.paymobHmacSecret)
        .update(concatenatedString)
        .digest('hex');

      // Compare the signatures
      const isValid = hash === receivedHmac;

      if (!isValid) {
        this.logger.warn('Webhook signature verification failed', {
          expected: hash,
          received: receivedHmac,
          payload: JSON.stringify(payload, null, 2),
        });
      }

      return isValid;
    } catch (error) {
      this.logger.error('Error verifying webhook signature', error);
      return false;
    }
  }

  /**
   * Step 1: Authenticate with Paymob and get an auth token
   */
  /**
   * Execute an HTTP request with retry logic
   */
  private async makeRequest<T = any>(
    config: AxiosRequestConfig,
    retries = 0,
  ): Promise<AxiosResponse<T>> {
    const requestId = uuidv4().substring(0, 8);
    const method = config.method?.toUpperCase() || 'GET';
    const url = config.url || '';

    this.logger.debug(
      `[${requestId}] ${method} ${url} (attempt ${retries + 1}/${this.maxRetries + 1})`,
    );

    try {
      const response = await axios({
        ...config,
        timeout: this.requestTimeout,
        headers: {
          'Content-Type': 'application/json',
          ...(config.headers || {}),
        },
        validateStatus: () => true, // Always resolve the promise
      });

      // Log non-2xx responses
      if (response.status < 200 || response.status >= 300) {
        this.logger.warn(
          `[${requestId}] ${method} ${url} failed with status ${response.status}: ${JSON.stringify(response.data)}`,
        );
      }

      return response;
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status || 'unknown';
      const data = axiosError.response?.data || {};

      this.logger.error(
        `[${requestId}] ${method} ${url} error: ${axiosError.message} (status: ${status})`,
        axiosError.stack,
      );

      // Retry on network errors or 5xx responses
      if (
        retries < this.maxRetries &&
        (!axiosError.response ||
          (axiosError.response.status >= 500 &&
            axiosError.response.status < 600))
      ) {
        const delay = this.retryDelay * Math.pow(2, retries);
        this.logger.debug(`[${requestId}] Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.makeRequest<T>(config, retries + 1);
      }

      throw new HttpException(
        `Request failed: ${axiosError.message}`,
        axiosError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        { cause: error },
      );
    }
  }

  /**
   * Authenticate with Paymob and get an auth token
   */
  async authenticate(): Promise<string> {
    try {
      const apiKey = this.configService.get<string>('PAYMOB_API_KEY');
      if (!apiKey) {
        throw new Error('PAYMOB_API_KEY is not configured');
      }

      const response = await axios.post<PaymobAuthResponse>(
        'https://accept.paymob.com/api/auth/tokens',
        { api_key: apiKey },
      );

      if (!response.data.token) {
        throw new Error('Invalid response from Paymob authentication');
      }

      return response.data.token;
    } catch (error) {
      this.logger.error(
        'Failed to authenticate with Paymob:',
        error instanceof Error ? error.message : 'Unknown error',
      );
      throw new Error('Failed to authenticate with payment provider');
    }
  }

  /**
   * Step 2: Register an order with Paymob
   */
  /**
   * Register an order with Paymob
   */
  async registerOrder(
    token: string,
    merchantOrderId: string,
    amountCents: number,
    currency: string = 'EGP',
    items: Array<{
      name: string;
      amount_cents: number;
      description?: string;
      quantity?: number;
    }> = [],
  ): Promise<{ orderId: number; orderData: PaymobOrderResponse }> {
    const url = 'https://accept.paymob.com/api/ecommerce/orders';
    this.logger.debug(
      `Registering order with Paymob for merchantOrderId: ${merchantOrderId}`,
    );
    try {
      const response = await this.makeRequest<PaymobOrderResponse>({
        method: 'POST',
        url,
        data: {
          auth_token: token,
          delivery_needed: false,
          amount_cents: amountCents,
          currency,
          merchant_order_id: merchantOrderId,
          items: items.length > 0 ? items : undefined,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      let data = response.data;
      this.logger.error('Paymob order registration RAW response:', data); // <--- Add this line
      // Defensive: If response.data is a string, try to parse as JSON
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (err) {
          this.logger.error(
            'Paymob order registration: response is not valid JSON string',
            data,
          );
          throw new HttpException(
            'Paymob order registration failed: Invalid response format',
            HttpStatus.BAD_GATEWAY,
          );
        }
      }
      if (!data?.id) {
        this.logger.error(
          'Paymob order registration: missing id in response',
          data,
        );
        throw new HttpException(
          'Paymob order registration failed: Invalid response format',
          HttpStatus.BAD_GATEWAY,
        );
      }
      this.logger.debug(
        `Successfully registered order with Paymob, orderId: ${data.id}`,
      );

      // Store Paymob order ID in booking when registering order
      await this.bookingModel.findByIdAndUpdate(
        merchantOrderId,
        { $set: { 'payment.paymobOrderId': data.id } },
        { new: true },
      );

      return { orderId: data.id, orderData: data };
    } catch (error) {
      this.logger.error('Paymob order registration error', error);
      throw new HttpException(
        'Failed to register order with Paymob: ' +
          (error.response?.data?.message || error.message),
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Step 3: Request a payment key
   */
  /**
   * Request a payment key from Paymob
   */
  async requestPaymentKey(
    token: string,
    amountCents: number,
    orderId: number,
    billingData: Record<string, any>,
    currency: string = 'EGP',
    lockOrderWhenPaid: boolean = true,
  ): Promise<{ paymentKey: string; expiresAt: Date }> {
    const url = 'https://accept.paymob.com/api/acceptance/payment_keys';
    this.logger.debug(
      `Requesting payment key from Paymob for orderId: ${orderId}`,
    );

    try {
      const expiration = 3600; // 1 hour
      const expiresAt = new Date(Date.now() + expiration * 1000);

      const response = await this.makeRequest<PaymentKeyResponse>({
        method: 'POST',
        url,
        data: {
          auth_token: token,
          amount_cents: amountCents,
          expiration,
          order_id: orderId,
          billing_data: billingData,
          currency,
          integration_id: Number(this.paymobCardIntegrationId),
          lock_order_when_paid: lockOrderWhenPaid,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const { data } = response;

      if (!data?.token) {
        throw new HttpException(
          'Paymob payment key request failed: Invalid response format',
          HttpStatus.BAD_GATEWAY,
        );
      }

      this.logger.debug('Successfully retrieved payment key from Paymob');
      return {
        paymentKey: data.token,
        expiresAt,
        ...(data.id && { paymentKeyId: data.id }), // Include additional data if available
      };
    } catch (error) {
      this.logger.error('Paymob payment key request error', error);
      throw new HttpException(
        'Failed to get payment key from Paymob: ' +
          (error.response?.data?.message || error.message),
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * Handle Paymob webhook notification
   * @param hmacSignature The HMAC signature from the webhook request headers
   * @param rawBody The raw request body buffer from the webhook
   */
  async handleWebhook(hmacSignature: string, rawBody: Buffer): Promise<void> {
    try {
      // Parse the raw body
      const payload = JSON.parse(rawBody.toString());
      this.logger.debug('Processing Paymob webhook', {
        transactionId: payload?.obj?.id,
      });

      // Log the full webhook payload for debugging
      this.logger.warn('Paymob webhook payload', {
        payload: JSON.stringify(payload, null, 2),
      });

      // Extract merchant order ID (booking ID) from the transaction
      let merchantOrderId = payload?.obj?.order?.merchant_order_id;
      if (!merchantOrderId) {
        // Fallback: Try to find booking by Paymob order ID
        const paymobOrderId = payload?.obj?.order?.id;
        if (paymobOrderId) {
          const booking = await this.bookingModel.findOne({
            'payment.paymobOrderId': paymobOrderId,
          });
          if (booking) {
            merchantOrderId = booking._id.toString();
            this.logger.warn(
              `Fallback: Matched booking by Paymob order id: ${paymobOrderId} → bookingId: ${merchantOrderId}`,
            );
          }
        }
      }
      if (!merchantOrderId) {
        throw new HttpException(
          'Missing merchant_order_id in webhook payload and no fallback found',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Find the booking
      const booking = await this.bookingModel.findById(merchantOrderId);
      if (!booking) {
        throw new HttpException(
          `Booking not found: ${merchantOrderId}`,
          HttpStatus.NOT_FOUND,
        );
      }

      // Process the webhook data
      const result = await this.processWebhook(payload, hmacSignature);

      // Update booking status based on payment result
      if (result.isSuccess) {
        // Payment successful
        await this.bookingModel.findByIdAndUpdate(
          merchantOrderId,
          {
            paymentStatus: 'completed',
            status: 'confirmed',
            'payment.transactionId': result.transactionId.toString(),
            'payment.amount': result.amount,
            'payment.currency': 'EGP',
            'payment.paidAt': new Date(),
            updatedAt: new Date(),
          },
          { new: true },
        );

        // Create or update payment record
        const existingPayment =
          await this.paymentTransactionService.findByBookingId(merchantOrderId);

        if (existingPayment) {
          // Update existing payment record
          await this.paymentTransactionService.updatePaymentStatus(
            existingPayment._id.toString(),
            {
              status: PaymentStatus.COMPLETED,
              transactionId: result.transactionId.toString(),
              providerResponse: result.data,
            },
          );
          this.logger.log(
            `Updated existing payment record ${existingPayment._id.toString()} for booking ${merchantOrderId}`,
          );
        } else {
          // Create new payment record
          const paymentData: CreatePaymentDto = {
            userId: booking.userId.toString(),
            bookingId: booking._id.toString(),
            amount: result.amount,
            currency: 'EGP',
            provider: PaymentProvider.PAYMOB,
            method: PaymentMethod.CREDIT_CARD, // Default to credit card, can be refined based on actual data
            transactionId: result.transactionId.toString(),
            metadata: {
              paymobOrderId: result.orderId,
              transactionDetails: result.data,
            },
            isTest: process.env.NODE_ENV !== 'production',
          };

          const payment =
            await this.paymentTransactionService.createPayment(paymentData);
          this.logger.log(
            `Created new payment record ${payment._id} for booking ${merchantOrderId}`,
          );
        }

        // Send confirmation email
        const emailData = this.convertBookingToEmailData(booking);
        await this.emailService.sendBookingConfirmationEmail(emailData);

        this.logger.log(`Payment successful for booking ${merchantOrderId}`);
      } else if (result.isPending) {
        // Payment pending
        await this.bookingModel.findByIdAndUpdate(merchantOrderId, {
          paymentStatus: 'pending',
          'payment.transactionId': result.transactionId.toString(),
          updatedAt: new Date(),
        });

        // Create or update payment record for pending payment
        const existingPayment =
          await this.paymentTransactionService.findByBookingId(merchantOrderId);

        if (existingPayment) {
          // Update existing payment record
          await this.paymentTransactionService.updatePaymentStatus(
            existingPayment._id.toString(),
            {
              status: PaymentStatus.PROCESSING, // Use PROCESSING for pending payments
              transactionId: result.transactionId.toString(),
              providerResponse: result.data,
            },
          );
          this.logger.log(
            `Updated existing payment record ${existingPayment._id.toString()} to pending for booking ${merchantOrderId}`,
          );
        } else {
          // Create new payment record
          const paymentData: CreatePaymentDto = {
            userId: booking.userId.toString(),
            bookingId: booking._id.toString(),
            amount: result.amount,
            currency: 'EGP',
            provider: PaymentProvider.PAYMOB,
            method: PaymentMethod.CREDIT_CARD, // Default to credit card, can be refined based on actual data
            transactionId: result.transactionId.toString(),
            metadata: {
              paymobOrderId: result.orderId,
              transactionDetails: result.data,
            },
            isTest: process.env.NODE_ENV !== 'production',
          };

          const payment =
            await this.paymentTransactionService.createPayment(paymentData);
          this.logger.log(
            `Created new payment record ${payment._id} with pending status for booking ${merchantOrderId}`,
          );
        }

        this.logger.log(`Payment pending for booking ${merchantOrderId}`);
      } else if (result.isError) {
        // Payment failed
        await this.bookingModel.findByIdAndUpdate(merchantOrderId, {
          paymentStatus: 'failed',
          'payment.transactionId': result.transactionId.toString(),
          'payment.lastError': JSON.stringify(result.data),
          updatedAt: new Date(),
        });

        // Create or update payment record for failed payment
        const existingPayment =
          await this.paymentTransactionService.findByBookingId(merchantOrderId);

        if (existingPayment) {
          // Update existing payment record
          await this.paymentTransactionService.updatePaymentStatus(
            existingPayment._id.toString(),
            {
              status: PaymentStatus.FAILED,
              transactionId: result.transactionId.toString(),
              providerResponse: result.data,
              failureMessage: JSON.stringify(result.data),
            },
          );
          this.logger.log(
            `Updated existing payment record ${existingPayment._id.toString()} to failed for booking ${merchantOrderId}`,
          );
        } else {
          // Create new payment record
          const paymentData: CreatePaymentDto = {
            userId: booking.userId.toString(),
            bookingId: booking._id.toString(),
            amount: result.amount,
            currency: 'EGP',
            provider: PaymentProvider.PAYMOB,
            method: PaymentMethod.CREDIT_CARD, // Default to credit card, can be refined based on actual data
            transactionId: result.transactionId.toString(),
            metadata: {
              paymobOrderId: result.orderId,
              transactionDetails: result.data,
              error: true,
            },
            isTest: process.env.NODE_ENV !== 'production',
          };

          const payment =
            await this.paymentTransactionService.createPayment(paymentData);
          // Update the status to FAILED since createPayment sets it to PENDING by default
          await this.paymentTransactionService.updatePaymentStatus(
            payment._id.toString(),
            {
              status: PaymentStatus.FAILED,
              failureMessage: JSON.stringify(result.data),
            },
          );
          this.logger.log(
            `Created new payment record ${payment._id} with failed status for booking ${merchantOrderId}`,
          );
        }

        this.logger.warn(`Payment failed for booking ${merchantOrderId}`);
      }
    } catch (error) {
      this.logger.error('Error processing Paymob webhook:', error);
      throw new HttpException(
        `Failed to process payment webhook: ${error.message}`,
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private convertBookingToEmailData(
    booking: BookingDocument,
  ): BookingEmailData {
    const baseData = {
      bookingRef: booking.bookingRef,
      bookingType: booking.bookingType,
      totalPrice: booking.totalPrice,
      currency: booking.currency,
      travellersInfo: booking.travellersInfo,
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
}
