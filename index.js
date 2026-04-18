import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// СИСТЕМА CRM (Тимчасова, поки не підключимо Telegram/Make)
const leads = new Map(); 

const SYSTEM_PROMPT = `
You are a professional HRCS USA dispatcher. 
Follow these logical steps:
1. Greet and identify which of our services they need.
2. Ask for their Name and Address in Katy, TX.
3. Once you have the info, end the call professionally.

SERVICES: Garage Doors, Electrical, TV Installation, Appliances, Security, Locksmith, Furniture Assembly, General Mounting.

OUTPUT FORMAT: Always respond in Ukrainian or English (match the customer). 
If you have collected Name, Service, and Address, include the tag [LEAD_COMPLETE] at the end.
`;

app.post("/voice", (req, res) => {
    const callSid = req.body.CallSid;
    leads.set(callSid, { name: "", service: "", address: "" }); // Створюємо запис у CRM

    res.type("text/xml");
    res.send(`
        <Response>
            <Say voice="Polly.Joanna-Neural" language="uk-UA">Вітаємо у HRCS USA! Яку послугу ви шукаєте?</Say>
            <Gather input="speech" action="/respond" language="uk-UA" speechTimeout="auto" />
        </Response>
    `);
});

app.post("/respond", async (req, res) => {
    const callSid = req.body.CallSid;
    const userSpeech = req.body.SpeechResult;
    const currentLead = leads.get(callSid);

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: `Customer said: ${userSpeech}. Current data: ${JSON.stringify(currentLead)}` }
            ]
        });

        const aiReply = completion.choices[0].message.content;

        // ЛОГІКА CRM: Якщо дані зібрані
        if (aiReply.includes("[LEAD_COMPLETE]")) {
            console.log("🎯 НОВИЙ ЛІД СФОРМОВАНО:", currentLead);
            // ТУТ МИ БУДЕМО ВІДПРАВЛЯТИ В TELEGRAM
            res.type("text/xml");
            res.send(`
                <Response>
                    <Say voice="Polly.Joanna-Neural" language="uk-UA">${aiReply.replace("[LEAD_COMPLETE]", "")}</Say>
                    <Hangup/>
                </Response>
            `);
        } else {
            res.type("text/xml");
            res.send(`
                <Response>
                    <Gather input="speech" action="/respond" language="uk-UA" speechTimeout="auto">
                        <Say voice="Polly.Joanna-Neural" language="uk-UA">${aiReply}</Say>
                    </Gather>
                </Response>
            `);
        }
    } catch (error) {
        res.send(`<Response><Hangup/></Response>`);
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Professional Engine Running`));
