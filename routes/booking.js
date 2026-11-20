import { Router } from "express";
import { bookingCollection } from "../lib/db.js";

const router = Router();

router.get("/", async (req, res) => {
    try {
        const bookings = await bookingCollection.find().toArray();
        res.json(bookings);
    } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default router;
