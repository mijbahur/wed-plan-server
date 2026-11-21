import { Router } from "express";
import { bookingCollection } from "../lib/db.js";
import { HttpError } from "../lib/httpError.js";
import { ObjectId } from "mongodb";

const router = Router();
router.get("/", async (req, res) => {
    const query = {};

    if (req.query.customerId) {
        query.customerId = req.query.customerId;
    }
    if (req.query.serviceId) {
        // query.serviceId = req.query.serviceId; 
        const serviceQuery = { _id: new ObjectId(req.query.serviceId) };
        const service = await servicesCollection.findOne(serviceQuery);
        if (service.vendorId !== req.user?._id.toString() && req.user?.role !== "admin") {
            throw new HttpError(403, "Forbidden");
        }
        query.serviceId = req.query.serviceId;
    }

    const cursor = bookingCollection.find(query);
    const result = await cursor.toArray();
    res.json({ success: true, data: result });
});



router.get("/count", async (req, res) => {
    console.log("Booking count request received:", req.query);
    const query = {}
    const customerId = req.query.customerId;
    if (customerId) {
        query.customerId = String(customerId);
    }
    const count = await bookingCollection.countDocuments(query);
    res.send({ success: true, data: { count } });
});

router.post("/", async (req, res, next) => {
    console.log("Booking request received:", req.body);
    try {
        const {
            serviceId,
            serviceName,
            serviceImage,
            eventDate,
            eventLocation,
            message,
            customerId,
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
            customerId,
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

router.patch("/:id/cancel", async (req, res, next) => {
    try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
            throw new HttpError(400, "Invalid booking ID.");
        }

        const booking = await bookingCollection.findOne({
            _id: new ObjectId(id),
        });

        if (!booking) {
            throw new HttpError(404, "Booking not found.");
        }

        if (booking.status !== "pending") {
            throw new HttpError(409, "Only pending requests can be cancelled.");
        }

        await bookingCollection.updateOne(
            { _id: booking._id },
            {
                $set: {
                    status: "cancelled",
                    cancelReason: req.body?.cancelReason ?? "",
                    updatedAt: new Date(),
                },
            },
        );

        res.json({ success: true, message: "Booking request cancelled." });
    } catch (error) {
        next(error);
    }
});

export default router;
