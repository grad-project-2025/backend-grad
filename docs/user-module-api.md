
## Authentication Endpoints

### 1. Register User
**POST** `/users/register`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123!@",
  "firstName": "Ahmed",
  "lastName": "Mohamed",
  "phoneNumber": "+201234567890",
  "country": "Egypt",
  "birthdate": "1990-01-01"
}
```

**Validation Rules:**
- `email`: Valid email format, required
- `password`: Minimum 10 characters, must contain 1 uppercase, 1 lowercase, 1 number, 1 symbol
- `firstName`: Minimum 3 characters, required
- `lastName`: Minimum 3 characters, required
- `phoneNumber`: Valid international format (optional)
- `country`: Valid country name or ISO code (optional)
- `birthdate`: Date string (optional)

**Response (201):**
```json
{
  "success": true,
  "data": {
    "message": "User registered successfully",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "Ahmed",
      "lastName": "Mohamed",
      "email": "user@example.com",
      "country": "Egypt",
      "phoneNumber": "+201234567890",
      "isVerified": false,
      "birthdate": "1990-01-01"
    }
  }
}
```

### 2. Login User
**POST** `/users/login`

Authenticate user and receive access/refresh tokens.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password123!@"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "User logged in successfully",
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4="
  }
}
```

**Token Information:**
- `accessToken`: Valid for 15 minutes
- `refreshToken`: Valid for 7 days

### 3. Refresh Token
**POST** `/users/refresh-token`
**Authentication:** Required

Refresh expired access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "your-refresh-token-here"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4="
  }
}
```

### 4. Logout
**POST** `/users/logout`
**Authentication:** Required

Logout user and invalidate refresh token.

**Request Body:**
```json
{
  "refreshToken": "your-refresh-token-here"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "User logged out successfully"
  }
}
```

---

## Email Verification

### 5. Verify Email
**POST** `/users/verify-email`

Verify user email with verification code.

**Request Body:**
```json
{
  "email": "user@example.com",
  "code": "A1B2C3"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Email verified successfully"
  }
}
```

### 6. Resend Verification Email
**POST** `/users/resend-verification`

Resend email verification code.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Verification email sent successfully"
  }
}
```

---

## Password Management

### 7. Request Password Reset
**POST** `/users/request-reset-password`

Request password reset code via email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Password reset code sent to email"
  }
}
```

### 8. Reset Password
**POST** `/users/reset-password`

Reset password using reset code.

**Request Body:**
```json
{
  "code": "ABC12",
  "newPassword": "NewPassword123!@"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Password reset successfully"
  }
}
```

### 9. Change Password
**PUT** `/users/change-password`
**Authentication:** Required

Change password for authenticated user.

**Request Body:**
```json
{
  "oldPassword": "OldPassword123!@",
  "newPassword": "NewPassword123!@"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully"
  }
}
```

---

## Profile Management

### 10. Get User Profile
**GET** `/users/profile`
**Authentication:** Required

Get current user's profile information.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "User profile retrieved successfully",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "Ahmed",
      "lastName": "Mohamed",
      "email": "user@example.com",
      "country": "Egypt",
      "phoneNumber": "+201234567890",
      "isVerified": true,
      "birthdate": "1990-01-01",
      "roles": ["user"],
      "gender": "male",
      "preferredLanguage": "en",
      "preferredAirlines": ["EgyptAir", "Emirates"],
      "deviceType": "mobile",
      "loyaltyProgram": {
        "status": "gold",
        "points": 15000
      },
      "preferredCabinClass": "economy",
      "useRecommendationSystem": true
    }
  }
}
```

### 11. Update User Profile
**PATCH** `/users/profile`
**Authentication:** Required

Update user profile information.

**Request Body (all fields optional):**
```json
{
  "firstName": "Ahmed",
  "lastName": "Mohamed",
  "phoneNumber": "+201234567890",
  "country": "Egypt",
  "birthdate": "1990-01-01",
  "gender": "male",
  "preferredLanguage": "en",
  "preferredAirlines": ["EgyptAir", "Emirates"],
  "deviceType": "mobile",
  "loyaltyProgram": {
    "status": "gold",
    "points": 15000
  },
  "preferredCabinClass": "economy",
  "useRecommendationSystem": true
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Profile updated successfully",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "Ahmed",
      "lastName": "Mohamed",
      "email": "user@example.com",
      "country": "Egypt",
      "phoneNumber": "+201234567890",
      "isVerified": true,
      "birthdate": "1990-01-01"
    }
  }
}
```

---

## Admin Endpoints

### 12. Get All Users
**GET** `/users/all`
**Authentication:** Required (Admin/Moderator only)

Get list of all users (admin/moderator access only).

**Response (200):**
```json
{
  "message": "Users retrieved successfully",
  "users": [
    {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "Ahmed",
      "lastName": "Mohamed",
      "email": "user@example.com",
      "country": "Egypt",
      "phoneNumber": "+201234567890",
      "isVerified": true,
      "birthdate": "1990-01-01",
      "roles": ["user"]
    }
  ]
}
```

### 13. Update User Roles
**PATCH** `/users/roles`
**Authentication:** Required (Admin only)

Update user roles (admin access only).

**Request Body:**
```json
{
  "email": "user@example.com",
  "roles": ["user", "mod"]
}
```

**Available Roles:**
- `user`: Regular user
- `mod`: Moderator
- `admin`: Administrator

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "User roles updated successfully",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "firstName": "Ahmed",
      "lastName": "Mohamed",
      "email": "user@example.com",
      "roles": ["user", "mod"]
    }
  }
}
```

### 14. Delete User
**DELETE** `/users/:email`
**Authentication:** Required (Admin only)

Delete user by email (admin access only).

**Response (200):**
```json
{
  "success": true,
  "message": "User deleted successfully"
}
```

### 15. Admin Dashboard
**GET** `/users/admin-dashboard`
**Authentication:** Required (Admin/Moderator only)

Access admin dashboard (admin/moderator access only).

**Response (200):**
```json
{
  "message": "Admin-only content"
}
```

### 16. Flight Management
**GET** `/users/flight-management`
**Authentication:** Required (Admin/Moderator only)

Access flight management dashboard (admin/moderator access only).

**Response (200):**
```json
{
  "message": "Flight management dashboard"
}
```



### Validation Error Examples

**Email Validation:**
```json
{
  "success": false,
  "message": "Please check the following fields",
  "errors": {
    "email": "Invalid email format"
  }
}
```

**Password Validation:**
```json
{
  "success": false,
  "message": "Please check the following fields",
  "errors": {
    "password": "Password must contain: 1 uppercase, 1 lowercase, 1 number, 1 symbol"
  }
}
```

**Authentication Errors:**
```json
{
  "success": false,
  "message": "Invalid credentials",
  "statusCode": 401
}
```

```json
{
  "success": false,
  "message": "Email not verified",
  "statusCode": 401
}
```

---

## Rate Limiting

The API implements rate limiting to prevent abuse:
- **General endpoints**: 10 requests per minute per IP
- **Authentication endpoints**: Additional restrictions may apply

When rate limit is exceeded:
```json
{
  "success": false,
  "message": "Too many requests",
  "statusCode": 429
}
```

---


