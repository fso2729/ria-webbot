import { Client, GatewayIntentBits, Events } from 'discord.js';
import dotenv from 'dotenv';
import { generateKansaiResponse } from './openai';

dotenv.config({ path: '.env.local' });

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

client.once(Events.ClientReady, (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    try {
        const response = await generateKansaiResponse(message.content);
        await message.reply(response);
    } catch (error) {
        console.error("Error handling message:", error);
        await message.reply("すまん、なんかエラー出てもうたわ。");
    }
});

const token = process.env.DISCORD_TOKEN;

if (!token) {
    console.error("DISCORD_TOKEN is not defined in .env.local");
    process.exit(1);
}

client.login(token);
