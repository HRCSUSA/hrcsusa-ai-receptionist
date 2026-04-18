import express from "express";

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Home route
app.get("/", (req, res) => {
    res.send("CLEAN RESET 999");
});

// Voice endpoint (Twilio)
app.get("/", (req, res) => {
    res.send("🔥 HARD DEPLOY TEST 12345");
});

// Start server
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
