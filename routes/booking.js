import { Router } from "express";
import { bookingCollection, servicesCollection } from "../lib/db.js";
import { HttpError } from "../lib/httpError.js";
import { ObjectId } from "mongodb";
import { verifyToken } from "../middleware/verifyToken.js";
import { verifyCustomer, verifyVendor } from "../middleware/verifyRole.js";

const router = Router();

router.get("/", verifyToken, async (req, res) => {
    const userId = req.user._id.toString();
    const role = req.user.userRole || req.user.role;

    const query = {};
    if (req.query.customerId) {
        const customerId = String(req.query.customerId);
        if (customerId !== userId && role !== "admin") {
            throw new HttpError(403, "Unauthorized to view this booking.");
        }
        query.customerId = customerId;
    }
    if (req.query.vendorId) {
        const vendorId = String(req.query.vendorId);
        if (vendorId !== userId && role !== "admin") {
            throw new HttpError(403, "Unauthorized to view this booking.");
        }
        query.vendorId = vendorId;
    }
    if (!Object.keys(query).length > 0 && role !== "admin") {
        throw new HttpError(403, "You are not authorized to view bookings.");
    }
    const result = await bookingCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

    res.json({
        success: true,
        data: result,
    });
});

router.get("/count", verifyToken, async (req, res) => {
    const query = {};
    const customerId = req.query.customerId;
    if (customerId) {
        query.customerId = String(customerId);
    }
    const count = await bookingCollection.countDocuments(query);
    res.send({ success: true, data: { count } });
});

router.post("/", verifyToken, verifyCustomer, async (req, res, next) => {
    try {
        const {
            serviceId,
            eventDate,
            eventLocation,
            message,
        } = req.body;

        if (!serviceId || !eventDate || !eventLocation) {
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

        const customerId = req.user._id.toString();
        const vendorId = String(service.vendorId);
        if (vendorId === customerId) {
            throw new HttpError(403, "You cannot book your own service.");
        }

        const parsedEventDate = new Date(eventDate);
        if (Number.isNaN(parsedEventDate.getTime())) {
            throw new HttpError(400, "Invalid event date.");
        }
        const normalizedEventDate = parsedEventDate.toISOString().slice(0, 10);
        const activeKey = `${customerId}:${serviceId}:${normalizedEventDate}`;

        const existingBooking = await bookingCollection.findOne({
            customerId,
            serviceId,
            eventDate: normalizedEventDate,
            status: { $in: ["pending", "accepted"] },
        });
        if (existingBooking) {
            throw new HttpError(409, "You already have an active request for this service and event date.");
        }

        const booking = {
            serviceId,
            serviceName: service.serviceName,
            customerName: req.user.name,
            serviceImage: service.images?.[0] ?? service.image ?? "",
            vendorId,
            price: service.price ?? 0,
            eventDate: normalizedEventDate,
            eventLocation,
            message: message || "",
            customerId,
            email: req.user.email,
            status: "pending",
            activeKey,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        let result;
        try {
            result = await bookingCollection.insertOne(booking);
        } catch (error) {
            // The unique index closes the race where two requests arrive together.
            if (error.code === 11000) {
                throw new HttpError(409, "You already have an active request for this service and event date.");
            }
            throw error;
        }

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

router.patch("/:id/accept", verifyToken, async (req, res, next) => {
    try {
        if (req.user?.userRole === "customer" ) {
            throw new HttpError(403, "Unauthorized to accept this booking.");
        }
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
        if (booking?.vendorId !== req.user._id.toString() && req.user.userRole !== "admin") {
            throw new HttpError(403, "Unauthorized to accept this booking.");
        }
        if (booking.status !== "pending") {
            throw new HttpError(409, "Only pending requests can be accepted.");
        }

        await bookingCollection.updateOne(
            { _id: booking._id },
            {
                $set: {
                    status: "accepted",
                    respondedAt: new Date(),
                    updatedAt: new Date(),
                },
            },
        );

        res.json({ success: true, message: "Booking request accepted." });
    } catch (error) {
        next(error);
    }
});

router.patch("/:id/reject", verifyToken, async (req, res, next) => {
    try {
        if (req.user.userRole === "customer" ) {
            throw new HttpError(403, "Unauthorized to reject this booking.");
        }
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
        if (booking?.vendorId !== req.user._id.toString() && req.user.userRole !== "admin") {
            throw new HttpError(403, "Unauthorized to reject this booking.");
        }
        if (booking.status !== "pending") {
            throw new HttpError(409, "Only pending requests can be rejected.");
        }

        await bookingCollection.updateOne(
            { _id: booking._id },
            {
                $set: {
                    status: "rejected",
                    respondedAt: new Date(),
                    updatedAt: new Date(),
                },
                $unset: { activeKey: "" },
            },
        );

        res.json({ success: true, message: "Booking request rejected." });
    } catch (error) {
        next(error);
    }
});

router.patch("/:id/cancel", verifyToken, verifyCustomer, async (req, res, next) => {
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
        if (booking?.customerId !== req.user._id.toString() && req.user.userRole !== "admin") {
            throw new HttpError(403, "Unauthorized to cancel this booking.");
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
                $unset: { activeKey: "" },
            },
        );

        res.json({ success: true, message: "Booking request cancelled." });
    } catch (error) {
        next(error);
    }
});

export default router;
