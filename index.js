import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// CRM Layer: Тимчасове сховище даних у пам'яті
const activeCalls = new Map();

const SYSTEM_PROMPT = `
You are the Executive AI Dispatcher for HRCS USA in Katy, Texas. 
Your goal is to handle incoming service calls professionally in English.

SERVICES:
- Garage door repair, Electrical work, TV installation, Appliance Repair, Security Systems, Locksmith, Furniture Assembly, General Mounting.

CONVERSATION LOGIC:
1. Greet: "HRCS USA, how can I help you today?"
2. Identify the service needed.
3. Get the Customer's Name.
4. Get the Address in Katy, TX.
5. Once all info is collected, say: "Thank you, a specialist will contact you shortly. Goodbye!" and add the tag [LEAD_COMPLETE].
`;

app.post("/voice", (req, res) => {
    const callSid = req.body.CallSid;
    activeCalls.set(callSid, { data: "" });

    res.type("text/xml");
    res.send(`
        <Response>
            <Say voice="Polly.Joanna-Neural" language="en-US">
                Thank you for calling HRCS USA. How can I help you?
            </Say>
            <Gather input="speech" action="/respond" language="en-US" speechTimeout="auto" />
        </Response>
    `);
});

app.post("/respond", async (req, res) => {
    const callSid = req.body.CallSid;
    const userSpeech = req.body.SpeechResult;

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: userSpeech }
            ]
        });

        const aiReply = completion.choices[0].message.content;

        res.type("text/xml");
        if (aiReply.includes("[LEAD_COMPLETE]")) {
            res.send(`
                <Response>
                    <Say voice="Polly.Joanna-Neural" language="en-US">${aiReply.replace("[LEAD_COMPLETE]", "")}</Say>
                    <Hangup/>
                </Response>
            `);
        } else {
            res.send(`
                <Response>
                    <Gather input="speech" action="/respond" language="en-US" speechTimeout="auto">
                        <Say voice="Polly.Joanna-Neural" language="en-US">${aiReply}</Say>
                    </Gather>
                    <Redirect>/respond</Redirect>
                </Response>
            `);
        }
    } catch (error) {
        res.send(`<Response><Hangup/></Response>`);
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 English AI Engine is Active`));
