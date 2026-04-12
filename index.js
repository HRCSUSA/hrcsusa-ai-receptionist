import express from "express";
import { WebSocketServer } from "ws";
import WebSocket from "ws";

const app = express();
const PORT = process.env.PORT || 8080;

// ======================
// Middleware
// ======================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================
// Routes
// ======================
app.get("/", (req, res) => {
    res.send("HRCS USA AI is Active!");
});

app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

// ======================
// Twilio Webhook
// ======================
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

// ======================
// Server
// ======================
const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on ${PORT}`);
});

// ======================
// WebSocket Server
// ======================
const wss = new WebSocketServer({
    server,
    path: "/media-stream",
});

// ======================
// STATE
// ======================
let isOpenAiReady = false;
let audioBuffer = [];
let started = false;

// ======================
// CONNECTION
// ======================
wss.on("connection", (ws) => {
    console.log("📞 Twilio connected");

    const openAiWs = new WebSocket(
        "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01",
        {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "OpenAI-Beta": "realtime=v1",
            },
        }
    );

    // ======================
    // OPENAI CONNECT
    // ======================
    openAiWs.on("open", () => {
        isOpenAiReady = true;
        console.log("🧠 OpenAI connected");

        openAiWs.send(JSON.stringify({
            type: "session.update",
            session: {
                instructions:
                    "You are a professional phone receptionist for HRCS USA in Katy, Texas. Collect name, address, and service type (Garage doors, Electrical, TV mounting). Ask one question at a time. Be short and polite.",
                voice: "alloy",
                input_audio_format: "g711_ulaw",
                output_audio_format: "g711_ulaw",
            },
        }));
    });

    // ======================
    // TWILIO → OPENAI
    // ======================
    ws.on("message", (message) => {
        let data;

        try {
            data = JSON.parse(message.toString());
        } catch {
            return;
        }

        if (data.event === "media") {
            const audio = data.media.payload;

            if (!isOpenAiReady) {
                audioBuffer.push(audio);
                return;
            }

            openAiWs.send(JSON.stringify({
                type: "input_audio_buffer.append",
                audio,
            }));

            // flush buffer once OpenAI is ready
            if (audioBuffer.length > 0) {
                for (const chunk of audioBuffer) {
                    openAiWs.send(JSON.stringify({
                        type: "input_audio_buffer.append",
                        audio: chunk,
                    }));
                }
                audioBuffer = [];
            }

            // IMPORTANT FIX: commit ONLY once stream starts
            if (!started) {
                started = true;

                openAiWs.send(JSON.stringify({
                    type: "input_audio_buffer.commit"
                }));
            }
        }

        if (data.event === "start") {
            console.log("🎙️ Stream started");
        }
    });

    // ======================
    // OPENAI → TWILIO
    // ======================
    openAiWs.on("message", (message) => {
        let response;

        try {
            response = JSON.parse(message.toString());
        } catch {
            return;
        }

        if (
            response.type === "response.audio.delta" &&
            response.delta &&
            ws.readyState === WebSocket.OPEN
        ) {
            ws.send(JSON.stringify({
                event: "media",
                media: {
                    payload: response.delta,
                },
            }));
        }
    });

    // ======================
    // CLEANUP
    // ======================
    ws.on("close", () => {
        console.log("📞 Twilio disconnected");
        openAiWs.close();
    });

    openAiWs.on("close", () => {
        console.log("🧠 OpenAI disconnected");
        ws.close();
    });

    openAiWs.on("error", (err) => {
        console.error("OpenAI error:", err);
    });
});
