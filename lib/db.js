import { MongoClient } from "mongodb";
import { env } from "./env.js";

export const client = new MongoClient(env.MONGODB_URI);
export const db = client.db(env.DB_NAME);

export const bookingCollection = db.collection("bookings");
export const servicesCollection = db.collection("services");
export const transactionsCollection = db.collection("transactions");
export const userCollection = db.collection("user");
export const sessionsCollection = db.collection("session");

export async function connectToMongoDB() {
  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  await client.connect();
  // One transaction per Stripe Checkout Session, including concurrent retries.
  await transactionsCollection.createIndex(
    { stripeSessionId: 1 },
    { unique: true, sparse: true },
  );
  console.log(`Connected to MongoDB database "${db.databaseName}"`);
  return db;
}
