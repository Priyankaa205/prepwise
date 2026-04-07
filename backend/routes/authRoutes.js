const express = require("express");
const router = express.Router();

// TEST ROUTE
router.get("/", (req, res) => {
  res.send("Auth route working 🚀");
});

// LOGIN (dummy for now)
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  console.log("Login Data:", email, password);

  res.json({
    message: "Login successful",
    user: { email }
  });
});

// SIGNUP (dummy for now)
router.post("/signup", (req, res) => {
  const { email, password } = req.body;

  console.log("Signup Data:", email, password);

  res.json({
    message: "User created",
    user: { email }
  });
});

module.exports = router;