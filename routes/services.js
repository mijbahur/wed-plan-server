import { Router } from "express";
import { servicesCollection } from "../lib/db.js";

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
        const cursor = servicesCollection.find();
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
export default router;
