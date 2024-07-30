import Conversation from "../models/conversationModel.js";
import Message from "../models/messageModel.js";
import User from "../models/userModels.js";
import {
  getGroupSocketIds,
  getRecipientSocketId,
  io,
} from "../socket/socket.js";

const sendMessage = async (req, res) => {
  try {
    const { conversationId, recipientId, message, senderData } = await req.body;
    let { img } = req.body;
    const senderId = req.user._id;

    let conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, recipientId],
        lastMessage: {
          text: message,
          sender: senderId,
          notSeenLength: +1,
        },
      });
      await conversation.save();
    }

    const newMessage = new Message({
      conversationId: conversationId,
      sender: senderId,
      text: message,
      senderData: senderData,
      img: img || "",
    });

    await Promise.all([
      newMessage.save(),
      await conversation.updateOne({
        lastMessage: {
          text: message,
          sender: senderId,
          notSeenLength: conversation.lastMessage.notSeenLength + 1,
        },
      }),
    ]);

    // get new update conversation
    conversation = await Conversation.findById(conversationId);

    if (!conversation.isGroup) {
      const recepientSocketId = await getRecipientSocketId(recipientId);
      if (recepientSocketId) {
        io.to(recepientSocketId).emit("newMessage", newMessage);
        io.to(recepientSocketId).emit("updateConversation", conversation);
      }
    }

    if (conversation.isGroup) {
      // remove senderId from participants array
      const participantsId = conversation.participants.filter(
        (id) => id.toString() !== senderId.toString()
      );
      const groupSocketIds = await getGroupSocketIds(participantsId);
      groupSocketIds.forEach((socketId) => {
        io.to(socketId).emit("newMessage", newMessage);
        io.to(socketId).emit("updateConversation", conversation);
      });
    }

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

// create group with minimum of 3 users
const createGroup = async (req, res) => {
  try {
    const { groupMembers, groupName } = req.body;
    // let { groupImg } = req.body;
    const senderId = req.user._id;

    if (groupMembers.length < 2) {
      return res.status(400).json({
        error: "Group must have at least 3 members",
      });
    }

    const users = await User.find({
      _id: { $in: groupMembers },
    }).select("username profilePic _id");

    const conversation = new Conversation({
      participants: groupMembers,
      admin: senderId,
      lastMessage: {
        text: `${req.user.username} created group ${groupName}`,
        type: "alert",
        sender: senderId,
      },
      group: {
        groupName,
        // groupImg,
      },
      members: users,
      isGroup: true,
    });

    await conversation.save();

    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const getMessages = async (req, res) => {
  const { conversationId } = req.params;
  try {
    const messages = await Message.find({
      conversationId: conversationId,
    }).sort({
      createdAt: 1,
    });
    // get last message
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const getUnreadMessages = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id;

  try {
    const messages = await Message.find({
      conversationId: conversationId,
      seen: false,
    });
    const filterMessage = messages.filter(
      (message) => message.sender.toString() !== userId.toString()
    );
    res.status(200).json(filterMessage.length);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
};

const getConversations = async (req, res) => {
  const userId = req.user._id;
  try {
    const conversations = await Conversation.find({
      participants: userId,
    }).populate({
      path: "participants",
      select: "username profilePic",
    });

    // remove current user from participants array

    conversations.forEach((conversation) => {
      conversation.participants = conversation.participants.filter(
        (participant) => participant._id.toString() !== userId.toString()
      );
    });
    res.status(200).json(conversations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export {
  sendMessage,
  getMessages,
  getConversations,
  getUnreadMessages,
  createGroup,
};
