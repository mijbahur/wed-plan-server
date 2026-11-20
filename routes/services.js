import { Router } from "express";
import { servicesCollection } from "../lib/db.js";
import { ObjectId } from "mongodb";
import { HttpError } from "../lib/httpError.js";

const router = Router();

router.post("/", async (req, res) => {
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

        // Create service document
        const service = {
            serviceName,
            category,
            description,
            price,
            location,
            images,

            // Additional fields
            vendorId: req.user?.id ?? null,
            status: "pending",
            isActive: true,
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

router.delete("/:id", async (req, res, next) => {
    try {
        const serviceId = req.params.id;

        if (!ObjectId.isValid(serviceId)) {
            throw new HttpError(400, "Invalid service ID.");
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
