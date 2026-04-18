import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.urlencoded({ extended: true }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.post("/voice", async (req, res) => {
    res.type("text/xml");
    try {
        // Тестовий запит до OpenAI
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: "Say: Your key is working" }],
        });
        
        const responseText = completion.choices[0].message.content;

        res.send(`
            <Response>
                <Say voice="Polly.Joanna" language="en-US">
                    Connection successful. OpenAI says: ${responseText}
                </Say>
                <Hangup/>
            </Response>
        `);
    } catch (error) {
        res.send(`
            <Response>
                <Say>Error. Your AI key is not working. Check your balance or key status.</Say>
                <Hangup/>
            </Response>
        `);
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 Test server on port ${PORT}`));
