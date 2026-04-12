import express from "express";
import { WebSocketServer } from "ws";
import WebSocket from "ws";

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
    res.send("HRCS USA AI is Active!");
});

app.get("/health", (req, res) => {
    res.status(200).send("OK");
});

// Twilio Webhook
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

// Server
const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

// WebSocket Server
const wss = new WebSocketServer({
    server,
    path: "/media-stream",
});

wss.on("connection", (ws) => {
    console.log("📞 Twilio: Connection established");

    // Змінні стану всередині підключення (для кожного дзвінка свої)
    let isOpenAiReady = false;
    let audioBuffer = [];
    let started = false;

    const openAiWs = new WebSocket(
        "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview",
        {
            headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
                "OpenAI-Beta": "realtime=v1",
            },
        }
    );

    // OpenAI Connection Open
    openAiWs.on("open", () => {
        isOpenAiReady = true;
        console.log("🧠 OpenAI: Connected");

        openAiWs.send(JSON.stringify({
            type: "session.update",
            session: {
                instructions: "You are a professional phone receptionist for HRCS USA in Katy, Texas. Collect customer's name, address, and service type (Garage doors, Electrical, TV mounting). Ask only one question at a time. Be concise and polite.",
                voice: "alloy",
                input_audio_format: "g711_ulaw",
                output_audio_format: "g711_ulaw",
                modalities: ["text", "audio"]
            },
        }));
    });

    // Twilio -> OpenAI
    ws.on("message", (message) => {
        let data;
        try {
            data = JSON.parse(message.toString());
        } catch (e) {
            return;
        }

        if (data.event === "media") {
            const audio = data.media.payload;

            if (!isOpenAiReady) {
                audioBuffer.push(audio);
                return;
            }

            // Відправка залишків з буфера
            if (audioBuffer.length > 0) {
                audioBuffer.forEach(chunk => {
                    openAiWs.send(JSON.stringify({
                        type: "input_audio_buffer.append",
                        audio: chunk,
                    }));
                });
                audioBuffer = [];
            }

            openAiWs.send(JSON.stringify({
                type: "input_audio_buffer.append",
                audio: audio,
            }));

            if (!started) {
                started = true;
                openAiWs.send(JSON.stringify({
                    type: "input_audio_buffer.commit"
                }));
            }
        }

        if (data.event === "start") {
            console.log("🎙️ Twilio: Media stream started");
        }
    });

    // OpenAI -> Twilio
    openAiWs.on("message", (message) => {
        let response;
        try {
            response = JSON.parse(message.toString());
        } catch (e) {
            return;
        }

        if (response.type === "response.audio.delta" && response.delta && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                event: "media",
                media: {
                    payload: response.delta,
                },
            }));
        }
    });

    // Cleanup
    ws.on("close", () => {
        console.log("📞 Twilio: Disconnected");
        if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
    });

    openAiWs.on("close", () => {
        console.log("🧠 OpenAI: Disconnected");
        if (ws.readyState === WebSocket.OPEN) ws.close();
    });

    openAiWs.on("error", (err) => {
        console.error("❌ OpenAI Error:", err.message);
    });
});
