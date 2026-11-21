import { Router } from "express";
import { bookingCollection, servicesCollection } from "../lib/db.js";
import { HttpError } from "../lib/httpError.js";
import { ObjectId } from "mongodb";

const router = Router();
router.get("/", async (req, res) => {
    const query = {};
    console.log("Booking query parameters received:", req.query);

    if (req.query.customerId) {
        query.customerId = req.query.customerId;
    }
    if (req.query.vendorId) {
        const vendorId = String(req.query.vendorId);
        const vendorServices = await servicesCollection
            .find({ vendorId })
            .project({ _id: 1 })
            .toArray();
        const serviceIds = vendorServices.map((service) => service._id.toString());

        query.$or = [
            { vendorId },
            { serviceId: { $in: serviceIds } },
        ];
    }
    if (req.query.serviceId) {
        console.log("Service ID query parameter received:", req.query.serviceId);
        if (!ObjectId.isValid(req.query.serviceId)) {
            throw new HttpError(400, "Invalid service ID.");
        }
        const serviceQuery = { _id: new ObjectId(req.query.serviceId) };
        const service = await servicesCollection.findOne(serviceQuery);
        console.log("Service fetched from database:", service);
        if (!service) {
            throw new HttpError(404, "Service not found.");
        }
        query.serviceId = req.query.serviceId;
    }

    console.log("Final query for fetching bookings:", query);
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
            customerName,
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

        const service = await servicesCollection.findOne({
            _id: new ObjectId(serviceId),
        });
        if (!service) {
            throw new HttpError(404, "Service not found.");
        }

        const booking = {
            serviceId,
            serviceName,
            customerName,
            serviceImage: serviceImage ?? "",
            vendorId: service.vendorId ?? null,
            price: service.price ?? 0,
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

router.patch("/:id/accept", async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            throw new HttpError(400, "Invalid booking ID.");
        }

        const booking = await bookingCollection.findOne({ _id: new ObjectId(id) });
        if (!booking) {
            throw new HttpError(404, "Booking not found.");
        }
        if (booking.status !== "pending") {
            throw new HttpError(409, "Only pending requests can be accepted.");
        }

        await bookingCollection.updateOne(
            { _id: booking._id },
            { $set: { status: "accepted", respondedAt: new Date(), updatedAt: new Date() } },
        );

        res.json({ success: true, message: "Booking request accepted." });
    } catch (error) {
        next(error);
    }
});

router.patch("/:id/reject", async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            throw new HttpError(400, "Invalid booking ID.");
        }

        const booking = await bookingCollection.findOne({ _id: new ObjectId(id) });
        if (!booking) {
            throw new HttpError(404, "Booking not found.");
        }
        if (booking.status !== "pending") {
            throw new HttpError(409, "Only pending requests can be rejected.");
        }

        await bookingCollection.updateOne(
            { _id: booking._id },
            { $set: { status: "rejected", respondedAt: new Date(), updatedAt: new Date() } },
        );

        res.json({ success: true, message: "Booking request rejected." });
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
