// we can skip it also bcz have schema level validations but having it is also not bad

const validator = require("validator");

const validateSignUpData = (req) => {
  const { firstName, lastName, emailId, password } = req.body;

  if (firstName.length < 3 || firstName.length > 50) {
    throw new Error("First name must be between 3 and 50 characters long");
  } else if (lastName.length < 3 || lastName.length > 50) {
    throw new Error("Last name must be between 3 and 50 characters long");
  } else if (!validator.isEmail(emailId)) {
    throw new Error("Invalid email");
  } else if (password.length < 6 || password.length > 100) {
    throw new Error("Password must be between 6 and 100 characters long");
  } else if (!validator.isStrongPassword(password)) {
    throw new Error(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    );
  }
};

module.exports = { validateSignUpData };
