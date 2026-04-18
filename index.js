import express from "express";
import OpenAI from "openai";

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ===============================
// SERVER STATE (ВАЖЛИВО)
// ===============================
let sessionState = {
    phase: "problem",
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
// SYSTEM PROMPT (FLOW CONTROLLED)
// ===============================
const SYSTEM_PROMPT = `
You are a professional phone dispatcher for HRCS USA (Katy, Texas).

IMPORTANT:
You are continuing an ongoing phone conversation.
Do NOT restart the flow.
Follow the current phase from server state.

FLOW:

PHASE 1 - PROBLEM:
- Let customer describe issue
- Ask follow-up questions about problem
- Do NOT ask for personal info

PHASE 2 - DETAILS:
- Clarify job details (size, damage, urgency, location of issue)

PHASE 3 - CONTACT:
ONLY AFTER full understanding:
- Ask full name
- Then phone number
- Then address

PHASE 4 - SCHEDULING:
- Discuss appointment time
- Prepare booking

RULES:
- Ask ONE question at a time
- Keep responses short and natural
- Act like a real dispatcher
- Never overwhelm customer
- Never collect contact info too early

SERVICES:
- Garage door repair
- Electrical work
- TV installation
- Appliance Installation & Repair
- Security Systems & Access Control
- Door Hardware & Locksmith
- Furniture Assembly
- General Mounting Services

OUTPUT FORMAT (STRICT JSON):
{
  "reply": "what you say to customer",
  "phase": "problem | details | contact | scheduling | done",
  "data": {
    "name": "",
    "phone": "",
    "address": "",
    "service": "",
    "issue": "",
    "details": "",
    "datetime": ""
  }
}
`;

// ===============================
// VOICE ENTRY
// ===============================
app.post("/voice", (req, res) => {
    res.type("text/xml");
    res.send(`
<Response>
    <Say voice="Polly.Joanna-Neural" language="en-US">
        Hello! Thank you for calling H R C S USA. How can I help you today?
    </Say>

    <Gather input="speech" action="/respond" language="en-US" speechTimeout="auto">
        <Say voice="Polly.Joanna-Neural" language="en-US">
            Please describe the issue you're having.
        </Say>
    </Gather>
</Response>
    `);
});

// ===============================
// MAIN AI FLOW
// ===============================
app.post("/respond", async (req, res) => {
    const userSpeech = req.body.SpeechResult;

    res.type("text/xml");

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: SYSTEM_PROMPT
                },
                {
                    role: "system",
                    content: `
CURRENT STATE:
Phase: ${sessionState.phase}
Lead Data: ${JSON.stringify(sessionState.lead)}
                    `
                },
                {
                    role: "user",
                    content: userSpeech
                }
            ]
        });

        const result = JSON.parse(completion.choices[0].message.content);

        // ===============================
        // UPDATE STATE
        // ===============================
        sessionState.phase = result.phase;

        sessionState.lead = {
            ...sessionState.lead,
            ...result.data
        };

        const reply = escapeXml(result.reply);

        res.send(`
<Response>
    <Say voice="Polly.Joanna-Neural" language="en-US">
        ${reply}
    </Say>

    <Pause length="1"/>

    <Gather input="speech" action="/respond" language="en-US" speechTimeout="auto">
        <Say voice="Polly.Joanna-Neural" language="en-US">
            I'm listening.
        </Say>
    </Gather>
</Response>
        `);

    } catch (error) {
        console.error(error);

        res.send(`
<Response>
    <Say voice="Polly.Joanna-Neural" language="en-US">
        Sorry, there was a technical issue. We will contact you shortly.
    </Say>
</Response>
        `);
    }
});

// ===============================
// XML SAFE FUNCTION
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
    console.log("🚀 HRCS USA AI Receptionist RUNNING");
});
