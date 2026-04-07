require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// 🔹 Middleware
app.use(cors());
app.use(express.json());

// 🔹 Routes import (upar hi rakho clean structure ke liye)
const activityRoutes = require("./routes/activityRoutes");
const authRoutes = require("./routes/authRoutes");

// 🔹 Routes use
app.use("/api/activity", activityRoutes);
app.use("/api/auth", authRoutes);

// 🔹 Test route
app.get("/", (req, res) => {
  res.send("PrepWise Backend Running 🚀");
});

// 🔹 MongoDB connect (better error handling)
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected ✅");

    // server start after DB connect (BEST PRACTICE)
    app.listen(5000, () => {
      console.log("Server started on port 5000 🚀");
    });
  })
  .catch((err) => {
    console.log("MongoDB Error ❌", err);
  });