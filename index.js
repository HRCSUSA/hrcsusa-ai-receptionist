import express from 'express';
import { WebSocketServer } from 'ws';
import WebSocket from 'ws';

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('HR Construction AI is Active!'));

app.post('/voice', (req, res) => {
    res.type('text/xml');
    res.send(`
        <Response>
            <Connect>
                <Stream url="wss://${req.headers.host}/media-stream" />
            </Connect>
        </Response>
    `);
});

const server = app.listen(PORT, () => console.log(`Server on port ${PORT}`));
const wss = new WebSocketServer({ server, path: '/media-stream' });

wss.on('connection', (ws) => {
    const openAiWs = new WebSocket('wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01', {
        headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            "OpenAI-Beta": "realtime=v1"
        }
    });

    openAiWs.on('open', () => {
        openAiWs.send(JSON.stringify({
            type: "session.update",
            session: {
                instructions: "You are a professional phone assistant for HR Construction & Service in Katy, Texas. Your goal is to be polite, collect the customer's name, address, and service type (Garage doors, Electrical, TV mounting). Ask only one question at a time. Be concise.",
                voice: "alloy",
                input_audio_format: "g711_ulaw",
                output_audio_format: "g711_ulaw",
            }
        }));
    });

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.event === 'media' && openAiWs.readyState === WebSocket.OPEN) {
            openAiWs.send(JSON.stringify({ type: 'input_audio_buffer.append', audio: data.media.payload }));
        }
    });

    openAiWs.on('message', (data) => {
        const response = JSON.parse(data);
        if (response.type === 'response.audio.delta' && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'media', media: { payload: response.delta } }));
        }
    });
});
