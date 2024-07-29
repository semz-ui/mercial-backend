import mongoose from "mongoose";

const conversationSchem = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    lastMessage: {
      text: String,
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      type: {
        type: String,
        default: "text",
      },
      seen: {
        type: Boolean,
        default: false,
      },
      notSeenLength: {
        type: Number,
        default: 0,
      },
    },
    group: {
      groupName: {
        type: String,
        default: "",
      },
      groupImg: {
        type: String,
        default: "",
      },
    },
    members: [
      {
        username: {
          type: String,
        },
        profilePic: {
          type: String,
          default: "",
        },
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      },
    ],
    isGroup: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Conversation = mongoose.model("Conversation", conversationSchem);

export default Conversation;
