const path = require("path");
const envPath = path.resolve(process.cwd(), ".env");

require("dotenv").config({ path: envPath });
const express = require("express");
const connectDB = require("./config/database");
const app = express();
const cookieParser = require("cookie-parser");
const cors = require("cors");
const http = require("http");

app.use(
  cors({
    origin: [process.env.CLIENT_ORIGIN, "https://devtinder-ayush.vercel.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

const authRouter = require("./routes/auth");
const profileRouter = require("./routes/profile");
const requestRouter = require("./routes/request");
const userRouter = require("./routes/user");
const chatRouter = require("./routes/chat");
const githubRouter = require("./routes/github");
const testRouter = require("./routes/test");

const initializeSocket = require("./utils/socket");

app.use("/", authRouter);
app.use("/", profileRouter);
app.use("/", requestRouter);
app.use("/", userRouter);
app.use("/", chatRouter);
app.use("/", githubRouter);
app.use("/", testRouter);

const server = http.createServer(app);
initializeSocket(server);

// And modify your server startup to only run when not in production:
if (process.env.NODE_ENV !== "production") {
  connectDB()
    .then(() => {
      console.log("Database connection established.");
      server.listen(process.env.PORT || 3000, () => {
        console.log(`Server is running on port ${process.env.PORT || 3000}`);
      });
    })
    .catch((err) => {
      console.error("Database can not be connected!!", err);
    });
} else {
  // For Vercel, still connect to DB but don't start the server
  connectDB()
    .then(() => {
      console.log("Database connection established in production.");
    })
    .catch((err) => {
      console.error("Database can not be connected!!", err);
    });
}

module.exports = app;
