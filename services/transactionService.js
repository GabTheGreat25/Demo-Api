const Transaction = require("../models/transaction");
const ErrorHandler = require("../utils/errorHandler");
const mongoose = require("mongoose");
const { STATUSCODE, RESOURCE } = require("../constants/index");

exports.getAllTransactionData = async () => {
  const transactions = await Transaction.find()
    .sort({
      createdAt: STATUSCODE.NEGATIVE_ONE,
    })
    .populate([
      {
        path: RESOURCE.USER,
        select: "name",
      },
      {
        path: RESOURCE.PRODUCT,
        select: "product_name price image",
      },
    ])
    .lean()
    .exec();

  return transactions;
};

exports.getSingleTransactionData = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ErrorHandler(`Invalid transaction ID: ${id}`);

  const transaction = await Transaction.findById(id)
    .populate([
      {
        path: RESOURCE.USER,
        select: "name",
      },
      {
        path: RESOURCE.PRODUCT,
        select: "product_name price image",
      },
    ])
    .lean()
    .exec();

  if (!transaction)
    throw new ErrorHandler(`Transaction not found with ID: ${id}`);

  return transaction;
};

exports.createTransactionData = async (data) => {
  const { user, product, date } = data;

  const transaction = await Transaction.create({
    user,
    product,
    date,
  });

  await Transaction.populate(transaction, [
    {
      path: RESOURCE.USER,
      select: "name email",
    },
    {
      path: RESOURCE.PRODUCT,
      select: "product_name price image",
    },
  ]);

  return transaction;
};

exports.updateTransactionData = async (req, res, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ErrorHandler(`Invalid transaction ID: ${id}`);
  }

  const existingTransaction = await Transaction.findOneAndUpdate(
    { _id: id },
    req.body,
    { new: true, runValidators: true }
  )
    .populate([
      {
        path: RESOURCE.USER,
        select: "name email",
      },
      {
        path: RESOURCE.PRODUCT,
        select: "product_name price image",
      },
    ])
    .lean()
    .exec();

  if (!existingTransaction) {
    throw new ErrorHandler(`Transaction not found with ID: ${id}`);
  }

  return existingTransaction;
};

exports.deleteTransactionData = async (id) => {
  if (!mongoose.Types.ObjectId.isValid(id))
    throw new ErrorHandler(`Invalid transaction ID: ${id}`);

  const transaction = await Transaction.findOne({
    _id: id,
  });
  if (!transaction)
    throw new ErrorHandler(`Transaction not found with ID: ${id}`);

  await Promise.all([
    Transaction.deleteOne({
      _id: id,
    })
      .lean()
      .exec(),
  ]);

  return transaction;
};
