
## Base URL
```
https://sky-shifters.duckdns.org/booking
```

## Authentication
All booking endpoints require JWT authentication. Include the access token in the Authorization header:
```
Authorization: Bearer <access_token>
```

## Booking Endpoints

### 1. Create Flight Booking
**POST** `/booking/book-flight`
**Authentication:** Required (Verified users only)

Create a new flight booking with passenger information and contact details.

**Request Body:**
```json
{
  "flightID": "FL123456",
  "originAirportCode": "LGA",
  "destinationAirportCode": "DAD",
  "originCIty": "New York",
  "destinationCIty": "Da Nang",
  "departureDate": "2024-08-28",
  "arrivalDate": "2024-08-28",
  "selectedBaggageOption": {
    "type": "checked",
    "weight": "23kg",
    "price": 50,
    "currency": "USD"
  },
  "totalPrice": 1500.00,
  "currency": "USD",
  "travellersInfo": [
    {
      "firstName": "Ahmed",
      "lastName": "Mohamed",
      "birthDate": "2000-02-01",
      "travelerType": "adult",
      "nationality": "Egypt",
      "passportNumber": "A12345678",
      "issuingCountry": "Egypt",
      "expiryDate": "2030-02-01"
    },
    {
      "firstName": "Sara",
      "lastName": "Ahmed",
      "birthDate": "1995-05-15",
      "travelerType": "adult",
      "nationality": "Egypt", // or EG 
      "passportNumber": "B87654321",
      "issuingCountry": "Egypt",
      "expiryDate": "2029-05-15"
    }
  ],
  "contactDetails": {
    "email": "ahmed.mohamed@example.com",
    "phone": "+201234567890"
  }
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Flight booked successfully",
  "data": {
    "success": true,
    "message": "Flight booked successfully",
    "bookingId": "507f1f77bcf86cd799439011",
    "bookingRef": "AB123456",
    "status": "pending"
  },
  "error": null,
  "meta": null
}
```

### 2. Get User Bookings
**GET** `/booking/my-bookings`
**Authentication:** Required

Retrieve all bookings for the authenticated user.

**Response (200):**
```json
{
  "success": true,
  "message": "response.success",
  "data": {
    "success": true,
    "bookings": [
      {
        "_id": "507f1f77bcf86cd799439011",
        "userId": "507f1f77bcf86cd799439012",
        "flightId": "FL123456",
        "originAirportCode": "LGA",
        "destinationAirportCode": "DAD",
        "originCity": "New York",
        "destinationCity": "Da Nang",
        "departureDate": "2024-08-28T00:00:00.000Z",
        "arrivalDate": "2024-08-28T00:00:00.000Z",
        "selectedBaggageOption": {
          "type": "checked",
          "weight": "23kg",
          "price": 50,
          "currency": "USD"
        },
        "totalPrice": 1537.50,
        "currency": "USD",
        "travellersInfo": [
          {
            "firstName": "Ahmed",
            "lastName": "Mohamed",
            "birthDate": "2000-02-01",
            "travelerType": "adult",
            "nationality": "Egyptian",
            "passportNumber": "A12345678",
            "issuingCountry": "Egypt",
            "expiryDate": "2030-02-01"
          }
        ],
        "contactDetails": {
          "email": "ahmed.mohamed@example.com",
          "phone": "+201234567890"
        },
        "bookingRef": "AB123456",
        "status": "pending",
        "paymentStatus": "pending",
        "createdAt": "2024-02-27T09:05:47.193Z",
        "updatedAt": "2024-02-27T09:05:47.193Z"
      }
    ]
  },
  "error": null,
  "meta": null
}
```

### 3. Get Booking Details
**GET** `/booking/:id`
**Authentication:** Required

Get detailed information about a specific booking.

**Parameters:**
- `id`: Booking ID

**Response (200):**
```json
{
  "success": true,
  "message": "response.success",
  "data": {
    "success": true,
    "booking": {
      "_id": "507f1f77bcf86cd799439011",
      "userId": "507f1f77bcf86cd799439012",
      "flightId": "FL123456",
      "originAirportCode": "LGA",
      "destinationAirportCode": "DAD",
      "originCity": "New York",
      "destinationCity": "Da Nang",
      "departureDate": "2024-08-28T00:00:00.000Z",
      "arrivalDate": "2024-08-28T00:00:00.000Z",
      "selectedBaggageOption": {
        "type": "checked",
        "weight": "23kg",
        "price": 50,
        "currency": "USD"
      },
      "totalPrice": 1537.50,
      "currency": "USD",
      "travellersInfo": [
        {
          "firstName": "Ahmed",
          "lastName": "Mohamed",
          "birthDate": "2000-02-01",
          "travelerType": "adult",
          "nationality": "Egyptian",
          "passportNumber": "A12345678",
          "issuingCountry": "Egypt",
          "expiryDate": "2030-02-01"
        }
      ],
      "contactDetails": {
        "email": "ahmed.mohamed@example.com",
        "phone": "+201234567890"
      },
      "bookingRef": "AB123456",
      "status": "pending",
      "paymentStatus": "pending",
      "createdAt": "2024-02-27T09:05:47.193Z",
      "updatedAt": "2024-02-27T09:05:47.193Z"
    }
  },
  "error": null,
  "meta": null
}
```

### 4. Cancel Booking
**POST** `/booking/:id/cancel`
**Authentication:** Required (Verified users only)

Cancel an existing booking. The booking must be in 'confirmed' status to be cancelled.

**Parameters:**
- `id`: Booking ID

**Request Body:**
```json
{
  "reason": "Change of plans"  // Optional
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "data": {
    "bookingId": "507f1f77bcf86cd799439011",
    "bookingRef": "AB123456",
    "status": "cancelled",
    "cancelledAt": "2024-02-27T10:15:30.000Z",
    "cancellationReason": "Change of plans"
  },
  "error": null,
  "meta": null
}
```

**Error Responses:**
- `404 Not Found`: Booking not found
- `403 Forbidden`: User not authorized to cancel this booking
- `400 Bad Request`: Booking is already cancelled or cannot be cancelled

## Booking Status and Timeout

### Booking Status Flow
```
pending -> confirmed -> cancelled
paymentStatus: pending -> completed -> failed
```

### Payment Timeout
- All new bookings start with `status: pending` and `paymentStatus: pending`
- If payment is not completed within 5 minutes (configurable via `BOOKING_TIMEOUT_MINUTES` environment variable), the booking will be automatically cancelled
- Cancelled bookings will have:
  - `status: cancelled`
  - `paymentStatus: failed`
  - `cancelledAt`: Timestamp of cancellation
- Users will receive an email notification when their booking is cancelled due to payment timeout

### Cancellation Rules
1. Only confirmed bookings can be cancelled
2. Users can only cancel their own bookings
3. Cancellation requires user verification
4. Cancellation reason is optional but recommended
5. Cancellation will trigger an email notification to the user

### Environment Variables
```
BOOKING_TIMEOUT_MINUTES=5  # Time in minutes before pending bookings are cancelled
```
