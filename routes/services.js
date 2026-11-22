import { Router } from "express";
import { servicesCollection } from "../lib/db.js";
import { ObjectId } from "mongodb";
import { HttpError } from "../lib/httpError.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { verifyAdmin } from "../middleware/verifyRole.js";

const router = Router();

router.post("/", verifyToken, async (req, res) => {
    try {
        const { serviceName, category, description, price, location, images } =
            req.body;

        // Basic validation
        if (
            !serviceName ||
            !category ||
            !description ||
            price == null ||
            !location ||
            !Array.isArray(images)
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide all required service information.",
            });
        }
        if (!req.user?.userRole || req.user.userRole === "customer") {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
            });
        }

        // Create service document
        const service = {
            vendorId: req.user?._id.toString() ?? req.body.vendorId ?? null,
            serviceName,
            category,
            description,
            price,
            location,
            images,

            // Additional fields
            status: "pending",
            isActive: false,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        const result = await servicesCollection.insertOne(service);

        res.status(201).json({
            success: true,
            message: "Service created successfully!",
            data: {
                _id: result.insertedId,
                ...service,
            },
        });
    } catch (error) {
        console.error("Error creating service:", error);

        res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
});

router.get("/", async (req, res) => {
    try {
        const query = {};
        if (req.query) {
            if (req.query.vendorId) {
                query.vendorId = req.query.vendorId;
            }
            if (req.query.category) {
                query.category = req.query.category;
            }
            if (req.query.location) {
                query.location = { $regex: req.query.location, $options: "i" };
            }
            if (req.query.status) {
                query.status = req.query.status;
            }
            if (req.query.isActive) {
                query.isActive = req.query.isActive === "true";
            }
            if (req.query.minPrice) {
                query.price = {
                    ...query.price,
                    $gte: parseFloat(req.query.minPrice),
                };
            }
            if (req.query.maxPrice) {
                query.price = {
                    ...query.price,
                    $lte: parseFloat(req.query.maxPrice),
                };
            }

            if (req.query.search) {
                query.$or = [
                    {
                        serviceName: {
                            $regex: req.query.search,
                            $options: "i",
                        },
                    },
                    { location: { $regex: req.query.search, $options: "i" } },
                    {
                        description: {
                            $regex: req.query.search,
                            $options: "i",
                        },
                    },
                ];
            }
        }
        const cursor = servicesCollection.find(query);
        const services = await cursor.toArray();
        res.send(services);
    } catch (error) {
        console.error("Error fetching services:", error);
        res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
});

router.get("/count", async (req, res) => {
    const query = {};
    if (req.query.vendorId) {
        query.vendorId = req.query.vendorId;
    }
    if (req.query.category) {
        query.category = req.query.category;
    }
    if (req.query.location) {
        query.location = { $regex: req.query.location, $options: "i" };
    }
    if (req.query.status) {
        query.status = req.query.status;
    }
    if (req.query.isActive) {
        query.isActive = req.query.isActive === "true";
    }
    const count = await servicesCollection.countDocuments(query);
    res.send({ success: true, data: { count } });
});

router.get("/:id", async (req, res) => {
    const serviceId = req.params.id;

    if (!ObjectId.isValid(serviceId)) {
        throw new HttpError(400, "Invalid service ID.");
    }

    const service = await servicesCollection.findOne({
        _id: new ObjectId(serviceId),
    });

    if (!service) {
        throw new HttpError(404, "Service not found.");
    }

    res.status(200).json({
        success: true,
        message: "Service fetched successfully.",
        data: service,
    });
});

router.patch("/:id", verifyToken, async (req, res) => {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
        throw new HttpError(400, "Invalid service ID.");
    }

    const query = { _id: new ObjectId(id) };
    const service = await servicesCollection.findOne(query);

    if (!service) {
        throw new HttpError(404, "Service not found.");
    }
    if (service.vendorId !== req.user?._id.toString() && req.user?.role !== "admin") {
        throw new HttpError(403, "You are not authorized to update this service.");
    }

    let updateFields = {};
    if (Object.prototype.hasOwnProperty.call(req.body, "status")) {
        const isActive =
            req.body.status === true ||
            req.body.status === "true";
        updateFields = { isActive };
    } else {
        const allowedFields = [
            "serviceName",
            "category",
            "price",
            "location",
            "description",
            "images",
        ];
        updateFields = {};
        for (const field of allowedFields) {
            if (Object.prototype.hasOwnProperty.call(req.body, field)) {
                updateFields[field] = req.body[field];
            }
        }
        updateFields.status = "pending";
        updateFields.isActive = false;
        updateFields.updatedAt = new Date();
    }

    const updateDoc = { $set: updateFields };

    const updatedService = await servicesCollection.updateOne(query, updateDoc);

    if (updatedService.modifiedCount === 0) {
        throw new HttpError(400, "Failed to update service.");
    }

    res.status(200).json({
        success: true,
        message: "Service updated successfully.",
        data: updatedService,
    });
});

router.patch("/:id/accept", verifyToken, verifyAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            throw new HttpError(400, "Invalid Service ID.");
        }

        const service = await servicesCollection.findOne({ _id: new ObjectId(id) });
        if (!service) {
            throw new HttpError(404, "Service not found.");
        }
        if (service.status !== "pending") {
            throw new HttpError(409, "Only pending requests can be accepted.");
        }

        await servicesCollection.updateOne(
            { _id: service._id },
            { $set: { status: "approved", isActive: true, respondedAt: new Date(), updatedAt: new Date() } },
        );

        res.json({ success: true, message: "Service request accepted." });
    } catch (error) {
        next(error);
    }
}); 
router.patch("/:id/reject",verifyToken, verifyAdmin, async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
            throw new HttpError(400, "Invalid Service ID.");
        }

        const service = await servicesCollection.findOne({ _id: new ObjectId(id) });
        if (!service) {
            throw new HttpError(404, "Service not found.");
        }
        if (service.status !== "pending") {
            throw new HttpError(409, "Only pending requests can be rejected.");
        }

        await servicesCollection.updateOne(
            { _id: service._id },
            { $set: { status: "rejected", isActive: false, respondedAt: new Date(), updatedAt: new Date() } },
        );

        res.json({ success: true, message: "Service request rejected." });
    } catch (error) {
        next(error);
    }
});

router.delete("/:id", verifyToken, async (req, res, next) => {
    try {
        const serviceId = req.params.id;

        if (!ObjectId.isValid(serviceId)) {
            throw new HttpError(400, "Invalid service ID.");
        }
        const service = await servicesCollection.findOne({
            _id: new ObjectId(serviceId),
        });

        if (!service) {
            throw new HttpError(404, "Service not found.");
        }

        if (service.vendorId !== req.user?._id.toString() && req.user?.role !== "admin") {
            throw new HttpError(403, "Unauthorized to delete this service.");
        }

        const result = await servicesCollection.deleteOne({
            _id: new ObjectId(serviceId),
        });

        if (result.deletedCount === 0) {
            throw new HttpError(404, "Service not found.");
        }

        res.status(200).json({
            success: true,
            message: "Service deleted successfully.",
        });
    } catch (error) {
        next(error);
    }
});
export default router;
