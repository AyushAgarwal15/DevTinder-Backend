const jwt = require("jsonwebtoken");
const User = require("../models/user");

const userAuth = async (req, res, next) => {
  try {
    // Read the token from the req cookies
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).send("Please login!");
    }

    // Validate the token
    const decodedMessage = await jwt.verify(token, "ayush@secret.8126");
    const { _id } = decodedMessage;
    const user = await User.findById(_id);

    if (!user) {
      throw new Error("User not found");
    } else {
      req.user = user;
      next();
    }
  } catch (err) {
    res.status(400).send("ERROR : " + err.message);
  }
};

module.exports = { userAuth };
