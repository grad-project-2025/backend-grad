import { Injectable, Logger } from '@nestjs/common';
import { TravelerType } from '../dto/create-booking.dto';
import { TravelerInfo } from '../schemas/booking.schema';

export interface SeatAssignment {
  travelerIndex: number;
  seatNumber: string;
  travelerType: TravelerType;
  travelerName: string;
}

@Injectable()
export class SeatAssignmentService {
  private readonly logger = new Logger(SeatAssignmentService.name);

  // Standard aircraft configurations
  private readonly seatConfigurations = {
    // Economy class configuration (most common)
    economy: {
      rows: 30,
      seatsPerRow: 6,
      seatLetters: ['A', 'B', 'C', 'D', 'E', 'F'],
      excludedRows: [13], // Row 13 is often skipped
    },
    // Business class configuration
    business: {
      rows: 8,
      seatsPerRow: 4,
      seatLetters: ['A', 'B', 'C', 'D'],
      excludedRows: [],
    },
  };

  /**
   * Generate random seat assignments for travelers
   * Only adults and children get seat assignments, infants do not
   */
  async assignSeats(
    travelers: TravelerInfo[],
    cabinClass: 'economy' | 'business' = 'economy',
  ): Promise<SeatAssignment[]> {
    this.logger.log(`Assigning seats for ${travelers.length} travelers in ${cabinClass} class`);

    const assignments: SeatAssignment[] = [];
    const usedSeats = new Set<string>();

    // Filter travelers who need seats (adults and children only)
    const travelersNeedingSeats = travelers.filter(
      (traveler, index) => {
        const needsSeat = traveler.travelerType === TravelerType.ADULT || 
                         traveler.travelerType === TravelerType.CHILD;
        
        if (needsSeat) {
          this.logger.log(`Traveler ${index + 1}: ${traveler.firstName} ${traveler.lastName} (${traveler.travelerType}) - needs seat`);
        } else {
          this.logger.log(`Traveler ${index + 1}: ${traveler.firstName} ${traveler.lastName} (${traveler.travelerType}) - no seat needed`);
        }
        
        return needsSeat;
      }
    );

    this.logger.log(`${travelersNeedingSeats.length} travelers need seat assignments`);

    // Generate seat assignments
    for (let i = 0; i < travelers.length; i++) {
      const traveler = travelers[i];
      
      if (traveler.travelerType === TravelerType.ADULT || traveler.travelerType === TravelerType.CHILD) {
        const seatNumber = this.generateRandomSeat(cabinClass, usedSeats);
        usedSeats.add(seatNumber);

        assignments.push({
          travelerIndex: i,
          seatNumber,
          travelerType: traveler.travelerType,
          travelerName: `${traveler.firstName} ${traveler.lastName}`,
        });

        this.logger.log(`Assigned seat ${seatNumber} to ${traveler.firstName} ${traveler.lastName} (${traveler.travelerType})`);
      } else {
        this.logger.log(`No seat assigned to ${traveler.firstName} ${traveler.lastName} (${traveler.travelerType})`);
      }
    }

    this.logger.log(`Seat assignment completed. ${assignments.length} seats assigned.`);
    return assignments;
  }

  /**
   * Generate a random available seat number
   */
  private generateRandomSeat(
    cabinClass: 'economy' | 'business',
    usedSeats: Set<string>,
  ): string {
    const config = this.seatConfigurations[cabinClass];
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      // Generate random row (avoiding excluded rows)
      let row: number;
      do {
        row = Math.floor(Math.random() * config.rows) + 1;
      } while (config.excludedRows.includes(row));

      // Generate random seat letter
      const seatLetter = config.seatLetters[
        Math.floor(Math.random() * config.seatLetters.length)
      ];

      const seatNumber = `${row}${seatLetter}`;

      if (!usedSeats.has(seatNumber)) {
        return seatNumber;
      }

      attempts++;
    }

    // Fallback: generate a sequential seat if random generation fails
    this.logger.warn('Random seat generation failed, using fallback method');
    return this.generateFallbackSeat(cabinClass, usedSeats);
  }

  /**
   * Fallback method to generate seats sequentially
   */
  private generateFallbackSeat(
    cabinClass: 'economy' | 'business',
    usedSeats: Set<string>,
  ): string {
    const config = this.seatConfigurations[cabinClass];

    for (let row = 1; row <= config.rows; row++) {
      if (config.excludedRows.includes(row)) continue;

      for (const letter of config.seatLetters) {
        const seatNumber = `${row}${letter}`;
        if (!usedSeats.has(seatNumber)) {
          return seatNumber;
        }
      }
    }

    // Ultimate fallback
    const timestamp = Date.now().toString().slice(-4);
    return `99${config.seatLetters[0]}${timestamp}`;
  }

  /**
   * Apply seat assignments to travelers array
   */
  async applySeatAssignments(
    travelers: TravelerInfo[],
    assignments: SeatAssignment[],
  ): Promise<TravelerInfo[]> {
    this.logger.log(`Applying ${assignments.length} seat assignments to travelers`);

    const updatedTravelers = [...travelers];
    const assignmentTime = new Date();

    assignments.forEach((assignment) => {
      if (assignment.travelerIndex < updatedTravelers.length) {
        updatedTravelers[assignment.travelerIndex].seatNumber = assignment.seatNumber;
        updatedTravelers[assignment.travelerIndex].seatAssignedAt = assignmentTime;
        
        this.logger.log(
          `Applied seat ${assignment.seatNumber} to traveler ${assignment.travelerIndex + 1}: ${assignment.travelerName}`
        );
      }
    });

    return updatedTravelers;
  }

  /**
   * Get seat assignment summary for logging/debugging
   */
  getSeatAssignmentSummary(assignments: SeatAssignment[]): string {
    if (assignments.length === 0) {
      return 'No seat assignments made';
    }

    const summary = assignments
      .map((a) => `${a.travelerName}: ${a.seatNumber}`)
      .join(', ');

    return `Seat assignments: ${summary}`;
  }

  /**
   * Validate seat assignments (for testing/debugging)
   */
  validateSeatAssignments(assignments: SeatAssignment[]): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const seatNumbers = assignments.map((a) => a.seatNumber);
    const uniqueSeats = new Set(seatNumbers);

    // Check for duplicate seat assignments
    if (seatNumbers.length !== uniqueSeats.size) {
      errors.push('Duplicate seat assignments detected');
    }

    // Check seat number format
    assignments.forEach((assignment) => {
      const seatRegex = /^\d{1,2}[A-F]$/;
      if (!seatRegex.test(assignment.seatNumber)) {
        errors.push(`Invalid seat number format: ${assignment.seatNumber}`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}
