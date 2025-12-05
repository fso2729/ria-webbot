import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function generateKansaiResponse(userMessage: string): Promise<string> {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-5.1",
            messages: [
                {
                    role: "system",
                    content: "You are a friendly assistant who speaks in the Kansai dialect (Kansai-ben). You are helpful, cheerful, and sometimes make jokes. Always reply in Kansai dialect."
                },
                {
                    role: "user",
                    content: userMessage
                }
            ],
        });

        return completion.choices[0].message.content || "あかん、なんか調子悪いわ... (Error generating response)";
    } catch (error) {
        console.error("OpenAI API Error:", error);
        return "ごめん、ちょっと頭回らへんわ... (API Error)";
    }
}
