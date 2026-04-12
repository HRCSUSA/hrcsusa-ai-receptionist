import express from "express";
import { WebSocketServer } from "ws";
import WebSocket from "ws";

const app = express();
const PORT = process.env.PORT || 8080;

app.get("/", (req, res) => res.send("HRCS USA AI is Active!"));
app.post("/voice", (req, res) => {
    res.type("text/xml");
    res.send(`<Response><Connect><Stream url="wss://${req.headers.host}/media-stream" /></Connect></Response>`);
});

const server = app.listen(PORT, "0.0.0.0", () => console.log(`🚀 Server running on port ${PORT}`));
const wss = new WebSocketServer({ server, path: "/media-stream" });

wss.on("connection", (ws) => {
    console.log("📞 Twilio: Connection established");

    // Пряме підключення до моделі без дати
    const openAiWs = new WebSocket("wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview", {
        headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "OpenAI-Beta": "realtime=v1",
        },
    });

    openAiWs.on("open", () => {
        console.log("🧠 OpenAI: Connected");
        // Налаштування сесії
        openAiWs.send(JSON.stringify({
            type: "session.update",
            session: {
                instructions: "You are a professional receptionist for HRCS USA. Be brief and polite.",
                voice: "alloy",
                input_audio_format: "g711_ulaw",
                output_audio_format: "g711_ulaw",
                modalities: ["text", "audio"],
                turn_detection: { type: "server_vad" } // Додаємо автоматичне визначення мови
            }
        }));
    });

    ws.on("message", (message) => {
        const data = JSON.parse(message);
        if (data.event === "media" && openAiWs.readyState === WebSocket.OPEN) {
            openAiWs.send(JSON.stringify({
                type: "input_audio_buffer.append",
                audio: data.media.payload
            }));
        }
    });

    openAiWs.on("message", (message) => {
        const response = JSON.parse(message);
        if (response.type === "response.audio.delta" && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: "media", media: { payload: response.delta } }));
        }
    });

    ws.on("close", () => openAiWs.close());
    openAiWs.on("close", () => console.log("🧠 OpenAI: Disconnected"));
    openAiWs.on("error", (e) => console.error("❌ OpenAI Error:", e.message));
});
