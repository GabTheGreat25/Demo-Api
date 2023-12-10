require("dotenv").config({ path: "./config/.env" });
const express = require("express");
const app = express();
const path = require("path");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const corsOptions = require("./config/corsOptions");
const mongoose = require("mongoose");
const { logger, logEvents } = require("./middleware/logger");
const { errorJson, errorHandler } = require("./middleware/errorJson");
const tests = require("./routes/test");
const auth = require("./routes/auth");
const users = require("./routes/user");
const products = require("./routes/product");
const transactions = require("./routes/transaction");
const { STATUSCODE } = require("./constants/index");
const connectDB = require("./config/db");
const PORT = process.env.PORT || 4000;

connectDB();
app.use(logger);
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

app.use("/", express.static(path.join(__dirname, "/public")));
app.use("/", require("./routes/root"));

app.use("/api/v1", tests, auth, users, products, transactions);

app.all("*", (req, res) => {
  const filePath = req.accepts("html")
    ? path.join(__dirname, "views", "404.html")
    : req.accepts("json")
    ? { message: "404 Not Found" }
    : "404 Not Found";

  res.status(STATUSCODE.NOT_FOUND).sendFile(filePath);
});

app.use(errorJson);
app.use(errorHandler);

mongoose.connection.once("open", () => {
  app.listen(PORT);
  console.log(
    `Connected to MongoDB. Click here to view: http://localhost:${PORT}`
  );
  logEvents(
    `Connected to MongoDB on ${mongoose.connection.host}:${PORT}`,
    "mongoLog.log"
  );
});

mongoose.connection.on("error", (err) => {
  console.log(`${err.no}: ${err.code}\t${err.syscall}\t${err.hostname}`);
  logEvents(
    `${err.no}: ${err.code}\t${err.syscall}\t${err.hostname}`,
    "mongoLog.log"
  );
});
