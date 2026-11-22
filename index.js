
import express from "express";
import cors from "cors";
import Stripe from "stripe";

export const stripe = new Stripe(env.STRIPE_SECRET_KEY);
 
import { env } from "./lib/env.js";
import { connectToMongoDB } from "./lib/db.js";

import userRouter from "./routes/user.js";
import bookingRouter from "./routes/booking.js";
import uploadsRouter from "./routes/uploads.js";
import servicesRouter from "./routes/services.js";
import transactionRouter from "./routes/transaction.js";

import {
    notFound,
    errorHandler,
} from "./middleware/errorHandler.js";

const app = express();

// Global middleware
app.use(cors());
app.use(express.json());

// Home route
app.get("/", (req, res) => {
    res.send("Wedding Planner API is running.");
});

// API routes
app.use("/api/users", userRouter);
app.use("/api/bookings", bookingRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/services", servicesRouter);
app.use("/api/transactions", transactionRouter);

// 404 handler (unknown routes)
app.use(notFound);

// Global error handler (must be last)
app.use(errorHandler);

// Connect to MongoDB before starting the server
await connectToMongoDB();

app.listen(env.PORT, () => {
    console.log(`Server is running on port ${env.PORT}`);
});

export default app;