import jwt from "jsonwebtoken";
import User from "../models/userModels.js";

const protectRoute = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header and remove Bearer from string
      token = req.headers.authorization.split(" ")[1];
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // Get user from database
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (error) {
      console.log(error);
      res.status(401);
      throw new Error("Not authorized to access this route");
    }
  }
  if (!token) {
    res.status(401);
    throw new Error("Not authorized no token");
  }
};

export default protectRoute;
