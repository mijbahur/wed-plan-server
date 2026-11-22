import { HttpError } from "../lib/httpError.js";

export const verifyCustomer = async (req, res, next) => { 
    if (req.user.userRole !== "customer") {
        throw new HttpError(403, "Forbidden");
    }
    next();
};
export const verifyVendor = async (req, res, next) => { 
    if (req.user.userRole !== "vendor") {
        throw new HttpError(403, "Forbidden");
    }
    next();
};

export const verifyAdmin = async (req, res, next) => {
    if (req.user.role !== "admin") {
        throw new HttpError(403, "Forbidden");
    }
    next();
};
