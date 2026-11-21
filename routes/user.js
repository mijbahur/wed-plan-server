import { Router } from "express";
import { db, userCollection } from "../lib/db.js";
import { HttpError } from "../lib/httpError.js";
import { ObjectId } from "mongodb";

const router = Router();

router.get("/", async (req, res) => { 
    const cursor = userCollection.find({});
    const users = await cursor.toArray();
    res.send({ success: true, users });
})

router.get("/:id/premium", async (req, res) => {
    const { id } = req.params;
    const user = await userCollection.findOne({ _id: new ObjectId(id) }, { projection: { isPremium: 1 } });
    if (!user) {
        throw new HttpError(404, "User not found");
    }
    res.send({ success: true, isPremium: user.isPremium, userId: id });
});

router.patch("/:id/role", async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!ObjectId.isValid(id)) {
        throw new HttpError(400, "Invalid user ID.");
    }

    if (!role) {
        throw new HttpError(400, "Please provide a role.");
    }

    const query = { _id: new ObjectId(id) };
    const updateDoc = { $set: { role } };

    const updatedUser = await userCollection.updateOne(query, updateDoc);

    if (updatedUser.modifiedCount === 0) {
        throw new HttpError(400, "Failed to update user.");
    }

    res.status(200).json({
        success: true,
        message: "User role updated successfully.",
        data: updatedUser,
    });
});

router.patch("/:id/block", async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isBlocked } = req.body;

        if (!ObjectId.isValid(id)) {
            throw new HttpError(400, "Invalid user ID.");
        }
        if (typeof isBlocked !== "boolean") {
            throw new HttpError(400, "isBlocked must be true or false.");
        }

        const query = { _id: new ObjectId(id) };
        const updatedUser = await userCollection.updateOne(
            query,
            {
                $set: {
                    isBlocked,
                    updatedAt: new Date(),
                },
            },
        );

        if (updatedUser.matchedCount === 0) {
            throw new HttpError(404, "User not found.");
        }

        if (isBlocked) {
            await db.collection("session").deleteMany({ userId: id });
        }

        res.status(200).json({
            success: true,
            message: isBlocked
                ? "User blocked successfully."
                : "User unblocked successfully.",
        });
    } catch (error) {
        next(error);
    }
});

export default router;