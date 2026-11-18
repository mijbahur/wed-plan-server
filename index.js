import express from "express";
import cors from "cors";
import { env } from "./lib/env.js";
import { connectToMongoDB } from "./lib/db.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello, World!");
});

const db = await connectToMongoDB();

app.listen(env.PORT, () => {
  console.log(`Server is running on port ${env.PORT}`);
});