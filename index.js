import express from "express";
import cors from "cors";
import { env } from "./lib/env.js";
import { connectToMongoDB } from "./lib/db.js";
import bookingRouter from "./routes/booking.js";
import uploadsRouter from "./routes/uploads.js";
import servicesRouter from "./routes/services.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

app.use("/api/bookings", bookingRouter);
app.use("/api/uploads", uploadsRouter);
app.use("/api/services", servicesRouter);
await connectToMongoDB();

app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});