import { Injectable, Logger, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AmadeusService {
  private readonly logger = new Logger(AmadeusService.name);
  private readonly baseUrl = 'https://test.api.amadeus.com';

  constructor(private readonly configService: ConfigService) {}

  private async getAxiosInstance() {
    const rax = await import('retry-axios'); // Import the module directly
    const instance = axios.create();
    instance.defaults.raxConfig = {
      instance,
      retry: 3,
      retryDelay: 1000,
      backoffType: 'exponential',
      onRetryAttempt: (err) => {
        const cfg = rax.getConfig(err);
        this.logger.warn(`Retry attempt #${cfg?.currentRetryAttempt}`);
      },
    };
    rax.attach(instance);
    return instance;
  }

  async getAccessToken(): Promise<string> {
    const clientId = this.configService.get<string>('AMADEUS_API_KEY');
    const clientSecret = this.configService.get<string>('AMADEUS_API_SECRET');
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const axiosInstance = await this.getAxiosInstance(); // Add 'await'

    try {
      const response = await axiosInstance.post(
        `${this.baseUrl}/v1/security/oauth2/token`,
        body.toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      );
      // this.logger.log('Fetched Amadeus access token');
      return response.data.access_token;
    } catch (error) {
      this.logger.error(`Token fetch error: ${error}`);
      throw new HttpException('Failed to fetch access token', 500);
    }
  }

  async searchFlightOffers(
    origin: string,
    destination: string,
    departureDate: string,
    adults: number,
    children: number = 0,
    infants: number = 0,
    cabinClass: string,
    returnDate?: string,
    limit: number = 10,
  ): Promise<any[]> {
    const token = await this.getAccessToken();
    let url = `${this.baseUrl}/v2/shopping/flight-offers?originLocationCode=${origin}&destinationLocationCode=${destination}&departureDate=${departureDate}&adults=${adults}&children=${children}&infants=${infants}&travelClass=${cabinClass}&currencyCode=USD&max=${limit}`;
    if (returnDate) {
      url += `&returnDate=${returnDate}`;
    }

    const axiosInstance = await this.getAxiosInstance(); // Add 'await'

    try {
      const response = await axiosInstance.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      // this.logger.log(`Fetched ${response.data.data.length} flight offers from Amadeus`);
      return response.data.data;
    } catch (error) {
      this.logger.error(
        `Flight search error: ${JSON.stringify(error.response?.data || error.message)}`,
      );
      throw new HttpException(
        {
          status: error.response?.status || 500,
          message:
            error.response?.data?.errors?.[0]?.detail ||
            'Failed to fetch flight offers',
          details: error.response?.data,
        },
        error.response?.status || 500,
      );
    }
  }

  async searchMultiCityFlights(
    legs: { origin: string; destination: string; departureDate: string }[],
    adults: number,
    children: number = 0,
    infants: number = 0,
    cabinClass: string,
    limit: number = 10,
  ): Promise<any[]> {
    const token = await this.getAccessToken();

    const originDestinations = legs
      .map((leg, index) => ({
        id: `${index + 1}`,
        originLocationCode: leg.origin,
        destinationLocationCode: leg.destination,
        departureDateTimeRange: { date: leg.departureDate },
      }))
      .map((param) => ({
        ...param,
        departureDateTimeRange: param.departureDateTimeRange.date,
      }))
      .map((param) => new URLSearchParams(param).toString())
      .join('&');

    const url = `${this.baseUrl}/v2/shopping/flight-offers?${originDestinations}&adults=${adults}&children=${children}&infants=${infants}&travelClass=${cabinClass}&currencyCode=USD&max=${limit}`;

    const axiosInstance = await this.getAxiosInstance(); // Add 'await'

    try {
      const response = await axiosInstance.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      return response.data.data;
    } catch (error) {
      this.logger.error(
        `Multi-city search error: ${JSON.stringify(error.response?.data || error.message)}`,
      );
      throw new HttpException(
        {
          status: error.response?.status || 500,
          message:
            error.response?.data?.errors?.[0]?.detail ||
            'Failed to fetch multi-city offers',
          details: error.response?.data,
        },
        error.response?.status || 500,
      );
    }
  }

  async getFlightOffer(offerId: string): Promise<any> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}/v2/shopping/flight-offers/${offerId}`;

    const axiosInstance = await this.getAxiosInstance(); // Add 'await'

    try {
      const response = await axiosInstance.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });
      return response.data.data;
    } catch (error) {
      this.logger.error(
        `Flight offer fetch error: ${JSON.stringify(error.response?.data || error.message)}`,
      );
      throw new HttpException(
        {
          status: error.response?.status || 500,
          message:
            error.response?.data?.errors?.[0]?.detail ||
            'Failed to fetch flight offer',
          details: error.response?.data,
        },
        error.response?.status || 500,
      );
    }
  }

  // NEW: Get seat map for a flight offer
  async getSeatMap(offerId: string): Promise<any> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}/v1/shopping/seatmaps`;
    const axiosInstance = await this.getAxiosInstance();
    try {
      // Fetch the full flight offer object
      this.logger.log(`Requesting seat map for Amadeus offerId: ${offerId}`);
      const offer = await this.getFlightOffer(offerId);
      // Send the full offer object in the seat map request
      const response = await axiosInstance.post(
        url,
        {
          data: [offer],
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Seat map fetch error for offerId ${offerId}: ${JSON.stringify(error.response?.data || error.message)}`,
      );
      throw new HttpException(
        {
          status: error.response?.status || 500,
          message:
            (error.response?.data?.errors?.[0]?.detail ||
              'Failed to fetch seat map') +
            '. The offer may have expired or is not available for seat maps.',
          details: error.response?.data,
        },
        error.response?.status || 500,
      );
    }
  }

  async getFlightStatus(flightNumber: string): Promise<string> {
    // TODO: Integrate with a real flight status API (e.g., FlightAware, AviationStack)
    this.logger.warn(
      `Flight status for ${flightNumber} is mocked; returning 'Scheduled'`,
    );
    return 'Scheduled';
  }
}
