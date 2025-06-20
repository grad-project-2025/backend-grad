(`POST /booking/book-flight`) now handles both booking types seamlessly.

## Key Features

### ✅ Implemented Features
- **Dual Booking Support**: Single endpoint handles both one-way and round-trip bookings
- **Enhanced Data Structure**: New `flightData` array for round-trip flights
- **Smart Validation**: Automatic validation based on booking type
- **Email Templates**: Updated confirmation emails with round-trip flight details
- **Payment Integration**: Full compatibility with existing payment systems
- **Backward Compatibility**: Existing one-way bookings continue to work unchanged

### 🔧 Technical Implementation

#### 1. Extended DTOs
- Added `BookingType` enum (`ONE_WAY`, `ROUND_TRIP`)
- Added `FlightType` enum (`GO`, `RETURN`)
- Created `FlightDataDto` for individual flight information
- Enhanced `CreateBookingDto` with conditional validation

#### 2. Updated Database Schema
- Added `bookingType` field with default `ONE_WAY`
- Added `flightData` array for round-trip flights
- Maintained legacy fields for backward compatibility

#### 3. Enhanced Services
- **BookingService**: Smart booking creation based on type
- **EmailService**: Dynamic email generation for both booking types
- **PaymentService**: Updated data conversion for email notifications

## API Usage

### Endpoint
```
POST /booking/book-flight
```

### Headers
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Round-Trip Booking Request
```json
{
  "bookingType": "ROUND_TRIP",
  "flightData": [
    {
      "flightID": "GO123456",
      "typeOfFlight": "GO",
      "numberOfStops": 1,
      "originAirportCode": "LGA",
      "destinationAirportCode": "DAD",
      "originCIty": "New York",
      "destinationCIty": "Da Nang",
      "departureDate": "2024-08-28",
      "arrivalDate": "2024-08-29",
      "selectedBaggageOption": {
        "type": "checked",
        "weight": "23kg",
        "price": 50
      }
    },
    {
      "flightID": "RT789012",
      "typeOfFlight": "RETURN",
      "originAirportCode": "DAD",
      "destinationAirportCode": "LGA",
      "originCIty": "Da Nang",
      "destinationCIty": "New York",
      "departureDate": "2024-09-05",
      "arrivalDate": "2024-09-06",
      "selectedBaggageOption": {
        "type": "checked",
        "weight": "23kg",
        "price": 50
      }
    }
  ],
  "totalPrice": 1500.00,
  "currency": "USD",
  "travellersInfo": [
    {
      "firstName": "Ahmed",
      "lastName": "Mohamed",
      "birthDate": "2000-02-01",
      "travelerType": "adult",
      "nationality": "EG",
      "passportNumber": "A12345678",
      "issuingCountry": "Egypt",
      "expiryDate": "2030-02-01"
    }
  ],
  "contactDetails": {
    "email": "ahmed.mohamed@example.com",
    "phone": "+201234567890"
  }
}
```

### One-Way Booking Request (Legacy Support)
```json
{
  "bookingType": "ONE_WAY",
  "flightID": "OW123456",
  "originAirportCode": "LGA",
  "destinationAirportCode": "DAD",
  "originCIty": "New York",
  "destinationCIty": "Da Nang",
  "departureDate": "2024-08-28",
  "arrivalDate": "2024-08-29",
  "selectedBaggageOption": {
    "type": "checked",
    "weight": "23kg",
    "price": 50
  },
  "totalPrice": 800.00,
  "currency": "USD",
  "travellersInfo": [
    {
      "firstName": "Ahmed",
      "lastName": "Mohamed",
      "birthDate": "2000-02-01",
      "travelerType": "adult",
      "nationality": "EG",
      "passportNumber": "A12345678",
      "issuingCountry": "Egypt",
      "expiryDate": "2030-02-01"
    }
  ],
  "contactDetails": {
    "email": "ahmed.mohamed@example.com",
    "phone": "+201234567890"
  }
}
```

## Validation Rules

### Round-Trip Bookings
- Must have exactly 2 flights in `flightData` array
- One flight must have `typeOfFlight: "GO"`
- One flight must have `typeOfFlight: "RETURN"`
- Return flight departure must be after outbound flight arrival
- All flight data fields are required

### One-Way Bookings
- Legacy fields (`flightID`, `originAirportCode`, etc.) are required
- `bookingType` defaults to `ONE_WAY` if not specified
- Maintains full backward compatibility
