const mongoose = require("mongoose");

const connectionRequestSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: String,
      ref: "User",
      required: true,
    },
    toUserId: {
      type: String,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: {
        values: ["ignored", "interested", "accepted", "rejected"],
        message: "{VALUE} is not a valid status",
      },
    },
  },
  { timestamps: true }
);

connectionRequestSchema.index({ fromUserId: 1, toUserId: 1 });

connectionRequestSchema.pre("save", function (next) {
  const connectionRequest = this;

  // check if the fromUserId is same as toUserId
  if (connectionRequest.fromUserId === connectionRequest.toUserId) {
    throw new Error("Can not send connection request to yourself!");
  }

  next();
});

module.exports = mongoose.model("connectionRequest", connectionRequestSchema);
