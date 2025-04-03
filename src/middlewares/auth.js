const userAuth = (req, res, next) => {
  const token = "xyz";
  const isUserAuthorized = token === "xyz";

  if (isUserAuthorized) {
    console.log("user is authorized");
    next();
  } else {
    res.status(401).send("Unauthorized");
  }
};

module.exports = { userAuth };
