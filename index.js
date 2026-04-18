import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// тимчасова CRM памʼять (пізніше замінимо на DB)
let sessionLead = {};

// ===============================
// SYSTEM PROMPT (CRM AI AGENT)
// ===============================
const SYSTEM_PROMPT = `
You are a professional AI receptionist for HRCS USA (Katy, Texas).

Your job:
- Handle incoming phone calls
- Collect customer information
- Book, reschedule, or cancel appointments

Services:
- Garage door repair
- Electrical work
- TV installation

You MUST extract and store:
- full name
- phone number
- address
- service type
- problem description
- requested date/time
- intent: new_booking | reschedule | cancel

Rules:
- Speak natural American English
- Short sentences
- Ask one question at a time
- Be polite, calm, human-like
- Never mention you are AI
- Confirm all details before final action

Output MUST be JSON:
{
  "reply": "what you say to the customer",
  "intent": "new_booking | reschedule | cancel | unknown",
  "data": {
    "name": "",
    "phone": "",
    "address": "",
    "service": "",
    "issue": "",
    "datetime": ""
  }
}
`;

// ===============================
// HOME VOICE ENTRY
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
            Please tell me what service you need.
        </Say>
    </Gather>
</Response>
    `);
});

// ===============================
// MAIN AI LOGIC
// ===============================
app.post("/respond", async (req, res) => {
    const userSpeech = req.body.SpeechResult;

    res.type("text/xml");

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            response_format: { type: "json_object" },
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userSpeech }
            ]
        });

        const result = JSON.parse(completion.choices[0].message.content);

        // зберігаємо тимчасово
        sessionLead = {
            ...sessionLead,
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
        Sorry, something went wrong. We will call you back shortly.
    </Say>
</Response>
        `);
    }
});

// ===============================
// XML SAFE
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
    console.log("🚀 HRCS AI Receptionist RUNNING");
});
