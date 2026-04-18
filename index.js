import express from "express";
const app = express();

app.use(express.urlencoded({ extended: true }));

app.post("/voice", (req, res) => {
    console.log("📞 Incoming call!");
    res.type("text/xml");
    res.send(`
        <Response>
            <Say voice="Polly.Joanna">Hello! We are testing the connection. If you hear this, it works!</Say>
            <Hangup/>
        </Response>
    `);
});

app.get("/", (req, res) => res.send("Server is UP"));

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Ready on port ${PORT}`));
