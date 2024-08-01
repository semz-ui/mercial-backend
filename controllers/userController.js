import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import bcrypt from "bcryptjs";
import User from "../models/userModels.js";
import generateTokenAndSetCookie from "../utils/helpers/generateTokenAndSetCookie.js";
import Post from "../models/postModel.js";
import { getRecipientSocketId, io } from "../socket/socket.js";

const getUserProfile = async (req, res) => {
  // We will fetch user profile either with username or userId
  // query is either username or userId
  const { query } = req.params;

  try {
    let user;

    // query is userId
    if (mongoose.Types.ObjectId.isValid(query)) {
      user = await User.findOne({ _id: query })
        .select("-password")
        .select("-updatedAt");
    } else {
      // query is username
      user = await User.findOne({ username: query })
        .select("-password")
        .select("-updatedAt");
    }

    if (!user) return res.status(404).json({ error: "User not found" });

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
    console.log("Error in getUserProfile: ", err.message);
  }
};

const signupUser = async (req, res) => {
  try {
    const { name, email, username, password } = req.body;
    if (!name || !email || !username || !password)
      return res.status(400).json({ error: "Please input all fields" });
    const user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      return res.status(400).json({ error: "User already exists" });
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const newUser = new User({
      name,
      email,
      username,
      password: hashedPassword,
    });
    await newUser.save();
    if (newUser) {
      return res.status(201).json({
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        username: newUser.username,
        bio: newUser.bio,
        profilePic: newUser.profilePic,
        token: generateTokenAndSetCookie(newUser._id),
      });
    } else {
      return res.status(400).json({ error: "Invalid user data" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ error: "User does not exist" });
    }
    const isPasswordCorrest = await bcrypt.compare(password, user.password);
    if (!isPasswordCorrest) {
      return res
        .status(400)
        .json({ error: "Invalid password please try again" });
    }
    res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      username: user.username,
      bio: user.bio,
      profilePic: user.profilePic,
      token: generateTokenAndSetCookie(user._id),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const logoutUser = async (req, res) => {
  try {
    res.cookie("jwt", "", { maxAge: 1 });
    res.status(200).json({ message: "User logged out successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const followUnfollowUser = async (req, res) => {
  try {
    const { id } = await req.params;
    const userId = req.user._id;
    console.log(userId.toString());
    const userToModify = await User.findById(id);

    const currentUser = await User.findById(req.user._id);

    if (id === userId.toString())
      return res.status(400).json({
        error: "You cannot follow yourself",
      });

    if (!userToModify || !currentUser)
      return res.status(400).json({ error: "User not found" });

    const isFollowing = currentUser.following.includes(id);

    if (isFollowing) {
      await User.findByIdAndUpdate(req.user._id, { $pull: { following: id } });
      await User.findByIdAndUpdate(id, { $pull: { followers: req.user._id } });
      return res.status(200).json({
        message: "User unfollowed successfully",
      });
    } else {
      await User.findByIdAndUpdate(req.user._id, { $push: { following: id } });
      await User.findByIdAndUpdate(id, { $push: { followers: req.user._id } });
      return res.status(200).json({
        message: "User followed successfully",
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const updateUser = async (req, res) => {
  const { name, email, username, password, bio, peerId } = req.body;
  let { profilePic } = req.body;

  const userId = req.params.id;
  try {
    let user = await User.findById(userId);
    if (!user) return res.status(400).json({ message: "User does not exist" });
    if (req.params.id !== userId.toString())
      return res.status(400).json({
        error: "You cannot update other users profile",
      });
    if (password) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      user.password = hashedPassword;
    }

    if (profilePic) {
      if (user.profilePic) {
        await cloudinary.uploader.destroy(
          user.profilePic.split("/").pop().split(".")[0]
        );
      }

      const uploadedResponse = await cloudinary.uploader.upload(profilePic);
      profilePic = uploadedResponse.secure_url;
    }

    user.name = name || user.name;
    user.email = email || user.email;
    user.username = username || user.username;
    user.bio = bio || user.bio;
    user.profilePic = profilePic || user.profilePic;
    user.peerId = peerId || user.peerId;

    await user.save();

    //Find all posts that user commented on and update user profile picture or username
    await Post.updateMany(
      { "replies.userId": userId },
      {
        $set: {
          "replies.$[reply].username": user.username,
          "replies.$[reply].userProfilePic": user.profilePic,
        },
      },
      {
        arrayFilters: [{ "reply.userId": userId }],
      }
    );

    // remove password from response
    user.password = null;

    if (peerId) {
      console.log("clicked");
      const recepientSocketId = await getRecipientSocketId(userId);
      io.to(recepientSocketId).emit("updateUserPeerId", user);
    }

    res
      .status(200)
      .json({ message: "Profile Updated successfully", user: user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getSuggestedUsers = async (req, res) => {
  try {
    // exclude the current user from suggested users array and exclude users that current user is already following
    const userId = req.user._id;

    const usersFollowedByYou = await User.findById(userId).select("following");

    const users = await User.aggregate([
      {
        $match: {
          _id: { $ne: userId },
        },
      },
      {
        $sample: { size: 10 },
      },
    ]);
    const filteredUsers = users.filter(
      (user) => !usersFollowedByYou.following.includes(user._id)
    );
    const suggestedUsers = filteredUsers.slice(0, 4);

    suggestedUsers.forEach((user) => (user.password = null));

    res.status(200).json(suggestedUsers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const freezeAccount = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(400).json({ error: "User not found" });
    }

    user.isFrozen = true;
    await user.save();

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// search for users
const searchUsers = async (req, res) => {
  const { searchText } = req.params;
  try {
    const users = await User.find({
      username: { $regex: searchText, $options: "i" },
    }).select("username profilePic _id");
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export {
  signupUser,
  loginUser,
  logoutUser,
  followUnfollowUser,
  updateUser,
  getUserProfile,
  getSuggestedUsers,
  freezeAccount,
  searchUsers,
};
