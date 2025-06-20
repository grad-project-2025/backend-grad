import { Injectable, Logger } from '@nestjs/common';
import * as QRCode from 'qrcode';
import { BookingType, FlightType } from '../../booking/dto/create-booking.dto';

export interface FlightEmailData {
  flightID: string;
  typeOfFlight: FlightType;
  numberOfStops?: number;
  originAirportCode: string;
  destinationAirportCode: string;
  originCIty: string;
  destinationCIty: string;
  departureDate: Date;
  arrivalDate: Date;
  selectedBaggageOption?: any;
}

export interface BookingEmailData {
  bookingRef: string;
  bookingType?: BookingType;
  // For round-trip bookings
  flightData?: FlightEmailData[];
  // Legacy fields for one-way bookings
  flightId?: string;
  originAirportCode?: string;
  destinationAirportCode?: string;
  originCity?: string;
  destinationCity?: string;
  departureDate?: Date;
  arrivalDate?: Date;
  selectedBaggageOption?: any;
  // Common fields
  totalPrice: number;
  currency: string;
  travellersInfo: Array<{
    firstName: string;
    lastName: string;
    travelerType: string;
  }>;
  contactDetails: {
    email: string;
    phone: string;
  };
}

@Injectable()
export class EmailTemplateService {
  private readonly logger = new Logger(EmailTemplateService.name);

