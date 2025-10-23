const express = require("express");
require("dotenv").config({ path: "config.env" });
const cors = require("cors");
const app = express();
const gameRoutes = require("./routes/game");

const PORT = process.env.PORT || 5000;

// Enable CORS for all routes
app.use(
  cors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Parse JSON bodies
app.use(express.json());

// Mount game routes
app.use("/", gameRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ status: "Server is running", port: PORT });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`✓ Server is running on http://localhost:${PORT}`);
  console.log(`✓ CORS enabled for all origins`);
});
