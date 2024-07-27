import jwt from "jsonwebtoken";

const generateTokenAndSetCookie = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

export default generateTokenAndSetCookie;
