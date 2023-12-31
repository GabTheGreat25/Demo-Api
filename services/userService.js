const User = require("../models/user");
const Products = require("../models/product");
const Transactions = require("../models/transaction");
const mongoose = require("mongoose");
const ErrorHandler = require("../utils/errorHandler");
const bcrypt = require("bcrypt");
const token = require("../utils/token");
const { cloudinary } = require("../utils/cloudinary");
const { STATUSCODE, RESOURCE, ROLE } = require("../constants/index");
const blacklistedTokens = [];

exports.updatePassword = async (
  id,
  oldPassword,
  newPassword,
  confirmPassword
) => {
  const user = await User.findById(id).select("+password");

  if (!user) throw new ErrorHandler("User not found");

  const isMatch = await bcrypt.compare(oldPassword, user.password);

  if (!isMatch) throw new ErrorHandler("Invalid old password");

  if (newPassword !== confirmPassword)
    throw new ErrorHandler("Passwords do not match");

  const hashedPassword = await bcrypt.hash(
    newPassword,
    Number(process.env.SALT_NUMBER)
  );

  user.password = hashedPassword;

  await user.save();

  return user;
};

exports.loginToken = async (email, password) => {
  const foundUser = await User.findOne({ email }).select("+password").exec();

  if (!foundUser) throw new ErrorHandler("Wrong Email Or Password");

  const match = await bcrypt.compare(password, foundUser.password);

  if (!match) throw new ErrorHandler("Wrong Password");

  const accessToken = token.generateAccessToken(
    foundUser.email,
    foundUser.roles
  );

  const accessTokenMaxAge = 7 * 24 * 60 * 60 * 1000;

  return { user: foundUser, accessToken, accessTokenMaxAge };
};

exports.logoutUser = (cookies, res) => {
  return new Promise((resolve, reject) => {
    !cookies?.jwt
      ? reject(new Error("You are not logged in"))
      : (blacklistedTokens.push(cookies.jwt),
        res.clearCookie(RESOURCE.JWT, {
          httpOnly: true,
          secure: process.env.NODE_ENV === RESOURCE.PRODUCTION,
          sameSite: RESOURCE.NONE,
        }),
        resolve());
  });
};

exports.getBlacklistedTokens = () => {
  return blacklistedTokens;
};

exports.getAllUsersData = async () => {
  const users = await User.find()
    .sort({ createdAt: STATUSCODE.NEGATIVE_ONE })
    .lean()
    .exec();

  return users;
};

exports.getSingleUserData = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ErrorHandler(`Invalid user ID: ${id}`);

  const user = await User.findById(id).lean().exec();

  if (!user) throw new ErrorHandler(`User not found with ID: ${id}`);

  return user;
};

exports.CreateUserData = async (req, res) => {
  const duplicateUser = await User.findOne({ name: req.body.name })
    .collation({ locale: "en" })
    .lean()
    .exec();

  if (duplicateUser) throw new ErrorHandler("Duplicate name");

  let images = [];
  if (req.files && Array.isArray(req.files)) {
    images = await Promise.all(
      req.files.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path, {
          public_id: file.filename,
        });
        return {
          public_id: result.public_id,
          url: result.url,
          originalname: file.originalname,
        };
      })
    );
  }

  if (images.length === STATUSCODE.ZERO)
    throw new ErrorHandler("At least one image is required");

  const roles = req.body.roles
    ? Array.isArray(req.body.roles)
      ? req.body.roles
      : req.body.roles.split(", ")
    : [ROLE.CUSTOMER];

  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: await bcrypt.hash(
      req.body.password,
      Number(process.env.SALT_NUMBER)
    ),
    roles: roles,
    image: images,
  });

  return user;
};

exports.updateUserData = async (req, res, id) => {
  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ErrorHandler(`Invalid user ID: ${id}`);

  const existingUser = await User.findById(id).lean().exec();

  if (!existingUser) throw new ErrorHandler(`User not found with ID: ${id}`);

  const duplicateUser = await User.findOne({
    name: { $regex: new RegExp(`^${req.body.name}$`, "i") },
    _id: { $ne: id },
  })
    .collation({ locale: "en" })
    .lean()
    .exec();

  if (duplicateUser) throw new ErrorHandler("Duplicate name");

  let images = existingUser.image || [];
  if (req.files && Array.isArray(req.files) && req.files.length > 0) {
    images = await Promise.all(
      req.files.map(async (file) => {
        const result = await cloudinary.uploader.upload(file.path, {
          public_id: file.filename,
        });
        return {
          public_id: result.public_id,
          url: result.url,
          originalname: file.originalname,
        };
      })
    );

    await cloudinary.api.delete_resources(
      existingUser.image.map((image) => image.public_id)
    );
  }

  let roles = existingUser.roles;
  if (req.body.roles) {
    roles = Array.isArray(req.body.roles)
      ? req.body.roles
      : req.body.roles.split(", ");
  }

  const updatedUser = await User.findByIdAndUpdate(
    id,
    {
      ...req.body,
      roles: roles,
      image: images,
    },
    {
      new: true,
      runValidators: true,
    }
  )
    .lean()
    .exec();

  if (!updatedUser) throw new ErrorHandler(`User not found with ID: ${id}`);

  return updatedUser;
};

exports.deleteUserData = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ErrorHandler(`Invalid user ID: ${id}`);

  const user = await User.findOne({ _id: id });
  if (!user) throw new ErrorHandler(`User not found with ID: ${id}`);

  const publicIds = user.image.map((image) => image.public_id);

  await Promise.all([
    User.deleteOne({ _id: id }).lean().exec(),
    cloudinary.api.delete_resources(publicIds),
    Products.deleteMany({ user: id }).lean().exec(),
    Transactions.deleteMany({ user: id }).lean().exec(),
  ]);

  return user;
};
