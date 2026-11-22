import { ObjectId } from "mongodb";
import { sessionsCollection, userCollection } from "../lib/db.js";
import { HttpError } from "../lib/httpError.js";

export const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        throw new HttpError(401, "Authorization header missing.");
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
        throw new HttpError(401, "Invalid token.");
    }
    const query = { token };
    const session = await sessionsCollection.findOne(query);
    if (!session) {
        throw new HttpError(401, "Invalid session.");
    }

    const userId = session.userId;
    const userQuery = { _id: new ObjectId(userId) };
    const user = await userCollection.findOne(userQuery);
    if (!user) {
        throw new HttpError(403, "Unauthorized user.");
    }
    req.user = user;
    next();
};