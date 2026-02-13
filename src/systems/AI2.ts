import { Client, EmbedBuilder, Events, Message, MessageType, TextChannel, type OmitPartialGroupDMChannel } from "discord.js";

import ollama from 'ollama';

interface ConversationItem {
    role: 'user' | 'bot';
    content: string;
    username: string;
}

async function generateResponse(history: ConversationItem[]): Promise<string> {
    console.log("--- Chain Context ---");
    // console.log(history); // View the chain in your console
    const c = await ollama.chat({
        model: 'brooktop', // This is correct, its a custom model added locally
        keep_alive: '10h',
        messages: history.map(item => ({
            role: item.role === 'user' ? 'user' : 'assistant',
            content: item.content,
        })),
        stream: false,
    })
    console.log("---------------------");
    
    // In a real app, you would send 'history' to OpenAI/Anthropic here
    return c.message.content;
}

export default class AI2 {
    client: Client;

    constructor(client: Client) {
        this.client = client;
    }

    async complete(message: OmitPartialGroupDMChannel<Message>) {
        const isMentioned = message.mentions.users.has(this.client.user!.id);
        
        let isReplyToBot = false;
        
        // If it's a reply, we need to check who they replied to
        if (message.reference?.messageId) {
            try {
                // We fetch the referenced message to check the author
                const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
                if (referencedMessage.author.id === this.client.user!.id) {
                    isReplyToBot = true;
                }
            } catch (error) {
                // Referenced message might be deleted or inaccessible
                // We proceed as false
            }
        }

        // 3. Trigger Logic
        if (isMentioned || isReplyToBot) {
            await message.channel.sendTyping();

            const conversationChain: ConversationItem[] = [];
            let currentMsg: Message | null = message;
            let depthCounter = 0;
            const MAX_DEPTH = 10; // Prevent infinite loops or massive API fetches

            const botId = this.client.user!.id;
            const mentionRegex = new RegExp(`<@!?${botId}>`, 'g');
            // 4. Build the Chain (Backwards traversal)
            while (currentMsg && depthCounter < MAX_DEPTH) {
                // --- CLEANING LOGIC START ---
                let cleanContent = currentMsg.content;

                // Only clean the mentions if this message is from a USER. 
                // (Usually we keep bot's own output as is, but you can clean both if you want)
                if (currentMsg.author.id !== botId) {
                    cleanContent = cleanContent.replace(mentionRegex, '').trim();
                }
                // --- CLEANING LOGIC END ---

                // Only push if there is content left (optional, but good for empty pings)
                if (cleanContent.length > 0 || currentMsg.attachments.size > 0) {
                     conversationChain.push({
                        role: currentMsg.author.id === botId ? 'bot' : 'user',
                        content: cleanContent,
                        username: currentMsg.author.username
                    });
                }

                // Move to parent
                if (currentMsg.reference?.messageId) {
                    try {
                        currentMsg = await currentMsg.channel.messages.fetch(currentMsg.reference.messageId);
                    } catch (err) {
                        currentMsg = null;
                    }
                } else {
                    currentMsg = null;
                }
                depthCounter++;
            }

            // 5. Reverse to get chronological order (Oldest -> Newest)
            conversationChain.reverse();

            // 6. Generate and Reply
            const response = await generateResponse(conversationChain);
            await message.reply(response);
        }
    }
}