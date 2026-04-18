import express from "express";

const app = express();
const PORT = process.env.PORT || 8080;

// middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// health check
app.get("/", (req, res) => {
    res.send("HRCS USA AI is Active (SIMPLE MODE)");
});

// Twilio voice webhook
app.post("/voice", (req, res) => {
    console.log("📞 Incoming call received");

    res.set("Content-Type", "text/xml");

    res.send(`
        <Response>
            <Say voice="Polly.Joanna" language="en-US">
                Hello. This is your AI receptionist. 
                Please leave your message after the beep.
            </Say>

            <Record 
                maxLength="30" 
                action="/voice/recording" 
                method="POST"
            />

            <Say>Thank you. Goodbye.</Say>
        </Response>
    `);
});

// після запису
app.post("/voice/recording", (req, res) => {
    console.log("🎙️ Recording received:", req.body);

    res.set("Content-Type", "text/xml");
    res.send(`<Response><Say>We received your message. Goodbye.</Say></Response>`);
});

app.listen(PORT, () => {
    console.log("🚀 Server running on port " + PORT);
});
