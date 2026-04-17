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
app.post("/voice", (req, res) => {
    console.log("🔥 NEW CLEAN CODE");

    res.set("Content-Type", "text/xml");

    res.send(`
        <Response>
            <Say>
                CLEAN VERSION WORKING
            </Say>
        </Response>
    `);
});

// Start server
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
