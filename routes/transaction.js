import { Router } from "express";
import { transactionsCollection } from "../lib/db.js";
import { HttpError } from "../lib/httpError.js";
import { stripe } from "../index.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { verifyAdmin, verifyVendor } from "../middleware/verifyRole.js";

const router = Router();
router.post("/checkout-verify", verifyToken, verifyVendor, async (req, res) => {
    const { sessionId } = req.body;

    if (typeof sessionId !== "string" || !sessionId.startsWith("cs_")) {
        throw new HttpError(400, "A valid Stripe session ID is required.");
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const userId = String(req.user._id);

    // The session must have been created for the signed-in user.
    if (session.metadata?.userId !== userId) {
        throw new HttpError(403, "This checkout session does not belong to you.");
    }

    if (session.status !== "complete" || session.payment_status !== "paid") {
        return res.status(409).send({
            success: false,
            message: "Payment is not complete yet.",
        });
    }

    const existingPayment = await transactionsCollection.findOne({ stripeSessionId: session.id });
    if (existingPayment) {
        if (String(existingPayment.vendorId) !== userId) {
            throw new HttpError(403, "This checkout session does not belong to you.");
        }
        return res.send({ success: true, alreadyVerified: true, transaction: existingPayment });
    }

    if (!Number.isInteger(session.amount_total) || !session.currency) {
        throw new HttpError(400, "Stripe did not return a valid amount and currency.");
    }

    const now = new Date();
    const transaction = {
        stripeSessionId: session.id,
        vendorId: req.user._id,
        vendorName: req.user.name,
        vendorEmail: req.user.email,
        plan: "premium",
        amount: session.amount_total/100, // Stripe amount in the currency's smallest unit (for example, cents).
        currency: session.currency.toLowerCase(),
        status: "paid",
        createdAt: now,
        paidAt: now,
    };

    if (session.subscription) {
        transaction.stripeSubscriptionId = typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;
    }
    if (session.invoice) {
        transaction.stripeInvoiceId = typeof session.invoice === "string"
            ? session.invoice
            : session.invoice.id;
    }

    try {
        await transactionsCollection.insertOne(transaction);
    } catch (error) {
        // The unique index also blocks simultaneous verification requests.
        if (error.code !== 11000) throw error;
        const existing = await transactionsCollection.findOne({ stripeSessionId: session.id });
        if (!existing || String(existing.vendorId) !== userId) throw error;
        return res.send({ success: true, alreadyVerified: true, transaction: existing });
    }

    // Premium activation belongs in the verified Stripe webhook, not this return-page route.
    return res.status(201).send({ success: true, alreadyVerified: false, transaction });
});

router.get("/", verifyToken, verifyAdmin, async (req, res) => {
    const cursor = transactionsCollection.find({});
    const transactions = await cursor.toArray();
    res.send({ success: true, transactions });
});

export default router;
