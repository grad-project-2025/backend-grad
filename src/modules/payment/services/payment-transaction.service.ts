import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment, PaymentDocument } from '../schemas/payment.schema';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { UpdatePaymentStatusDto } from '../dto/update-payment-status.dto';

@Injectable()
export class PaymentTransactionService {
  private readonly logger = new Logger(PaymentTransactionService.name);

  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
  ) {}

  /**
   * Create a new payment record
   */
  async createPayment(
    createPaymentDto: CreatePaymentDto,
  ): Promise<PaymentDocument> {
    try {
      const payment = new this.paymentModel({
        ...createPaymentDto,
        status: createPaymentDto.status || PaymentStatus.PENDING,
      });

      const savedPayment = await payment.save();
      this.logger.log(
        `Created payment ${savedPayment._id} for booking ${savedPayment.bookingId}`,
      );
      return savedPayment;
    } catch (error) {
      this.logger.error(`Failed to create payment: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update payment status
   */
  async updatePaymentStatus(
    paymentId: string,
    updateData: UpdatePaymentStatusDto,
  ): Promise<PaymentDocument | null> {
    try {
      const payment = await this.paymentModel.findByIdAndUpdate(
        paymentId,
        {
          $set: {
            ...updateData,
            ...(updateData.status === PaymentStatus.COMPLETED && {
              paidAt: new Date(),
            }),
            ...(updateData.status === PaymentStatus.REFUNDED && {
              refundedAt: new Date(),
            }),
          },
        },
        { new: true },
      );

      if (!payment) {
        this.logger.warn(`Payment ${paymentId} not found for status update`);
        return null;
      }

      this.logger.log(
        `Updated payment ${paymentId} status to ${updateData.status}`,
      );
      return payment;
    } catch (error) {
      this.logger.error(`Failed to update payment status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find payment by ID
   */
  async findById(paymentId: string): Promise<PaymentDocument | null> {
    return this.paymentModel.findById(paymentId).exec();
  }

  /**
   * Find payment by transaction ID
   */
  async findByTransactionId(transactionId: string): Promise<PaymentDocument | null> {
    return this.paymentModel.findOne({ transactionId }).exec();
  }

  /**
   * Find payment by booking ID
   */
  async findByBookingId(bookingId: string): Promise<PaymentDocument | null> {
    return this.paymentModel.findOne({ bookingId }).exec();
  }

  /**
   * Find payment by booking ID (alias for compatibility)
   */
  async findPaymentByBookingId(bookingId: string): Promise<PaymentDocument | null> {
    return this.findByBookingId(bookingId);
  }

  /**
   * Find all payments by booking ID
   */
  async findPaymentsByBookingId(bookingId: string): Promise<PaymentDocument[]> {
    try {
      return await this.paymentModel.find({ bookingId }).exec();
    } catch (error) {
      this.logger.error(`Failed to find payments by booking ID: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all payments for a user
   */
  async findByUserId(
    userId: string,
    options: {
      limit?: number;
      page?: number;
      status?: PaymentStatus;
      provider?: PaymentProvider;
    } = {},
  ): Promise<{ payments: PaymentDocument[]; total: number }> {
    const { limit = 10, page = 1, status, provider } = options;
    const skip = (page - 1) * limit;

    const query: any = { userId };
    if (status) query.status = status;
    if (provider) query.provider = provider;

    const [payments, total] = await Promise.all([
      this.paymentModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.paymentModel.countDocuments(query).exec(),
    ]);

    return { payments, total };
  }

  /**
   * Process refund for a payment
   */
  async processRefund(
    paymentId: string,
    amount: number,
    reason: string,
    metadata: Record<string, any> = {},
  ): Promise<PaymentDocument | null> {
    try {
      const payment = await this.paymentModel.findById(paymentId);

      if (!payment) {
        this.logger.warn(`Payment ${paymentId} not found for refund`);
        return null;
      }

      if (payment.status !== PaymentStatus.COMPLETED) {
        throw new Error(`Cannot refund payment with status: ${payment.status}`);
      }

      if (amount > payment.amount) {
        throw new Error('Refund amount cannot be greater than payment amount');
      }

      // Update payment status to refunded
      const updatedPayment = await this.paymentModel.findByIdAndUpdate(
        paymentId,
        {
          $set: {
            status:
              amount === payment.amount
                ? PaymentStatus.REFUNDED
                : PaymentStatus.PARTIALLY_REFUNDED,
            refundedAt: new Date(),
            refundReason: reason,
            $push: {
              metadata: {
                ...metadata,
                refundAmount: amount,
                refundDate: new Date(),
                refundReason: reason,
              },
            },
          },
        },
        { new: true, runValidators: true },
      );

      this.logger.log(
        `Processed refund for payment ${paymentId}, amount: ${amount}`,
      );
      return updatedPayment;
    } catch (error) {
      this.logger.error(
        `Error processing refund: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get total payment count
   */
  async getPaymentCount(): Promise<number> {
    try {
      return await this.paymentModel.countDocuments().exec();
    } catch (error) {
      this.logger.error(`Failed to get payment count: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get recent payments for debugging
   */
  async getRecentPayments(limit: number = 10): Promise<PaymentDocument[]> {
    try {
      return await this.paymentModel
        .find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .exec();
    } catch (error) {
      this.logger.error(`Failed to get recent payments: ${error.message}`);
      throw error;
    }
  }
}
