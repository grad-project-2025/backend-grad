// Utility to generate a default seat map (e.g., 30 rows, 6 seats per row: A-F)
import { SeatInfo } from '../interfaces/flight-data.interface';

export function generateDefaultSeatMap(rows = 30, seatsPerRow = 6): SeatInfo[] {
  const seatLetters = 'ABCDEF'.split('');
  const seatMap: SeatInfo[] = [];
  for (let row = 1; row <= rows; row++) {
    for (let seat = 0; seat < seatsPerRow; seat++) {
      seatMap.push({
        seatNumber: `${row}${seatLetters[seat]}`,
        status: 'available',
      });
    }
  }
  return seatMap;
}
