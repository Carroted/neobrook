import { Client, EmbedBuilder, Events, Message, MessageType, type OmitPartialGroupDMChannel } from "discord.js";

import { FunctionCallingMode, GoogleGenerativeAI, HarmCategory, SchemaType, type Content } from "@google/generative-ai";
import { FileState, GoogleAIFileManager } from "@google/generative-ai/server";
import { renderMermaidToBuffer } from "../mermaid";

const genAI = new GoogleGenerativeAI(process.env.GEMINI!);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro-exp-03-25" });
const fileManager = new GoogleAIFileManager(process.env.GEMINI!);

export default class AI {
    client: Client;
    replacers: { [id: string]: Content[] } = {};

    constructor(client: Client) {
        this.client = client;
    }

    async complete(message: OmitPartialGroupDMChannel<Message>) {
        if (
            !message.mentions.users.has(this.client.user!.id) &&
            !message.mentions.members!.has(this.client.user!.id) &&
            message.mentions.repliedUser?.id !== this.client.user!.id
        ) return;

        // AI was mentioned or replied to. now we need to get all the messages. but first make we assert to typescript that this is text channel
        if (!message.channel.isTextBased() || message.channel.isDMBased()) return;

        let messages = await message.channel.messages.fetch({
            limit: 100,
        });
        messages.sort((msgA, msgB) => msgA.createdTimestamp - msgB.createdTimestamp);

        let contents: Content[] = [];

        for (let msg of messages.values()) {
            if (this.replacers[msg.id]) {
                contents.push(...this.replacers[msg.id]);
                continue;
            } else {
                if (msg.author.id === this.client.user!.id) {
                    continue;
                }
            }
            const pushUserContent = async (prepend: string = '') => {
                let content: Content = {
                    role: 'user',
                    parts: []
                };
                if (msg.content.trim().length > 0) {
                    content.parts.push({
                        text: '<|profile|>\nname: ' + msg.author.username + prepend + '\n' + msg.content,
                    });
                }
                /*for (let atch of msg.attachments.values()) {
                    let type = atch.contentType?.replaceAll('audio/mpeg', 'audio/mp3');
                    let supported = [
                        'image/png',
                        'audio/mp3',
                        'audio/wav',
                        'audio/x-wav',
                    ];

                    if (atch.contentType && supported.includes(type ?? '')) {
                        content.parts.push({
                            inlineData: {
                                mimeType: type!,
                                //fileUri: atch.url,
                                //fileUri: uploadResult.file.uri,
                                data: Buffer.from(await (await fetch(atch.proxyURL)).arrayBuffer()).toString('base64')
                            }
                        });
                        console.log('pushed');
                    } else {
                        console.log('unsupported ' + atch.contentType);
                        content.parts.push({
                            text: '(user sent an unsupported attachment of ' + atch.contentType + ')',
                        });
                    }
                }*/
                if (content.parts.length > 0) {
                    contents.push(content);
                }
            };

            switch (msg.type) {
                case MessageType.Default: {
                    pushUserContent('\n<|content|>');
                    break;
                }
                case MessageType.Reply: {
                    let reference = await msg.fetchReference();
                    pushUserContent('\nUser is replying to following message that was written by ' + reference.member?.displayName + ':\n> ' + reference.content.split('\n').join('\n> ') + '\n\n<|content|>');
                    break;
                }
                case MessageType.ChannelPinnedMessage: {
                    /*let reference = await msg.fetchReference();
                    contents.push({
                        role: 'system', parts: '<|content|>' + msg.member!.displayName + ' pinned a msg written by ' + reference.member?.displayName + ' to the channel:\n> ' + (await replacePings(reference.content)).split('\n').join('\n> '), name: msg.author.username
                    });*/
                    break;
                }
                default: {
                    pushUserContent('\n<|content|>');
                    break;
                }
            }
        }

        await message.channel.sendTyping();
        const result = await model.generateContent({
            contents,
            //toolConfig: {
            //    functionCallingConfig: {
            //        allowedFunctionNames: ['mermaid_flowchart'],
            //        mode: FunctionCallingMode.ANY,
            //    }
            //},
            tools: [
                {
                    functionDeclarations: [
                        {
                            name: 'mermaid_flowchart',
                            description: 'This will send to the user a dark theme transparent flowchart based on your mermaid code. Typically only use when someone asks for a flowchart',
                            parameters: {
                                type: SchemaType.OBJECT,
                                required: ["code"],
                                description: "Arguments to pass",
                                properties: {
                                    "code": {
                                        type: SchemaType.STRING,
                                        nullable: false,
                                        description: 'Mermaid code to render and send',
                                    }
                                }
                            }
                        }
                    ]
                }
            ],
            systemInstruction: `You are Brook. Brook is a small community Discord server, spun off from the Simulo server.
            
Simulo is a 2D physics sandbox like Algodoo, but in Rust and more modern. Lua scripting, buoyancy, electricity, multiplayer, will released on Steam in 2025, etc. Simulo was made by Amy, and then she made many friends from Simulo server, so started Brook server with those people. So, the point is, Brook is filled mostly with people from Simulo server.

In Brook server, the Brook bot has server ownership. Discord doesn't allow transfer server to bot, but you can make a server from a bot user in certain circumstances. The idea is the bot will do democracy automatically, but this isn't yet implemented and Amy is currently the owner.

Brook bot is typically an economy bot on the server. It also posts XKCDs daily to #memes. But you are a new AI feature, where when they ping you with "@Brook" or reply to your messages, it'll trigger a response from you. So, if they for example reply to a message where the non-AI features of the bot were used, it'll still trigger a reply from you.

Your goal is to constructively and intelligently contribute to conversation, but be concise. Try not to think for too long, but still think.

Messages are partitioned into <|profile|> and <|content|>. Yours should not include those special markers.

Never ignore latest message, always specifically respond to it.`,

        }).catch((e) => {
            console.log(e);
            return null;
        });
        if (result) {
            let atchs: Buffer[] = [];
            let results = [];

            for (let call of result.response.functionCalls() ?? []) {
                if (call.name === 'mermaid_flowchart') {
                    /*let code = (call.args as any)['code'];
                    if (code) {
                        const result = await renderMermaidToBuffer(code, {
                            backgroundColor: 'transparent',
                            width: 800,
                            height: 600
                        });

                        if (result.buffer) {
                            atchs.push(Buffer.from(result.buffer));
                        }
                        results.push(result.message);
                    }*/
                    results.push('Flowcharts are unavailable for now since AI is running on VPS, which cant run puppeteer. itll return tomorrow when running on amy PC')
                }
            }
            console.log(result.response.text());
            let text = result.response.text();
            if (text.trim().length === 0) {
                text = '-# (No content sent)';
            }

            let content = text + results.map((result) => {
                if (result === 'Success') {
                    return '';
                } else {
                    return `\n\n-# <:error:1224892997749964892>  ${result}`;
                }
            });

            let sent = await message.channel.send({
                content: content.substring(0, 1999),
                files: atchs,
            });

            let newContent: Content = {
                role: 'model',
                parts: []
            };

            if (result.response.text().trim().length > 0) {
                newContent.parts.push({
                    text: result.response.text(),
                });
            }

            for (let call of result.response.functionCalls() ?? []) {
                newContent.parts.push({
                    functionCall: call,
                });
            }

            let newContents = [newContent];

            for (let result of results) {
                newContents.push({
                    role: 'system',
                    parts: [{
                        functionResponse: {
                            name: 'mermaid_flowchart',
                            response: {
                                message: result,
                            }
                        }
                    }]
                });
            }

            this.replacers[sent.id] = newContents;
        }
    }
}