require("dotenv").config({ path: "./config/.env" });
const PORT = process.env.PORT || 4000;
const express = require("express");
const app = express();
const path = require("path");
const mongoose = require("mongoose");
const connectDB = require("./config/db");
const cors = require("cors");
const corsOptions = require("./config/corsOptions");
const { errorJson, errorHandler } = require("./middleware/errorJson");
const test = require("./routes/test");
const { STATUSCODE } = require("./constants/index");

connectDB();
app.use(cors(corsOptions));
app.use(express.json());

app.use("/", express.static(path.join(__dirname, "/public")));
app.use("/", require("./routes/root"));

app.use("/api/v1", test);

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
});

mongoose.connection.on("error", (err) => {
  console.log(`${err.no}: ${err.code}\t${err.syscall}\t${err.hostname}`);
});
