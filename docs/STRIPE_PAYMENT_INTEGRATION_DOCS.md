### 1. Create Payment Intent
**Endpoint**: `POST /payment/create-payment-intent`
**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body**:
```json
{
  "bookingId": "BOOKING_ID_FROM_STEP_1",
  "amount": 450.99,
  "currency": "USD",
 "testCard": "pm_card_visa"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Payment intent created successfully",
  "data": {
    "paymentIntentId": "pi_1234567890",
    "clientSecret": "pi_1234567890_secret_xyz",
    "status": "requires_payment_method",
    "amount": 450.99,
    "currency": "usd"
  },
  "error": null,
  "meta": null
}
```

### 2. Payment Confirmation via Webhook
Payment confirmation is handled automatically and securely via Stripe webhooks. After the user completes payment using Stripe.js on the frontend, Stripe sends a webhook event (such as `payment_intent.succeeded`) to the backend at `/payment/webhook`.

The backend verifies the event using the `STRIPE_WEBHOOK_SECRET` and updates the booking/payment status accordingly. The frontend does **not** need to call a confirm endpoint after payment. Instead, it should poll or query the backend for payment/booking status:

- Use `GET /payment/status/{bookingId}` to check if the payment was successful and the booking is confirmed.

**Note:**
If you need to test or debug webhooks, see the section below on Webhook Security & Configuration.

### 3. Get Payment Status
**Endpoint**: `GET /payment/status/{bookingId}`
**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
```

**Response**:
```json
{
  "success": true,
  "message": "Payment status retrieved successfully",
  "data": {
    "bookingId": "BOOKING_ID",
    "paymentStatus": "completed",
    "bookingStatus": "confirmed",
    "paymentIntentId": "pi_1234567890",
    "stripeStatus": "succeeded",
    "paymentCompletedAt": "2025-01-27T10:30:00.000Z"
  },
  "error": null,
  "meta": null
}
```
**WEBHOOK**
```json

POST /payments/webhook
Headers{
Stripe-Signature: <stripe-signature-header>
Content-Type: application/json
}
Body{
{
  "id": "evt_1ABC...",
  "object": "event",
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_1DEF...",
      "object": "payment_intent",
      "status": "succeeded",
      "amount": 12000,
      "currency": "usd",
      "metadata": {
        "bookingId": "6642ff2e46ba34124a9f26b1",
        "bookingRef": "FBX123456"
      }
    }
  }
}
}
Response {
  "received": true
}
Error Response{
  "statusCode": 404,
  "message": "Booking not found"
}


```
**payment-status**
```json
GET /payments/status/:bookingId

 Response Example{
  "bookingId": "6642ff2e46ba34124a9f26b1",
  "paymentStatus": "completed",
  "bookingStatus": "confirmed",
  "paymentIntentId": "pi_1DEF...",
  "stripeStatus": "succeeded",
  "paymentCompletedAt": "2025-06-04T14:23:00.123Z"
}
Error Response
{
  "statusCode": 404,
  "message": "Booking not found"
}

###Test Card Payment (Development Only)
**Endpoint**: `POST /payment/test-card-payment`
**Headers**:
```
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json
```

**Request Body**:
```json
{
  "bookingId": "68501080b59da4cdf4293e53",
  "amount": 1500,
  "currency": "USD",
  "testCard": "pm_card_visa"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Test payment processed successfully",
  "data": {
    "paymentStatus": "completed",
    "bookingStatus": "confirmed",
    "stripeStatus": "succeeded",
    "booking": {
      "_id": "68501080b59da4cdf4293e53",
      "paymentStatus": "completed",
      "status": "confirmed"
      // ... other booking fields
    }
  },
  "error": null,
  "meta": null
}
```

**Available Test Cards**:
| Test Card ID | Description | Result |
|--------------|-------------|---------|
| `pm_card_visa` | Regular Visa | Always succeeds |
| `pm_card_visa_chargeDeclined` | Declined Visa | Always fails |
| `pm_card_visa_authenticationRequired` | 3D Secure Visa | Requires authentication |

**Note**: This endpoint is only available in development/sandbox environments and should not be exposed in production.
```
## Testing Flow

### Step 1: Login and Get JWT Token
1. Use your existing login endpoint to get a JWT token
2. Save this token for use in subsequent requests

### Step 2: Create a Booking
1. Use the booking endpoint to create a new booking
2. Note the `bookingId` from the response
3. Verify the booking status is "pending" and paymentStatus is "pending"

### Step 3: Create Payment Intent
1. Use the `bookingId` from Step 2
2. Ensure the `amount` matches the `totalPrice` from the booking
3. Note the `paymentIntentId` and `clientSecret` from the response

### Step 4: Simulate Payment Completion
Since this is a test environment, you can use Stripe's test payment methods:
- **Success**: Use payment method `pm_card_visa`
- **Decline**: Use payment method `pm_card_visa_debit`

### Step 5: Confirm Payment
1. Use the `paymentIntentId` from Step 3
2. Use the same `bookingId` from Step 2
3. Check if the response shows success

### Step 6: Verify Payment Status
1. Use the payment status endpoint with the `bookingId`
2. Verify the payment and booking statuses are updated correctly



## Stripe Test Cards
For testing purposes, you can use these test card numbers:
- **Visa**: 4242424242424242
- **Visa (debit)**: 4000056655665556
- **Mastercard**: 5555555555554444
- **American Express**: 378282246310005
- **Declined**: 4000000000000002

