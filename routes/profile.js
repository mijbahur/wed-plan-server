import { Router } from "express";
import { userCollection } from "../lib/db.js";
import { HttpError } from "../lib/httpError.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = Router();
const commonFields = ["name", "image", "phone", "location"];
const vendorFields = ["businessName", "description", "website"];
const profileProjection = {
    name: 1,
    email: 1,
    image: 1,
    userRole: 1,
    createdAt: 1,
    phone: 1,
    location: 1,
    businessName: 1,
    description: 1,
    website: 1,
    subscriptionPlan: 1,
    isPremium: 1,
};

function getEditableFields(userRole) {
    return userRole === "vendor"
        ? [...commonFields, ...vendorFields]
        : commonFields;
}

function serializeProfile(profile) {
    return {
        id: String(profile._id),
        name: profile.name ?? "",
        email: profile.email ?? "",
        image: profile.image ?? "",
        userRole: profile.userRole ?? "customer",
        createdAt: profile.createdAt ?? null,
        phone: profile.phone ?? "",
        location: profile.location ?? "",
        businessName: profile.businessName ?? "",
        description: profile.description ?? "",
        website: profile.website ?? "",
        subscriptionPlan: profile.subscriptionPlan ?? (profile.isPremium ? "premium" : "free"),
    };
}

function validateField(field, value) {
    if (field === "image") {
        if (value === null || value === "") return null;
        if (typeof value !== "string" || value.length > 2048) {
            throw new HttpError(422, "Profile image must be a valid image URL.");
        }
        let imageUrl;
        try {
            imageUrl = new URL(value);
        } catch {
            throw new HttpError(422, "Profile image must be a valid image URL.");
        }
        if (!['http:', 'https:'].includes(imageUrl.protocol)) {
            throw new HttpError(422, "Profile image must be a valid image URL.");
        }
        return value;
    }

    if (typeof value !== "string") {
        throw new HttpError(422, `${field} must be text.`);
    }

    const cleaned = value.trim();
    const limits = { name: 100, phone: 30, location: 120, businessName: 120, description: 1000, website: 2048 };
    if (cleaned.length > limits[field]) {
        throw new HttpError(422, `${field} is too long.`);
    }
    if (field === "name" && !cleaned) {
        throw new HttpError(422, "Name is required.");
    }
    if (field === "website" && cleaned) {
        let website;
        try {
            website = new URL(cleaned);
        } catch {
            throw new HttpError(422, "Enter a valid website URL.");
        }
        if (!['http:', 'https:'].includes(website.protocol)) {
            throw new HttpError(422, "Enter a valid website URL.");
        }
    }
    return cleaned;
}

router.use(verifyToken);

router.get("/", async (req, res) => {
    const profile = await userCollection.findOne(
        { _id: req.user._id },
        { projection: profileProjection },
    );
    if (!profile) throw new HttpError(404, "Profile not found.");
    res.json({ success: true, data: { profile: serializeProfile(profile) } });
});

router.patch("/", async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        throw new HttpError(400, "Profile updates must be a JSON object.");
    }

    const fields = getEditableFields(req.user.userRole);
    const submittedFields = Object.keys(body);
    if (submittedFields.length === 0) {
        throw new HttpError(400, "Provide at least one profile field to update.");
    }
    const invalidFields = submittedFields.filter((field) => !fields.includes(field));
    if (invalidFields.length > 0) {
        throw new HttpError(400, "Profile updates may only include editable profile fields.");
    }

    const updates = Object.fromEntries(
        submittedFields.map((field) => [field, validateField(field, body[field])]),
    );
    updates.updatedAt = new Date();

    const result = await userCollection.updateOne(
        { _id: req.user._id },
        { $set: updates },
    );
    if (result.matchedCount === 0) throw new HttpError(404, "Profile not found.");

    const profile = await userCollection.findOne(
        { _id: req.user._id },
        { projection: profileProjection },
    );
    res.json({ success: true, data: { profile: serializeProfile(profile) } });
});

export default router;
