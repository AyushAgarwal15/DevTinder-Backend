const mongoose = require("mongoose");
const validator = require("validator");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

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
      required: function () {
        // Only require password if githubId is not present
        return !this.githubId;
      },
      minlength: [
        6,
        " Password must be at least 6 characters long, got {VALUE}",
      ],
      maxlength: 100,
      validate(value) {
        if (value && !validator.isStrongPassword(value)) {
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
      enum: {
        values: ["male", "female", "other"],
        message: "{VALUE} is not a valid gender",
      },
    },
    location: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    photoUrl: {
      type: String,
      default:
        "https://res.cloudinary.com/devtinder/image/upload/v1/devtinder_profiles/default-avatar.png",
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
    },
    linkedinUrl: {
      type: String,
      default: "",
      validate(value) {
        if (value && !validator.isURL(value)) {
          throw new Error("Invalid LinkedIn URL");
        }
      },
    },
    githubUrl: {
      type: String,
      default: "",
      validate(value) {
        if (value && !validator.isURL(value)) {
          throw new Error("Invalid GitHub URL");
        }
      },
    },
    portfolioUrl: {
      type: String,
      default: "",
      validate(value) {
        if (value && !validator.isURL(value)) {
          throw new Error("Invalid Portfolio URL");
        }
      },
    },
    // GitHub Integration Fields
    githubId: {
      type: String,
      unique: true,
      sparse: true,
    },
    githubData: {
      type: Object,
      default: null,
    },
    githubRepos: {
      type: Array,
      default: [],
    },
    githubLanguages: {
      type: [String],
      default: [],
    },
    topRepositories: {
      type: Array,
      default: [],
    },
    contributionStats: {
      type: Object,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.methods.getJWT = async function () {
  const user = this;

  const token = await jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  return token;
};

userSchema.methods.validatePassword = async function (passwordInputByUser) {
  const user = this;
  const passwordHash = user.password;

  const isPasswordValid = await bcrypt.compare(
    passwordInputByUser,
    passwordHash
  );

  return isPasswordValid;
};

module.exports = mongoose.model("User", userSchema);
