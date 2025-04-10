const mongoose = require("mongoose");
const validator = require("validator");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
      minlength: 3,
      maxlength: 50,
      trim: true,
    },
    lastName: {
      type: String,
      minlength: 3,
      maxlength: 50,
      trim: true,
    },
    emailId: {
      type: String,
      unique: true,
      required: true,
      lowercase: true,
      trim: true,
      // custom way of adding validations
      // validate: {
      //   validator: function (v) {
      //     return /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(v);
      //   },
      //   message: (props) => `${props.value} is not a valid email!`,
      // },
      // library way of adding validations
      validate(value) {
        if (!validator.isEmail(value)) {
          throw new Error("Invalid Email: " + value);
        }
      },
    },
    password: {
      type: String,
      required: true,
      minlength: [
        6,
        " Password must be at least 6 characters long, got {VALUE}",
      ],
      maxlength: 100,
      validate(value) {
        if (!validator.isStrongPassword(value)) {
          throw new Error("Password is not strong enough");
        }
      },
    },
    age: {
      type: Number,
      min: 18,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
      // required: true,
    },
    location: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    photoUrl: {
      type: String,
      default:
        "https://tamilnaducouncil.ac.in/wp-content/uploads/2020/04/dummy-avatar.jpg",
      validate(value) {
        if (!validator.isURL(value)) {
          throw new Error("Invalid URL: " + value);
        }
      },
    },
    about: {
      type: String,
      default: "Open to make new connections 🙂",
      trim: true,
      maxlength: 200,
    },
    skills: {
      type: [String],
      validate: [
        {
          validator: (arr) => arr.length <= 5,
          message: "You can only add up to 5 skills.",
        },
        {
          validator: (arr) => arr.every((skill) => skill.length <= 20),
          message: "Each skill must be at most 20 characters long.",
        },
      ],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
