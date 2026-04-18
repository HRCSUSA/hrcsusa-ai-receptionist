import express from "express";
import OpenAI from "openai";

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ===============================
// STATE (CRM MEMORY)
// ===============================
let session = {
    phase: "problem", // початкова фаза
    lead: {
        name: "",
        phone: "",
        address: "",
        service: "",
        issue: "",
        details: "",
        datetime: ""
    }
};

// ===============================
// VOICE ENTRY (START CALL)
// ===============================
app.post("/voice", (req, res) => {
    res.type("text/xml");

    session.phase = "problem"; // починаємо з фази "problem"
    session.lead = {}; // скидаємо дані клієнта

    res.send(`
<Response>
    <Say voice="Polly.Joanna-Neural" language="en-US">
        Thank you for calling HRCS USA. Tell me what issue you're experiencing.
    </Say>

    <Gather input="speech" action="/respond" method="POST" language="en-US" speechTimeout="auto" timeout="8"/>
</Response>
    `);
});

// ===============================
// PHASE CONTROLLER (SERVER DECIDES FLOW)
// ===============================
function getNextPhase(current) {
    const order = ["problem", "details", "contact", "scheduling", "done"];
    const index = order.indexOf(current);
    return order[Math.min(index + 1, order.length - 1)];
}

// ===============================
// MAIN HANDLER
// ===============================
app.post("/respond", async (req, res) => {
    const userSpeech = req.body.SpeechResult || "";

    res.type("text/xml");

    try {

        // ===============================
        // AI EXTRACTION ONLY (NO FLOW CONTROL)
        // ===============================
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `
Extract structured data from customer speech.

Return JSON:
{
  "reply": "natural short human response",
  "service": "",
  "issue": "",
  "details": "",
  "name": "",
  "phone": "",
  "address": ""
}

Rules:
- DO NOT control conversation flow.
- ONLY extract info + generate a natural reply.
- Keep it human-like and concise.
                    `
                },
                {
                    role: "system",
                    content: `
CURRENT STATE:
Phase: ${session.phase}
Lead: ${JSON.stringify(session.lead)}
                    `
                },
                {
                    role: "user",
                    content: userSpeech
                }
            ]
        });

        let ai;

        // ===============================
        // SAFE JSON PARSE (CRITICAL FIX)
        // ===============================
        try {
            ai = JSON.parse(completion.choices[0].message.content);
        } catch (e) {
            ai = { reply: "Could you repeat that, please?" };
        }

        // ===============================
        // UPDATE CRM DATA
        // ===============================
        session.lead = {
            ...session.lead,
            ...ai
        };

        // ===============================
        // SERVER CONTROLS FLOW (PRO LOGIC)
        // ===============================
        if (session.phase === "problem") {
            session.phase = "details"; // після проблеми йдемо до деталей
        } else if (session.phase === "details") {
            if (ai.issue && ai.issue.length > 3) {
                session.phase = "contact"; // коли проблема зрозуміла — переходимо до контактів
            }
        } else if (session.phase === "contact") {
            if (session.lead.name && session.lead.phone && session.lead.address) {
                session.phase = "scheduling"; // після контактів — бронювання
            }
        }

        const responseText = escapeXml(ai.reply || "Okay, please continue.");

        res.send(`
<Response>
    <Say voice="Polly.Joanna-Neural" language="en-US">
        ${responseText}
    </Say>

    <Pause length="1"/>

    <Gather input="speech" action="/respond" method="POST" language="en-US" speechTimeout="auto" timeout="8"/>
</Response>
        `);

    } catch (error) {
        console.error(error);

        res.send(`
<Response>
    <Say voice="Polly.Joanna-Neural" language="en-US">
        Sorry, there was an issue. Please try again later.
    </Say>
</Response>
        `);
    }
});

// ===============================
function escapeXml(text = "") {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

// ===============================
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log("🚀 HRCS PRO AI SYSTEM RUNNING");
});
