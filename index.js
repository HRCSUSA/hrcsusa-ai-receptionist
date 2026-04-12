import express from "express";
import { WebSocketServer } from "ws";
import WebSocket from "ws";

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/", (req, res) => {
    res.send("HRCS USA AI is Active!");
});

// Twilio Voice webhook
app.post("/voice", (req, res) => {
    res.type("text/xml");

    const host = req.headers.host;

    res.send(`
<Response>
    <Connect>
        <Stream url="wss://${host}/media-stream" />
    </Connect>
</Response>
    `);
});

// Start HTTP server
const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on ${PORT}`);
});

// WebSocket server for Twilio Media Stream
const wss = new WebSocketServer({
    server,
    path: "/media-stream",
});

// Handle Twilio connection
wss.on("connection", (ws) => {
    console.log("Twilio connected");

    // Connect to OpenAI Realtime
    const openAiWs = new WebSocket(
        "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
        {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "OpenAI-Beta": "realtime=v1",
            },
        }
    );

    openAiWs.on("open", () => {
        console.log("OpenAI connected");

        // Session setup
        openAiWs.send(
            JSON.stringify({
                type: "session.update",
                session: {
                    instructions:
                        "You are a professional phone assistant for HRCS USA in Katy, Texas. Collect customer name, address, and service type (Garage doors, Electrical, TV mounting). Ask one question at a time. Be concise and polite.",
                    voice: "alloy",
                    input_audio_format: "g711_ulaw",
                    output_audio_format: "g711_ulaw",
                },
            })
        );

        // Start response session
        openAiWs.send(
            JSON.stringify({
                type: "response.create",
            })
        );
    });

    // Twilio → OpenAI (audio stream)
    ws.on("message", (message) => {
        let data;

        try {
            data = JSON.parse(message.toString());
        } catch (e) {
            return;
        }

        if (
            data.event === "media" &&
            openAiWs.readyState === WebSocket.OPEN
        ) {
            openAiWs.send(
                JSON.stringify({
                    type: "input_audio_buffer.append",
                    audio: data.media.payload,
                })
            );
        }

        // Start signal from Twilio
        if (data.event === "start") {
            console.log("Stream started");
        }
    });

    // OpenAI → Twilio (audio back)
    openAiWs.on("message", (message) => {
        let response;

        try {
            response = JSON.parse(message.toString());
        } catch (e) {
            return;
        }

        // Audio chunk from OpenAI
        if (
            response.type === "response.audio.delta" &&
            response.delta &&
            ws.readyState === WebSocket.OPEN
        ) {
            ws.send(
                JSON.stringify({
                    event: "media",
                    media: {
                        payload: response.delta,
                    },
                })
            );
        }
    });

    // Cleanup
    ws.on("close", () => {
        console.log("Twilio disconnected");
        openAiWs.close();
    });

    openAiWs.on("close", () => {
        console.log("OpenAI disconnected");
        ws.close();
    });

    openAiWs.on("error", (err) => {
        console.error("OpenAI error:", err);
    });
});
