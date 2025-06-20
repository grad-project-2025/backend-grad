import { Injectable } from '@nestjs/common';

@Injectable()
export class PricingService {
  calculateTotalPrice(
    flight: any,
    passengers: {
      adults: number;
      children?: number;
      infants?: number;
    },
  ) {
    // Ensure valid flight data or return an error or default values
    if (!flight || typeof flight.price !== 'number' || flight.price <= 0) {
      throw new Error('Invalid flight data or price.');
    }

    const { adults = 1, children = 0, infants = 0 } = passengers;

    // Ensure valid passenger counts
    const validAdults = Math.max(0, Math.floor(adults)); // Ensure non-negative integer
    const validChildren = Math.max(0, Math.floor(children)); // Ensure non-negative integer
    const validInfants = Math.max(0, Math.floor(infants)); // Ensure non-negative integer

    const basePrice = flight.price;
    const currency = flight.currency || 'USD';
    const airline = flight.carrierCode || flight.airline || 'Unknown';

    // Default pricing rules with airline-specific overrides
    const pricingRules = this.getPricingRules(airline);

    const passengerBreakdown = [
      {
        type: 'ADT',
        count: validAdults,
        priceEach: basePrice * pricingRules.adultMultiplier,
        description: 'Adult',
      },
    ];

    if (validChildren > 0) {
      passengerBreakdown.push({
        type: 'CHD',
        count: validChildren,
        priceEach: basePrice * pricingRules.childMultiplier,
        description: 'Child (2-11 years)',
      });
    }

    if (validInfants > 0) {
      passengerBreakdown.push({
        type: 'INF',
        count: validInfants,
        priceEach: basePrice * pricingRules.infantMultiplier,
        description: 'Infant (under 2)',
      });
    }

    const passengersSubtotal = passengerBreakdown.reduce(
      (sum, p) => sum + p.priceEach * p.count,
      0,
    );

    const fees = [
      {
        name: 'Taxes',
        amount: passengersSubtotal * pricingRules.taxPercentage,
      },
      {
        name: 'Service Fee',
        amount: pricingRules.serviceFee,
      },
    ];

    const feesTotal = fees.reduce((sum, fee) => sum + fee.amount, 0);

    return {
      summary: {
        totalPrice: this.roundCurrency(passengersSubtotal + feesTotal),
        currency,
        priceGuaranteedUntil: new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString(), // 24 hrs
      },
      breakdown: {
        passengers: passengerBreakdown.map((p) => ({
          ...p,
          priceEach: this.roundCurrency(p.priceEach),
          subtotal: this.roundCurrency(p.priceEach * p.count),
        })),
        fees: fees.map((f) => ({
          ...f,
          amount: this.roundCurrency(f.amount),
        })),
      },
    };
  }

  private getPricingRules(airline: string) {
    const rules = {
      adultMultiplier: 1.0,
      childMultiplier: 0.8,
      infantMultiplier: 0.2,
      taxPercentage: 0.15,
      serviceFee: 50.0,
    };

    // Add airline-specific overrides if needed
    if (airline === 'SV') {
      // Saudia
      rules.childMultiplier = 0.75;
    }
    // Add more airline-specific rules as needed

    return rules;
  }

  private roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
