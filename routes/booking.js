import { Router } from "express";
import { bookingCollection } from "../lib/db.js";
import { ObjectId } from "mongodb";

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

router.post("/", async (req, res, next) => {
    try {
        const {
            serviceId,
            serviceName,
            serviceImage,
            eventDate,
            eventLocation,
            message,
            userId,
            email,
        } = req.body;

        if (!serviceId || !serviceName || !eventDate || !eventLocation) {
            throw new HttpError(
                400,
                "Please provide all required booking fields.",
            );
        }

        if (!ObjectId.isValid(serviceId)) {
            throw new HttpError(400, "Invalid service ID.");
        }

        const booking = {
            serviceId,
            serviceName,
            serviceImage: serviceImage ?? "",
            eventDate,
            eventLocation,
            message: message || "",
            userId,
            email,
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await bookingCollection.insertOne(booking);

        res.status(201).json({
            success: true,
            message: "Booking created successfully!",
            data: {
                _id: result.insertedId,
                ...booking,
            },
        });
    } catch (error) {
        next(error);
    }
});

export default router;
