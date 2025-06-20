import { Controller, Get, Query, Post, Body } from '@nestjs/common';
import { EmailTemplateService } from '../services/email-template.service';
import { EmailService } from '../email.service';

@Controller('email-test')
export class EmailTestController {
  constructor(
    private emailTemplateService: EmailTemplateService,
    private emailService: EmailService,
  ) {}

  @Get('qr-code')
  async testQRCode(@Query('bookingRef') bookingRef: string = 'TEST123') {
    const result =
      await this.emailTemplateService.testQRCodeGeneration(bookingRef);

    return {
      success: true,
      message: 'QR code test completed',
      data: result,
    };
  }

  @Get('qr-code-terminal')
  async testQRCodeTerminal(
    @Query('bookingRef') bookingRef: string = 'AB123456',
  ) {
    // This will display the QR code in the server terminal
    await this.emailTemplateService.generateAndLogQRCodeToTerminal(bookingRef);

    return {
      success: true,
      message: `QR code for booking ${bookingRef} has been displayed in the server terminal`,
      data: {
        bookingRef,
        qrData: `BOOKING:${bookingRef}`,
        instructions:
          'Check your server terminal/console to see the QR code display',
      },
    };
  }

  @Get('email-preview')
  async previewEmail(@Query('bookingRef') bookingRef: string = 'TEST123') {
    const testBookingData = {
      bookingRef: bookingRef,
      flightId: 'FL123456',
      originAirportCode: 'LGA',
      destinationAirportCode: 'DAD',
      originCity: 'New York',
      destinationCity: 'Da Nang',
      departureDate: new Date('2024-08-28T14:00:00Z'),
      arrivalDate: new Date('2024-08-28T18:00:00Z'),
      totalPrice: 900.0,
      currency: 'USD',
      travellersInfo: [
        {
          firstName: 'Ahmed',
          lastName: 'Mohamed',
          travelerType: 'adult',
        },
        {
          firstName: 'Sara',
          lastName: 'Ahmed',
          travelerType: 'adult',
        },
      ],
      contactDetails: {
        email: 'test@example.com',
        phone: '+201234567890',
      },
      selectedBaggageOption: {
        type: 'checked',
        weight: '23kg',
        price: 50,
        currency: 'USD',
      },
    };

    try {
      const html =
        await this.emailTemplateService.generateBookingConfirmationEmail(
          testBookingData,
        );

      return {
        success: true,
        message: 'Email preview generated',
        data: {
          html: html,
          bookingRef: bookingRef,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to generate email preview',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Get('health')
  async testEmailHealth() {
    try {
      // Test email service configuration
      return {
        success: true,
        message: 'Email service is healthy',
        data: {
          configured: true,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Email service health check failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Post('send-test-email')
  async sendTestEmail(@Body() body: { email: string; bookingRef?: string }) {
    try {
      const { email, bookingRef = 'TEST123' } = body;

      const testBookingData = {
        bookingRef: bookingRef,
        flightId: 'FL123456',
        originAirportCode: 'LGA',
        destinationAirportCode: 'DAD',
        originCity: 'New York',
        destinationCity: 'Da Nang',
        departureDate: new Date('2024-08-28T14:00:00Z'),
        arrivalDate: new Date('2024-08-28T18:00:00Z'),
        totalPrice: 900.0,
        currency: 'USD',
        travellersInfo: [
          {
            firstName: 'Test',
            lastName: 'User',
            travelerType: 'adult',
          },
        ],
        contactDetails: {
          email: email,
          phone: '+201234567890',
        },
        selectedBaggageOption: {
          type: 'checked',
          weight: '23kg',
          price: 50,
          currency: 'USD',
        },
      };

      await this.emailService.sendBookingConfirmationEmail(testBookingData);

      return {
        success: true,
        message: `Test booking confirmation email sent to ${email}`,
        data: {
          email,
          bookingRef,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to send test email',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
