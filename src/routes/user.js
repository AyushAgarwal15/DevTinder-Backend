const express = require("express");
const userAuth = require("../middlewares/auth");
const User = require("../models/user");
const ConnectionRequest = require("../models/connectionRequest");
const userRouter = express.Router();

const USER_SAFE_DATA =
  "firstName lastName photoUrl age gender about skills linkedinUrl githubUrl portfolioUrl githubData githubLanguages contributionStats";

// Get all the received connection request for the loggedIn User
userRouter.get("/user/requests/received", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;

    const connectionRequests = await ConnectionRequest.find({
      toUserId: loggedInUser._id,
      status: "interested",
    }).populate("fromUserId", USER_SAFE_DATA);
    // .populate("fromUserId", ["firstName", "lastName"]); this is other way of doing same as above

    res.json({
      message: "All Connection Requests fetched Successfully.",
      data: connectionRequests,
    });
  } catch (err) {
    res.status(400).send("ERROR: " + err.message);
  }
});

// Get all the connections
userRouter.get("/user/connections", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;

    const connectionRequests = await ConnectionRequest.find({
      $or: [
        { toUserId: loggedInUser._id, status: "accepted" },
        { fromUserId: loggedInUser._id, status: "accepted" },
      ],
    })
      .populate("fromUserId", USER_SAFE_DATA)
      .populate("toUserId", USER_SAFE_DATA);

    const data = connectionRequests.map((row) => {
      if (row.fromUserId._id.toString() === loggedInUser._id.toString()) {
        return row.toUserId;
      } else return row.fromUserId;
    });

    res.json({ data });
  } catch (err) {
    res.status(400).send("ERROR " + err.message);
  }
});

// Remove a connection
userRouter.delete(
  "/user/connections/:connectionId",
  userAuth,
  async (req, res) => {
    try {
      const loggedInUser = req.user;
      const connectionId = req.params.connectionId;

      // Find the connection request document where:
      // 1. Either the logged-in user is the sender or the receiver
      // 2. The other user is the one specified in the params
      // 3. The status is "accepted" (it's an active connection)
      const connectionRequest = await ConnectionRequest.findOne({
        $or: [
          {
            fromUserId: loggedInUser._id,
            toUserId: connectionId,
            status: "accepted",
          },
          {
            toUserId: loggedInUser._id,
            fromUserId: connectionId,
            status: "accepted",
          },
        ],
      });

      if (!connectionRequest) {
        return res.status(404).json({ message: "Connection not found" });
      }

      // Delete the connection
      await ConnectionRequest.deleteOne({ _id: connectionRequest._id });

      res.json({
        message: "Connection removed successfully",
        connectionRequestId: connectionRequest._id,
      });
    } catch (err) {
      res
        .status(400)
        .json({ message: "Error removing connection: " + err.message });
    }
  }
);

userRouter.get("/feed", userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    const userId = loggedInUser._id || `github_${loggedInUser.githubId}`;

    const page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 10;
    limit = limit > 50 ? 50 : limit;
    const skip = (page - 1) * limit;

    const connectionRequests = await ConnectionRequest.find({
      $or: [{ fromUserId: userId }, { toUserId: userId }],
    }).select("fromUserId toUserId");

    const hideUsersFromFeed = new Set();
    connectionRequests.forEach((req) => {
      hideUsersFromFeed.add(req.fromUserId.toString());
      hideUsersFromFeed.add(req.toUserId.toString());
    });

    // For GitHub users, we need to handle the case where they might not be in MongoDB
    let users;
    if (loggedInUser.isGitHubUser) {
      // For GitHub users, we'll only show MongoDB users
      users = await User.find({
        _id: { $nin: Array.from(hideUsersFromFeed) },
      })
        .select(USER_SAFE_DATA)
        .skip(skip)
        .limit(limit);
    } else {
      // For MongoDB users, show both MongoDB users and GitHub users
      users = await User.find({
        $and: [
          { _id: { $nin: Array.from(hideUsersFromFeed) } },
          { _id: { $ne: userId } },
        ],
      })
        .select(USER_SAFE_DATA)
        .skip(skip)
        .limit(limit);
    }

    // Add default values for GitHub-specific fields if they don't exist
    users = users.map((user) => {
      const userData = user.toObject();
      if (!userData.githubData) {
        userData.githubData = null;
      }
      if (!userData.githubLanguages) {
        userData.githubLanguages = [];
      }
      if (!userData.contributionStats) {
        userData.contributionStats = {
          totalRepos: 0,
          totalStars: 0,
          totalForks: 0,
          languages: {},
        };
      }
      return userData;
    });

    res.json({ data: users });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = userRouter;
