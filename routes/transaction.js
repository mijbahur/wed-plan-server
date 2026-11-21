import { Router } from "express";
import { transactionsCollection, userCollection } from "../lib/db.js";
import { HttpError } from "../lib/httpError.js";
import { stripe } from "../index.js";
import { ObjectId } from "mongodb";

const router = Router();
router.post("/checkout-verify", async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId) {
        return res.send({ success: false, message: "Session ID is required" });
    }

    const { status, payment_status, customer_email, metadata, payment_intent } =
        await stripe.checkout.sessions.retrieve(sessionId);
    if (status === "complete" && payment_status === "paid") {
        const sessionQuery = { sessionId };
        const existingPayment =
            await transactionsCollection.findOne(sessionQuery);
        if (existingPayment) {
            return res.send({
                success: false,
                message: "Payment already verified",
            });
        }
        const payment = {
            sessionId,
            status,
            payment_status,
            customer_email,
            userId: metadata.userId,
            payment_date: new Date(),
            payment_intent,
        };

        const result = await transactionsCollection.insertOne(payment);

        const query = { _id: new ObjectId(metadata.userId) };

        const updatedDoc = {
            $set: {
                isPremium: true,
            },
        };
        const updateResult = await userCollection.updateOne(query, updatedDoc);
        res.send({ success: true, result, updateResult });
        return;
    }
    res.send({ success: false, message: "Payment verification failed" });
});

router.get("/", async (req, res) => {
    res.send({ success: true, message: "Transaction route is working!" });
});

export default router;
