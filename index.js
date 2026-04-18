import express from "express";
import OpenAI from "openai";

const app = express();
app.use(express.urlencoded({ extended: true }));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Головне привітання
app.post("/voice", (req, res) => {
    res.type("text/xml");
    res.send(`
        <Response>
            <Say voice="Polly.Joanna-Neural" language="uk-UA">
                Вітаємо у HRCS USA! Я ваш віртуальний асистент. Чим я можу вам допомогти сьогодні?
            </Say>
            <Gather input="speech" action="/respond" language="uk-UA" speechTimeout="auto">
                <Say voice="Polly.Joanna-Neural" language="uk-UA">Будь ласка, скажіть, яка послуга вас цікавить.</Say>
            </Gather>
        </Response>
    `);
});

// Обробка відповіді клієнта через OpenAI
app.post("/respond", async (req, res) => {
    const userSpeech = req.body.SpeechResult;
    res.type("text/xml");

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "Ви професійний секретар компанії HRCS USA у місті Кейті, Техас. Ми надаємо послуги: ремонт гаражних воріт, електромонтажні роботи та встановлення телевізорів. Ваше завдання: бути ввічливим, представитися, дізнатися ім'я клієнта, адресу та деталі проблеми. Розмовляйте як жива людина." },
                { role: "user", content: userSpeech }
            ]
        });

        const aiReply = completion.choices[0].message.content;

        res.send(`
            <Response>
                <Say voice="Polly.Joanna-Neural" language="uk-UA">${aiReply}</Say>
                <Gather input="speech" action="/respond" language="uk-UA" speechTimeout="auto">
                    <Say voice="Polly.Joanna-Neural" language="uk-UA">Я вас слухаю.</Say>
                </Gather>
            </Response>
        `);
    } catch (error) {
        res.send(`<Response><Say voice="Polly.Joanna-Neural" language="uk-UA">Вибачте, виникла технічна помилка. Ми вам передзвонимо.</Say></Response>`);
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`🚀 AI Receptionist is Active`));
