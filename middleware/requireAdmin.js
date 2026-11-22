import { ObjectId } from "mongodb";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import { userCollection } from "../lib/db.js";
import { HttpError } from "../lib/httpError.js";

export async function requireAdmin(req, res, next) {
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
        throw new HttpError(401, "Not signed in.");
    }

    const user = await userCollection.findOne({
        _id: new ObjectId(session.user.id),
    });

    if (user?.role !== "admin") {
        throw new HttpError(403, "Admins only.");
    }

    req.user = user;
    next();
}