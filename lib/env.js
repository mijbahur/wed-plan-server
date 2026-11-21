import dotenv from "dotenv";

dotenv.config({ quiet: true });


const PORT = Number(process.env.PORT) || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "";
const DB_NAME = process.env.DB_NAME || "wed-plan-db";
const IMGBB_API_KEY = process.env.IMGBB_API_KEY || "";
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";

export const env = {
  PORT,
  MONGODB_URI,
  DB_NAME,
  IMGBB_API_KEY,
  STRIPE_SECRET_KEY,
};