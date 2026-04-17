import express from "express";

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Home route
app.get("/", (req, res) => {
    res.send("HRCS USA AI is Active!");
});

// Voice endpoint (Twilio)
app.post("/voice", (req, res) => {
    res.set("Content-Type", "text/xml");

    res.send(`
        <Response>
            <Say voice="Polly.Joanna" language="en-US">
                Hello! This is your AI receptionist. Please say how can I help you.
            </Say>
        </Response>
    `);
});

// Start server
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});
