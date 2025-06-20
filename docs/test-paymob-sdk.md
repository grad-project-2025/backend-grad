# Paymob SDK Integration Testing Guide

This guide provides step-by-step instructions for testing the new Paymob SDK integration endpoints.

## Prerequisites

1. **Backend Running**: Ensure your NestJS backend is running on `http://localhost:3001`
2. **Valid JWT Token**: You need a valid JWT token for authentication
3. **Valid Booking ID**: You need a booking ID that exists in your database
4. **Environment Variables**: Ensure all Paymob environment variables are set

## Required Environment Variables

```env
PAYMOB_API_KEY=your_paymob_api_key
PAYMOB_MERCHANT_ID=your_merchant_id
PAYMOB_HMAC_SECRET=your_hmac_secret
PAYMOB_CARD_INTEGRATION_ID=your_card_integration_id
```

## Testing Steps

### Step 1: Create Payment Key for SDK

**Endpoint**: `POST /payment/paymob/create-payment-key`

**cURL Command**:
```bash
curl -X POST http://localhost:3001/payment/paymob/create-payment-key \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "YOUR_BOOKING_ID",
    "mobileNumber": "+201234567890",
    "email": "test@example.com"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "paymentKey": "ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5...",
  "integrationId": "123456",
  "orderId": 1234567890,
  "amountCents": 10000,
  "currency": "EGP",
  "expiresAt": "2025-06-07T09:25:30.123Z",
  "merchantOrderId": "YOUR_BOOKING_ID"
}
```

**Validation Checklist**:
- [ ] Status code is 201
- [ ] Response contains `paymentKey`
- [ ] Response contains `integrationId`
- [ ] Response contains `orderId`
- [ ] Response contains `amountCents`
- [ ] Currency is "EGP"
- [ ] `expiresAt` is a future date
- [ ] `merchantOrderId` matches the booking ID

### Step 2: Get Payment Status

**Endpoint**: `GET /payment/paymob/status/:bookingId`

**cURL Command**:
```bash
curl -X GET http://localhost:3000/payment/paymob/status/YOUR_BOOKING_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response**:
```json
{
  "success": true,
  "paymentStatus": "pending",
  "paymentKey": "ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5...",
  "integrationId": "123456",
  "orderId": 1234567890,
  "amount": 100.00,
  "currency": "EGP",
  "expiresAt": "2025-06-07T09:25:30.123Z",
  "createdAt": "2025-06-07T08:25:30.123Z",
  "transactionId": null
}
```

**Validation Checklist**:
- [ ] Status code is 200
- [ ] Payment status is "pending"
- [ ] All payment details are present
- [ ] `transactionId` is null (before payment completion)

### Step 3: Verify Payment (Simulate SDK Completion)

**Endpoint**: `POST /payment/paymob/verify-payment`

**cURL Command**:
```bash
curl -X POST http://localhost:3001/payment/paymob/verify-payment \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "YOUR_BOOKING_ID",
    "transactionId": "test_transaction_123"
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "paymentStatus": "pending",
  "transactionId": null,
  "amount": 100.00,
  "currency": "EGP",
  "paidAt": null,
  "metadata": {
    "paymobOrderId": 1234567890,
    "integrationId": "123456",
    "expiresAt": "2025-06-07T09:25:30.123Z"
  }
}
```

**Validation Checklist**:
- [ ] Status code is 200
- [ ] Response contains payment details
- [ ] Metadata includes Paymob order information

## Error Testing

### Test Invalid Booking ID

```bash
curl -X POST http://localhost:3001/payment/paymob/create-payment-key \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "invalid_booking_id",
    "mobileNumber": "+201234567890",
    "email": "test@example.com"
  }'
```

**Expected**: 404 Not Found

### Test Unauthorized Access

```bash
curl -X GET http://localhost:3001/payment/paymob/status/YOUR_BOOKING_ID
```

**Expected**: 401 Unauthorized

### Test Invalid JWT Token

```bash
curl -X POST http://localhost:3001/payment/paymob/create-payment-key \
  -H "Authorization: Bearer invalid_token" \
  -H "Content-Type: application/json" \
  -d '{
    "bookingId": "YOUR_BOOKING_ID",
    "mobileNumber": "+201234567890",
    "email": "test@example.com"
  }'
```

**Expected**: 401 Unauthorized

## Integration with Flutter SDK

After successful backend testing, use the payment data in your Flutter app:

```dart
// Use the paymentKey from Step 1 response
PaymobResponse? response = await PaymobPayment.instance.pay(
  context: context,
  currency: "EGP",
  amountInCents: 10000, // From response
  paymentToken: "ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5...", // From response
);

// After SDK completion, verify with backend using Step 3
```

## Troubleshooting

### Common Issues

1. **Environment Variables Not Set**: Ensure all Paymob environment variables are configured
2. **Invalid Booking ID**: Make sure the booking exists and belongs to the authenticated user
3. **Expired JWT Token**: Refresh your authentication token
4. **Network Issues**: Check if the backend is running and accessible

### Debug Logs

Check the backend logs for detailed error messages:
```bash
# If using npm/yarn
npm run start:dev

# If using bun
bun run start:dev
```

Look for logs from `PaymobService` and `PaymentController` for debugging information.
