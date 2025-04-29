# DevTinder Backend

Backend server for the DevTinder application.

## Setup

1. Install dependencies

```
npm install
```

2. Environment Variables
   Copy the `.env.example` file to `.env` and update the values with your actual credentials:

```
cp .env.example .env
```

Required environment variables:

- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Secret key for JWT token generation and verification
- `PORT`: Server port (default: 7777)
- `CLIENT_ORIGIN`: Frontend URL for CORS configuration

3. Start the server

```
npm run dev    # Development mode
npm start      # Production mode
```

## API Routes

- `/signup` - Register a new user
- `/login` - Login a user
- `/logout` - Logout a user

Additional routes require authentication.
