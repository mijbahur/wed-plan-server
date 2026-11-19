import { MongoClient } from "mongodb";
import { env } from "./env.js";

export const client = new MongoClient(env.MONGODB_URI);
export const db = client.db(env.DB_NAME);

export const bookingCollection = db.collection("bookings");


export async function connectToMongoDB() {
  if (!env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  await client.connect();
  console.log(`Connected to MongoDB database "${db.databaseName}"`);
  return db;
}