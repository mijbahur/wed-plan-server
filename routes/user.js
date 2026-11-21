import { Router } from "express";
import { userCollection } from "../lib/db.js";
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

export default router;