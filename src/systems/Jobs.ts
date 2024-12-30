import { ChannelType, Client, EmbedBuilder, Events, Message, TextChannel, User, type OmitPartialGroupDMChannel, type TextBasedChannel } from "discord.js";

import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';

interface Item {
    name: string,
    price: number,
    emoji: string,
}

type Quirk = "lowercase" | "screaming" | "leet" | "expletives" | "hashtag" | "dumb";

export default class Jobs { // Steven Paul
    client: Client;

    constructor(client: Client) {
        this.client = client;

        return;

        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isCommand()) return;
            if (!interaction.isChatInputCommand()) return;
            if (!interaction.channel) return;
            if (interaction.channel.isDMBased()) return;
            if (!interaction.channel.isTextBased()) return;

            let c = interaction.channel as TextChannel;

            if (interaction.commandName === 'cashier') {
                // make private thread
                const thread = await c.threads.create({
                    name: `Cashier`,
                    invitable: false,
                    autoArchiveDuration: 60, // 1 hour
                    reason: 'Cashier game!!11',
                    type: ChannelType.PrivateThread,
                });

                this.activeGames[interaction.user.id] = {
                    customer: null,
                    channel: thread,
                    currentHour: 0,
                    interval: setInterval(() => {
                        if (this.activeGames[interaction.user.id]) {
                            this.activeGames[interaction.user.id].currentHour++;

                            if (!this.activeGames[interaction.user.id].customer) {
                                let people: {
                                    type: "bot";
                                    name: string;
                                    avatar: string;
                                    quirks: Quirk[];
                                }[] = [
                                        {
                                            type: 'bot',
                                            name: "Joe",
                                            avatar: 'https://media.discordapp.net/attachments/1254150583502246033/1323123316940345477/2Q.png?ex=67735e1d&is=67720c9d&hm=7c8e558c73b806e6cc21c632722d479e170c872e28b3ff223e4e239eebc44e1c&=&format=webp&quality=lossless&width=569&height=426',
                                            quirks: ['dumb', 'lowercase']
                                        },
                                        {
                                            type: 'bot',
                                            name: "Sally",
                                            avatar: 'https://media.discordapp.net/attachments/1254150583502246033/1323123390709502052/Z.png?ex=67735e2e&is=67720cae&hm=021a439b657528de4629527db32366e55c4963c7dc5cfebcd33e8311df13dcb9&=&format=webp&quality=lossless&width=495&height=495',
                                            quirks: ['expletives', 'screaming']
                                        },
                                        {
                                            type: 'bot',
                                            name: "Alberted",
                                            avatar: 'https://media.discordapp.net/attachments/1254150583502246033/1323123445663268874/images.png?ex=67735e3b&is=67720cbb&hm=65362b44bd1f93417ead46b68d51124bbd2819068733bccc92c4a31e9fd7d629&=&format=webp&quality=lossless&width=495&height=495',
                                            quirks: ['hashtag'],
                                        },
                                        {
                                            type: 'bot',
                                            name: "Dr. Julius Dr PHD Dr. Julius Dr",
                                            avatar: 'https://media.discordapp.net/attachments/1254150583502246033/1323123499006431333/9k.png?ex=67735e48&is=67720cc8&hm=4663837c82bf6db158bbf412c129072a4a0e87799758e401a1a83d5fd9af0b02&=&format=webp&quality=lossless&width=424&height=402',
                                            quirks: [],
                                        },
                                        {
                                            type: 'bot',
                                            name: "Dad",
                                            avatar: 'https://media.discordapp.net/attachments/1254150583502246033/1323123555742908467/9k.png?ex=67735e56&is=67720cd6&hm=d59b1754902851be3a2c29f92cd478290be17540f926142702c3481f57cff163&=&format=webp&quality=lossless&width=492&height=495',
                                            quirks: ['leet', 'screaming', 'expletives'],
                                        },
                                        {
                                            type: 'bot',
                                            name: "Snake",
                                            avatar: 'https://media.discordapp.net/attachments/1254150583502246033/1323123602865913936/9k.png?ex=67735e61&is=67720ce1&hm=503284ee44e2c299cf2dbe3b90c68558e49fb7182c298a3175956060321b001a&=&format=webp&quality=lossless&width=605&height=402',
                                            quirks: ['lowercase', 'expletives'],
                                        },
                                        {
                                            type: 'bot',
                                            name: "What",
                                            avatar: 'https://media.discordapp.net/attachments/1254150583502246033/1323123654849986702/Z.png?ex=67735e6d&is=67720ced&hm=9f3a41bb42319578a6eb55bc620d66615c6de45ea86f199aaeb433eb787ae4ee&=&format=webp&quality=lossless&width=495&height=495',
                                            quirks: ['screaming', 'lowercase', 'dumb'],
                                        },
                                        {
                                            type: 'bot',
                                            name: "TypeScript Type Aliases and Interfaces",
                                            avatar: 'https://media.discordapp.net/attachments/1254150583502246033/1323123739709276221/Z.png?ex=67735e81&is=67720d01&hm=b7365a25a4e5b3796fdbdc2fea69405d147698137f7c5f0731d4fd0c86b1fc46&=&format=webp&quality=lossless&width=459&height=530',
                                            quirks: ['hashtag'],
                                        },
                                        {
                                            type: 'bot',
                                            name: "LLaMA 3.2 Vision",
                                            avatar: 'https://media.discordapp.net/attachments/1254150583502246033/1323123849104986292/OVSJYsdQ7G8AAAAASUVORK5CYII.png?ex=67735e9c&is=67720d1c&hm=4d91c16869131ea9c88af9e7e3c4a5845cdedca566b1b2e4c7f736deea8ca29b&=&format=webp&quality=lossless&width=495&height=495',
                                            quirks: [],
                                        },
                                        {
                                            type: 'bot',
                                            name: "River",
                                            avatar: 'https://media.discordapp.net/attachments/1254150583502246033/1323123932705849395/images.png?ex=67735eb0&is=67720d30&hm=fd277b45cb0ccf0e79dd6285bd7dd46dc755e916059f8d233709c95464388180&=&format=webp&quality=lossless&width=704&height=345',
                                            quirks: ['lowercase', 'dumb'],
                                        },
                                    ];

                                let items: Item[] = [
                                    {
                                        name: 'Burger',
                                        emoji: '🍔',
                                        price: 100,
                                    },
                                    {
                                        name: 'Fries',
                                        emoji: '🍟',
                                        price: 50,
                                    },
                                    {
                                        name: 'Rifle',
                                        emoji: '🔫',
                                        price: 2500,
                                    },
                                    {
                                        name: 'Tick is timing',
                                        emoji: '⌛',
                                        price: 500,
                                    }
                                ];

                                let orderItems = [];
                                function randomRange(min: number, max: number) {
                                    return Math.floor(Math.random() * (max - min + 1)) + min;
                                }

                                let count = randomRange(1, 10);
                                for (let i = 0; i < count; i++) {
                                    orderItems.push(items[Math.floor(Math.random() * items.length)]);
                                }

                                this.activeGames[interaction.user.id].customer = {
                                    data: people[Math.floor(Math.random() * people.length)],
                                    currentOrder: {
                                        items: orderItems,
                                    }
                                };
                            }
                        } else {
                            clearInterval(this.activeGames[interaction.user.id].interval)
                        }
                    }, 10 * 1000), // every 10 secs
                };

                interaction.reply({
                    content: "Cashier shift started in <#" + thread.id + ">!",
                    ephemeral: false,
                });

                setTimeout(() => {
                    thread.send('<@' + interaction.user.id + '> welcome to the Shift. Say `stop` anytime to end it.\n\nFirst customer arrives soon. Get readya');
                }, 2000);
            }
        });
    }

    activeGames: {
        [userID: string]: {
            channel: TextBasedChannel,
            customer: {
                data: {
                    type: "bot",
                    name: string,
                    avatar: string,
                    quirks: Quirk[],
                } | {
                    type: "user"
                },
                currentOrder: {
                    items: Item[],
                }
            } | null,
            currentHour: number,
            interval: any,
        }
    } = {};

    async doJobs(message: OmitPartialGroupDMChannel<Message>) {
        if (!this.activeGames[message.author.id]) return;

        if (message.content.toLowerCase() === "stop") {
            delete this.activeGames[message.author.id];
            message.reply({
                content: "Shift stopped indeed",
                allowedMentions: { repliedUser: false }
            });
            return;
        }
    }
}