  /**
   * Generate QR code for booking reference
   */
  async generateBookingQRCode(bookingRef: string): Promise<string> {
    try {
      // Create simpler QR code data - just the booking reference
      const qrCodeData = `BOOKING:${bookingRef}`;

      const qrCodeDataURL = await QRCode.toDataURL(qrCodeData, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        rendererOpts: {
          quality: 0.92,
        },
      });

      this.logger.log(
        `QR code generated successfully for booking: ${bookingRef}`,
      );
      return qrCodeDataURL;
    } catch (error) {
      this.logger.error(
        `Failed to generate QR code for booking ${bookingRef}:`,
        error,
      );
      return '';
    }
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }

  /**
   * Format time for display
   */
  private formatTime(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  }

  /**
   * Format currency for display
   */
  private formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  /**
   * Generate booking confirmation email HTML
   */
  async generateBookingConfirmationEmail(
    bookingData: BookingEmailData,
  ): Promise<string> {
    this.logger.log(
      `Generating email template for booking: ${bookingData.bookingRef}`,
    );

    const qrCodeDataURL = await this.generateBookingQRCode(
      bookingData.bookingRef,
    );

    if (qrCodeDataURL) {
      this.logger.log(
        `QR code generated successfully, data URL length: ${qrCodeDataURL.length}`,
      );
    } else {
      this.logger.warn(
        `QR code generation failed for booking: ${bookingData.bookingRef}`,
      );
    }

    const totalPrice = this.formatCurrency(
      bookingData.totalPrice,
      bookingData.currency,
    );

    // Determine if this is a round-trip or one-way booking
    const isRoundTrip = bookingData.bookingType === BookingType.ROUND_TRIP && bookingData.flightData;

    let flightDetailsHtml = '';
    let emailSubjectRoute = '';

    if (isRoundTrip && bookingData.flightData) {
      // Handle round-trip booking
      const goFlight = bookingData.flightData.find(f => f.typeOfFlight === FlightType.GO);
      const returnFlight = bookingData.flightData.find(f => f.typeOfFlight === FlightType.RETURN);

      if (goFlight && returnFlight) {
        emailSubjectRoute = `${goFlight.originAirportCode} ⇄ ${goFlight.destinationAirportCode}`;
        flightDetailsHtml = this.generateRoundTripFlightHtml(goFlight, returnFlight);
      }
    } else {
      // Handle one-way booking (legacy)
      if (bookingData.departureDate && bookingData.arrivalDate) {
        emailSubjectRoute = `${bookingData.originAirportCode} → ${bookingData.destinationAirportCode}`;
        const departureDate = this.formatDate(bookingData.departureDate);
        const departureTime = this.formatTime(bookingData.departureDate);
        const arrivalDate = this.formatDate(bookingData.arrivalDate);
        const arrivalTime = this.formatTime(bookingData.arrivalDate);

        flightDetailsHtml = this.generateOneWayFlightHtml({
          flightId: bookingData.flightId || '',
          originAirportCode: bookingData.originAirportCode || '',
          destinationAirportCode: bookingData.destinationAirportCode || '',
          originCity: bookingData.originCity || '',
          destinationCity: bookingData.destinationCity || '',
          departureDate,
          departureTime,
          arrivalDate,
          arrivalTime,
          selectedBaggageOption: bookingData.selectedBaggageOption
        });
      }
    }

    const passengersHtml = bookingData.travellersInfo
      .map(
        (passenger, index) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">
            ${passenger.firstName} ${passenger.lastName}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-transform: capitalize;">
            ${passenger.travelerType}
          </td>
        </tr>
      `,
      )
      .join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Confirmation - ${bookingData.bookingRef}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            border-radius: 12px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 28px;
            font-weight: 300;
        }
        .booking-ref {
            background-color: rgba(255, 255, 255, 0.2);
            padding: 15px;
            border-radius: 8px;
            margin-top: 20px;
            text-align: center;
        }
        .booking-ref-number {
            font-size: 24px;
            font-weight: bold;
            letter-spacing: 2px;
        }
        .content {
            padding: 30px;
        }
        .flight-info {
            background-color: #f8f9fa;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        .route {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin: 20px 0;
        }
        .airport {
            text-align: center;
            flex: 1;
        }
        .airport-code {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
        }
        .city-name {
            color: #666;
            font-size: 14px;
        }
        .arrow {
            flex: 0 0 60px;
            text-align: center;
            color: #667eea;
            font-size: 20px;
        }
        .date-time {
            margin: 10px 0;
            padding: 10px;
            background-color: white;
            border-radius: 6px;
            border-left: 4px solid #667eea;
        }
        .passengers-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        .passengers-table th {
            background-color: #667eea;
            color: white;
            padding: 12px;
            text-align: left;
        }
        .qr-section {
            text-align: center;
            margin: 30px 0;
            padding: 20px;
            background-color: #f8f9fa;
            border-radius: 8px;
        }
        .qr-code-img {
            max-width: 200px;
            height: auto;
            border: 2px solid #ddd;
            border-radius: 8px;
            padding: 10px;
            background-color: white;
            display: block;
            margin: 0 auto;
        }
        .qr-fallback {
            text-align: center;
            margin: 20px 0;
            padding: 20px;
            background-color: #f8f9fa;
            border: 2px dashed #ccc;
            border-radius: 8px;
        }
        .price-summary {
            background-color: #e8f5e8;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
            text-align: center;
        }
        .total-price {
            font-size: 28px;
            font-weight: bold;
            color: #28a745;
        }
        .footer {
            background-color: #f8f9fa;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }
        .next-steps {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
        }
        @media (max-width: 600px) {
            .route {
                flex-direction: column;
            }
            .arrow {
                transform: rotate(90deg);
                margin: 10px 0;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✈️ Smart Airport</h1>
            <p style="margin: 10px 0 0 0; font-size: 18px;">Booking Confirmed!</p>
            <div class="booking-ref">
                <div style="font-size: 14px; margin-bottom: 5px;">Booking Reference</div>
                <div class="booking-ref-number">${bookingData.bookingRef}</div>
            </div>
        </div>

        <div class="content">
            ${flightDetailsHtml}

            <div style="margin: 30px 0;">
                <h3 style="color: #333; margin-bottom: 15px;">Passengers</h3>
                <table class="passengers-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Type</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${passengersHtml}
                    </tbody>
                </table>
            </div>

            <div class="price-summary">
                <h3 style="margin: 0 0 10px 0; color: #333;">Total Paid</h3>
                <div class="total-price">${totalPrice}</div>
                <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                    Payment completed successfully
                </p>
            </div>

            <div class="qr-section">
                <h3 style="margin: 0 0 15px 0; color: #333;">Mobile Boarding Pass</h3>
                ${
                  qrCodeDataURL && qrCodeDataURL.startsWith('data:image')
                    ? `
                    <div style="text-align: center; margin: 20px 0;">
                        <img src="${qrCodeDataURL}" alt="Booking QR Code - ${bookingData.bookingRef}" class="qr-code-img" />
                    </div>
                    <p style="margin: 15px 0 0 0; color: #666; font-size: 14px;">
                        Scan this QR code at the airport for quick check-in
                    </p>
                `
                    : `
                    <div class="qr-fallback">
                        <p style="margin: 0; color: #667eea; font-size: 20px; font-weight: bold;">
                            📱 ${bookingData.bookingRef}
                        </p>
                        <p style="margin: 10px 0 0 0; color: #666; font-size: 14px;">
                            Show this booking reference at the airport for check-in
                        </p>
                        <p style="margin: 10px 0 0 0; color: #999; font-size: 12px;">
                            QR code will be available in your mobile app
                        </p>
                    </div>
                `
                }
            </div>

            <div class="next-steps">
                <h3 style="margin: 0 0 15px 0; color: #856404;">Next Steps</h3>
                <ul style="margin: 0; padding-left: 20px; color: #856404;">
                    <li>Check-in online 24 hours before departure</li>
                    <li>Arrive at the airport 2 hours before domestic flights, 3 hours before international</li>
                    <li>Bring valid ID and passport (for international flights)</li>
                    <li>Review baggage allowances and restrictions</li>
                </ul>
            </div>

            <div style="margin: 30px 0; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
                <h3 style="margin: 0 0 15px 0; color: #333;">Contact Information</h3>
                <p style="margin: 5px 0; color: #666;">
                    <strong>Email:</strong> ${bookingData.contactDetails.email}
                </p>
                <p style="margin: 5px 0; color: #666;">
                    <strong>Phone:</strong> ${bookingData.contactDetails.phone}
                </p>
            </div>
        </div>

        <div class="footer">
            <p><strong>Smart Airport</strong></p>
            <p>Need help? Contact us at support@smartairport.com or +1-800-FLY-SMART</p>
            <p style="margin-top: 15px; font-size: 12px;">
                This is an automated email. Please do not reply to this message.
            </p>
        </div>
    </div>
</body>
</html>
    `;
  }

  /**
   * Generate HTML for round-trip flights
   */
  private generateRoundTripFlightHtml(goFlight: FlightEmailData, returnFlight: FlightEmailData): string {
    const goDepartureDate = this.formatDate(goFlight.departureDate);
    const goDepartureTime = this.formatTime(goFlight.departureDate);
    const goArrivalDate = this.formatDate(goFlight.arrivalDate);
    const goArrivalTime = this.formatTime(goFlight.arrivalDate);

    const returnDepartureDate = this.formatDate(returnFlight.departureDate);
    const returnDepartureTime = this.formatTime(returnFlight.departureDate);
    const returnArrivalDate = this.formatDate(returnFlight.arrivalDate);
    const returnArrivalTime = this.formatTime(returnFlight.arrivalDate);

    const goBaggageHtml = this.generateBaggageHtml(goFlight.selectedBaggageOption);
    const returnBaggageHtml = this.generateBaggageHtml(returnFlight.selectedBaggageOption);

    return `
      <div class="flight-info">
        <h2 style="margin-top: 0; color: #333;">Round Trip Flight Details</h2>

        <!-- Outbound Flight -->
        <div style="margin-bottom: 30px; padding: 20px; border: 2px solid #e3f2fd; border-radius: 8px; background-color: #f8f9fa;">
          <h3 style="margin: 0 0 15px 0; color: #1976d2;">✈️ Outbound Flight</h3>
          <p style="margin: 5px 0; color: #666;"><strong>Flight:</strong> ${goFlight.flightID}</p>
          ${goFlight.numberOfStops ? `<p style="margin: 5px 0; color: #666;"><strong>Stops:</strong> ${goFlight.numberOfStops}</p>` : ''}

          <div class="route">
            <div class="airport">
              <div class="airport-code">${goFlight.originAirportCode}</div>
              <div class="city-name">${goFlight.originCIty}</div>
            </div>
            <div class="arrow">→</div>
            <div class="airport">
              <div class="airport-code">${goFlight.destinationAirportCode}</div>
              <div class="city-name">${goFlight.destinationCIty}</div>
            </div>
          </div>

          <div class="date-time">
            <strong>Departure:</strong> ${goDepartureDate} at ${goDepartureTime}
          </div>
          <div class="date-time">
            <strong>Arrival:</strong> ${goArrivalDate} at ${goArrivalTime}
          </div>

          ${goBaggageHtml}
        </div>

        <!-- Return Flight -->
        <div style="margin-bottom: 20px; padding: 20px; border: 2px solid #e8f5e8; border-radius: 8px; background-color: #f8f9fa;">
          <h3 style="margin: 0 0 15px 0; color: #388e3c;">🔄 Return Flight</h3>
          <p style="margin: 5px 0; color: #666;"><strong>Flight:</strong> ${returnFlight.flightID}</p>
          ${returnFlight.numberOfStops ? `<p style="margin: 5px 0; color: #666;"><strong>Stops:</strong> ${returnFlight.numberOfStops}</p>` : ''}

          <div class="route">
            <div class="airport">
              <div class="airport-code">${returnFlight.originAirportCode}</div>
              <div class="city-name">${returnFlight.originCIty}</div>
            </div>
            <div class="arrow">→</div>
            <div class="airport">
              <div class="airport-code">${returnFlight.destinationAirportCode}</div>
              <div class="city-name">${returnFlight.destinationCIty}</div>
            </div>
          </div>

          <div class="date-time">
            <strong>Departure:</strong> ${returnDepartureDate} at ${returnDepartureTime}
          </div>
          <div class="date-time">
            <strong>Arrival:</strong> ${returnArrivalDate} at ${returnArrivalTime}
          </div>

          ${returnBaggageHtml}
        </div>
      </div>
    `;
  }

  /**
   * Generate HTML for one-way flights
   */
  private generateOneWayFlightHtml(flightData: {
    flightId: string;
    originAirportCode: string;
    destinationAirportCode: string;
    originCity: string;
    destinationCity: string;
    departureDate: string;
    departureTime: string;
    arrivalDate: string;
    arrivalTime: string;
    selectedBaggageOption?: any;
  }): string {
    const baggageHtml = this.generateBaggageHtml(flightData.selectedBaggageOption);

    return `
      <div class="flight-info">
        <h2 style="margin-top: 0; color: #333;">Flight Details</h2>
        <p style="margin: 5px 0; color: #666;"><strong>Flight:</strong> ${flightData.flightId}</p>

        <div class="route">
          <div class="airport">
            <div class="airport-code">${flightData.originAirportCode}</div>
            <div class="city-name">${flightData.originCity}</div>
          </div>
          <div class="arrow">→</div>
          <div class="airport">
            <div class="airport-code">${flightData.destinationAirportCode}</div>
            <div class="city-name">${flightData.destinationCity}</div>
          </div>
        </div>

        <div class="date-time">
          <strong>Departure:</strong> ${flightData.departureDate} at ${flightData.departureTime}
        </div>
        <div class="date-time">
          <strong>Arrival:</strong> ${flightData.arrivalDate} at ${flightData.arrivalTime}
        </div>

        ${baggageHtml}
      </div>
    `;
  }

  /**
   * Generate baggage HTML section
   */
  private generateBaggageHtml(selectedBaggageOption?: any): string {
    if (!selectedBaggageOption) {
      return '';
    }

    return `
      <div style="margin-top: 15px; padding: 15px; background-color: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
        <h4 style="margin: 0 0 10px 0; color: #856404; font-size: 14px;">Baggage Information</h4>
        <p style="margin: 5px 0; color: #856404; font-size: 13px;">
          <strong>Type:</strong> ${selectedBaggageOption.type || 'Standard'}
        </p>
        ${
          selectedBaggageOption.weight
            ? `
          <p style="margin: 5px 0; color: #856404; font-size: 13px;">
            <strong>Weight:</strong> ${selectedBaggageOption.weight}
          </p>
        `
            : ''
        }
        ${
          selectedBaggageOption.price
            ? `
          <p style="margin: 5px 0; color: #856404; font-size: 13px;">
            <strong>Price:</strong> $${selectedBaggageOption.price}
          </p>
        `
            : ''
        }
      </div>
    `;
  }

  /**
   * Test QR code generation (for debugging)
   */
  async testQRCodeGeneration(bookingRef: string): Promise<{
    success: boolean;
    qrCodeDataURL?: string;
    error?: string;
    dataLength?: number;
  }> {
    try {
      const qrCodeDataURL = await this.generateBookingQRCode(bookingRef);

      if (qrCodeDataURL && qrCodeDataURL.startsWith('data:image')) {
        return {
          success: true,
          qrCodeDataURL,
          dataLength: qrCodeDataURL.length,
        };
      } else {
        return {
          success: false,
          error: 'QR code generation returned empty or invalid data',
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate QR code and display it in terminal
   */
  async generateAndLogQRCodeToTerminal(bookingRef: string): Promise<void> {
    try {
      this.logger.log(`🎯 Generating QR code for booking: ${bookingRef}`);

      // Create QR code data
      const qrCodeData = `BOOKING:${bookingRef}`;
      this.logger.log(`📝 QR Code Data: ${qrCodeData}`);

      // Generate QR code as terminal string (ASCII)
      const qrCodeTerminal = await QRCode.toString(qrCodeData, {
        type: 'terminal',
        small: true,
        errorCorrectionLevel: 'M',
      });

      // Also generate data URL for verification
      const qrCodeDataURL = await this.generateBookingQRCode(bookingRef);

      console.log('\n' + '='.repeat(50));
      console.log('🎫 BOOKING QR CODE - TERMINAL DISPLAY');
      console.log('='.repeat(50));
      console.log(`📋 Booking Reference: ${bookingRef}`);
      console.log(`📊 QR Data: ${qrCodeData}`);
      console.log('='.repeat(50));
      console.log('\n📱 QR CODE (Scan with your phone):');
      console.log(qrCodeTerminal);
      console.log('='.repeat(50));

      if (qrCodeDataURL) {
        console.log(
          `✅ Data URL Generated: ${qrCodeDataURL.substring(0, 50)}...`,
        );
        console.log(`📏 Data URL Length: ${qrCodeDataURL.length} characters`);
      }

      console.log('='.repeat(50));
      console.log('✨ QR Code generation completed successfully!');
      console.log('📱 You can scan this QR code with your phone camera');
      console.log('🔍 It should show: ' + qrCodeData);
      console.log('='.repeat(50) + '\n');

      this.logger.log(
        `✅ QR code displayed in terminal for booking: ${bookingRef}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to generate terminal QR code for booking ${bookingRef}:`,
        error,
      );
      console.log('\n' + '='.repeat(50));
      console.log('❌ QR CODE GENERATION FAILED');
      console.log('='.repeat(50));
      console.log(`📋 Booking Reference: ${bookingRef}`);
      console.log(
        `🚨 Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      console.log('='.repeat(50) + '\n');
    }
  }
}
