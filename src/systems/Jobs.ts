import { ChannelType, Client, EmbedBuilder, Events, Message, TextChannel, ThreadChannel, User, Webhook, WebhookClient, type OmitPartialGroupDMChannel, type PrivateThreadChannel, type TextBasedChannel } from "discord.js";

import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';
import type Economy from "./Economy";
import { stringifyMoney } from "./Economy";

interface Item {
    name: string,
    price: number,
    emoji: string,
}

type Quirk = "lowercase" | "screaming" | "leet" | "expletives" | "hashtag" | "dumb";

export default class Jobs { // Steven Paul
    client: Client;
    economy: Economy;

    constructor(client: Client, economy: Economy) {
        this.client = client;
        this.economy = economy;

        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isCommand()) return;
            if (!interaction.isChatInputCommand()) return;
            if (!interaction.channel) return;
            if (interaction.channel.isDMBased()) return;
            if (!interaction.channel.isTextBased()) return;

            let c = interaction.channel as TextChannel;

            if (interaction.commandName === 'securityguard') {
                let mode = interaction.options.getString('mode') ?? 'normal';

                if (this.activeCashiers[interaction.user.id]) {
                    interaction.reply('You already have an active night shift. Wait for that thing to end');
                    return;
                }

                if (interaction.channel.isThread()) {
                    c = (c as any as ThreadChannel).parent as TextChannel;
                }

                if (c.type as any === ChannelType.GuildForum) {
                    interaction.reply('You can\'t unrea in a forum channel, because i cant make Threads there, since Threads in forums are just Posts and im not gonna make a Forum Post for a death shift thing, ya know?');
                    return;
                }

                // make private thread
                const thread = await c.threads.create({
                    name: `Security Guard (${mode})`,
                    invitable: false,
                    autoArchiveDuration: 60, // 1 hour
                    reason: 'Death game!!11',
                    type: ChannelType.PublicThread,
                });

                this.activeSG[interaction.user.id] = {
                    channel: thread,
                    door1: false,
                    door2: false,
                    light1: false,
                    light2: false,
                    hour: 0,
                    position1: 0,
                    position2: 0,
                };


            }

            if (interaction.commandName === 'cashier') {
                let mode = interaction.options.getString('mode') ?? 'normal';

                if (this.activeCashiers[interaction.user.id]) {
                    interaction.reply('You already have an active cashiering. Wait for that shift to end');
                    return;
                }

                if (interaction.channel.isThread()) {
                    c = (c as any as ThreadChannel).parent as TextChannel;
                }

                if (c.type as any === ChannelType.GuildForum) {
                    interaction.reply('You can\'t cashier in a forum channel, because i cant make Threads there, since Threads in forums are just Posts and im not gonna make a Forum Post for a Cashier 3min shift thing, ya know?');
                    return;
                }

                // make private thread
                const thread = await c.threads.create({
                    name: `Cashier (${mode})`,
                    invitable: false,
                    autoArchiveDuration: 60, // 1 hour
                    reason: 'Cashier game!!11',
                    type: ChannelType.PublicThread,
                });

                // make webhook or find
                /*const webhook = await c.createWebhook({
                    name: `Customer`,
                });*/
                const webhook = await c.fetchWebhooks();
                let customerWebhook: Webhook | undefined;
                for (const w of webhook) {
                    if (w[1].name === 'Customer') {
                        customerWebhook = w[1];
                        break;
                    }
                }
                if (!customerWebhook) {
                    customerWebhook = await c.createWebhook({
                        name: `Customer`,
                    });
                }

                this.activeCashiers[interaction.user.id] = {
                    customer: null,
                    served: 0,
                    channel: thread,
                    currentHour: 0,
                    totalEarnings: 0,
                    webhook: customerWebhook,
                    interval: setInterval(async () => {
                        if (this.activeCashiers[interaction.user.id]) {
                            this.activeCashiers[interaction.user.id].currentHour++;

                            if (this.activeCashiers[interaction.user.id].currentHour >= 18) {
                                clearInterval(this.activeCashiers[interaction.user.id].interval);
                                let amount = -10 + (this.activeCashiers[interaction.user.id].served * 2);
                                this.economy.changeMoney(interaction.user.id, amount);
                                this.economy.changeMoney('1183134058415394846', -amount);
                                let end = amount > 0 ? `<:plus:1309954509040124035> ${stringifyMoney(amount)}` : `<:minus:1309954499850407987> ${stringifyMoney(-amount)}`;
                                let totalChange = amount + this.activeCashiers[interaction.user.id].totalEarnings;
                                let end2 = totalChange > 0 ? `<:plus:1309954509040124035> ${stringifyMoney(totalChange)}` : `<:minus:1309954499850407987> ${stringifyMoney(-totalChange)}`;
                                let msg = await (this.activeCashiers[interaction.user.id].channel as PrivateThreadChannel).send(`Your shift is now done! Have a bonus of ${end}. This is \`-10 + (served * 2)\`.\n\nYou earned <:plus:1309954509040124035> ${stringifyMoney(this.activeCashiers[interaction.user.id].totalEarnings)} from serving customers.\n\nIn total, this means you made ${end2} over this shift.`);
                                this.economy.registerTransaction(msg.url, '1183134058415394846', interaction.user.id, amount, amount);
                                await (this.activeCashiers[interaction.user.id].channel as PrivateThreadChannel).setLocked(true);
                                await (this.activeCashiers[interaction.user.id].channel as PrivateThreadChannel).setArchived(true);
                                delete this.activeCashiers[interaction.user.id];
                                return;
                            }

                            if (this.activeCashiers[interaction.user.id].customer) {
                                this.activeCashiers[interaction.user.id].customer!.state++;

                                if (this.activeCashiers[interaction.user.id].customer!.state === 1) {
                                    this.customerSpeak(interaction.user.id, `fucking hello bitch what is the holdup, i need ${this.activeCashiers[interaction.user.id].customer!.currentOrder.items.map(item => item.name).join(', ')}`);
                                } else if (this.activeCashiers[interaction.user.id].customer!.state === 2) {
                                    this.customerSpeak(interaction.user.id, `you fucking sutpid, you need to make my ${this.activeCashiers[interaction.user.id].customer!.currentOrder.items.map(item => item.name).join(', ')} this is last chance your`);
                                } else {
                                    this.customerSpeak(interaction.user.id, `you fucking idiot, i'm leaving you here to rot. I don't need your services anymores`);

                                    // remove customer
                                    this.activeCashiers[interaction.user.id].customer = null;
                                    return;
                                }
                            }

                            if (!this.activeCashiers[interaction.user.id].customer) {
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

                                let orderItems: Item[] = [];
                                function randomRange(min: number, max: number) {
                                    return Math.floor(Math.random() * (max - min + 1)) + min;
                                }

                                let count = 1;

                                if (mode === 'normal') count = randomRange(1, 4);

                                for (let i = 0; i < count; i++) {
                                    // make sure not already in
                                    if (orderItems.find(item => item.name === items[i].name)) continue;
                                    orderItems.push(items[Math.floor(Math.random() * items.length)]);
                                }

                                this.activeCashiers[interaction.user.id].customer = {
                                    data: people[Math.floor(Math.random() * people.length)],
                                    currentOrder: {
                                        items: orderItems,
                                    },
                                    state: 0,
                                };

                                let prefixes = ['', 'Hello ', 'Hey ', 'Hey bitch ', 'Hey fucker ', 'Hi friend ', '...', 'umm '];

                                let prefix = prefixes[Math.floor(Math.random() * prefixes.length)];

                                let suffixes = ['', ', no sauce please', ' please', ', dont add the nitrogen', ' without acid', ' with acid of course'];
                                let suffix = suffixes[Math.floor(Math.random() * suffixes.length)];

                                this.customerSpeak(interaction.user.id, `${prefix}I fucking need ${orderItems.map(item => item.name).join(', ')} bitch${suffix}`);

                                setTimeout(() => {
                                    if (!this.activeCashiers[interaction.user.id]) {
                                        return;
                                    }
                                    let c = this.activeCashiers[interaction.user.id].channel as PrivateThreadChannel;

                                    if (c.archived) {
                                        return;
                                    }
                                    c.send('Send a message with all the emoji of the customer\'s order without incorrect or additional ones.');
                                }, mode !== 'normal' ? 1 : 1000);
                            }
                        } else {
                            if (!this.activeCashiers[interaction.user.id]) return;
                            clearInterval(this.activeCashiers[interaction.user.id].interval)
                        }
                    }, mode === 'normal' ? 10 * 1000 : mode === 'super' ? 2.5 * 1000 : 1 * 1000), // every 10 secs
                };

                interaction.reply({
                    content: "Cashier shift started in <#" + thread.id + ">!",
                    ephemeral: false,
                });

                setTimeout(() => {
                    if (!this.activeCashiers[interaction.user.id]) {
                        return;
                    }
                    if (thread.archived) {
                        return;
                    }
                    thread.send('<@' + interaction.user.id + '> welcome to the Shift. Say `stop` anytime to end it.\n\nFirst customer arrives soon. Get readya');
                }, 2000);
            }
        });
    }

    activeCashiers: {
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
                },
                state: number
            } | null,
            currentHour: number,
            interval: any,
            webhook: Webhook,
            served: number,
            totalEarnings: number,
        }
    } = {};

    // security guards
    activeSG: {
        [userID: string]: {
            channel: TextBasedChannel,
            position1: number,
            position2: number,
            hour: number,
            light1: boolean,
            light2: boolean,
            door1: boolean,
            door2: boolean,
        }
    } = {};

    async doJobs(message: OmitPartialGroupDMChannel<Message>) {
        this.doCashiers(message);
    }

    async doCashiers(message: OmitPartialGroupDMChannel<Message>) {
        if (!this.activeCashiers[message.author.id]) return;
        if (this.activeCashiers[message.author.id].channel.id !== message.channel.id) return;

        if (message.content.toLowerCase() === "stop") {
            clearInterval(this.activeCashiers[message.author.id].interval);
            await (this.activeCashiers[message.author.id].channel as PrivateThreadChannel).setLocked(true);
            await (this.activeCashiers[message.author.id].channel as PrivateThreadChannel).setArchived(true);
            delete this.activeCashiers[message.author.id];
            message.reply({
                content: "Shift stopped indeed",
                allowedMentions: { repliedUser: false }
            });
            return;
        }

        if (this.activeCashiers[message.author.id].customer) {
            let order = this.activeCashiers[message.author.id].customer!.currentOrder.items;

            // message is a bunch of emoji. we will remove all spaces, and then just check all the emoji
            // they can be in either :emoji: or just the direct unicode char. thus we will have to handle both
            let mappings: { [key: string]: string } = {
                'hamburger': '🍔',
                'fries': '🍟',
                'gun': '🔫',
                'hourglass': '⌛',
            };

            // remove spaces
            let content = message.content.replaceAll(' ', '');
            // replace :emoji: with unicode
            for (let key in mappings) {
                content = content.replaceAll(`:${key}:`, mappings[key]);
            }

            // now make sure they only have the order item emoji matches. anything incorrect is bad. ordering irrelevant
            let total = order.length;

            let orderEmojis = order.map(item => item.emoji).toSorted();

            const splitEmoji = (string: string) => [...new Intl.Segmenter().segment(string)].map(x => x.segment);

            let contentEmojis = splitEmoji(content).toSorted();
            console.log(orderEmojis);
            console.log(contentEmojis);

            let areEqual = orderEmojis.length === contentEmojis.length &&
                orderEmojis.every((emoji, index) => emoji === contentEmojis[index]);
            let correctCount = orderEmojis.filter((emoji, index) => emoji === contentEmojis[index]).length;

            // compare each

            // check for correct emojis
            if (correctCount < total || !areEqual) {
                message.reply(`You have ${total - correctCount} incorrect items. Order length is ${total}. Please try again.`);
            } else {
                this.customerSpeak(message.author.id, 'wow fucking thanks bitch! now i have nutritional value');
                this.activeCashiers[message.author.id].customer = null;

                this.activeCashiers[message.author.id].served++;

                setTimeout(async () => {
                    this.economy.changeMoney(message.author.id, 5);
                    this.economy.changeMoney('1183134058415394846', -5);
                    if (this.activeCashiers[message.author.id]) {
                        this.activeCashiers[message.author.id].totalEarnings += 5;
                    }
                    let msg = await message.reply(`You served that customer correctly. <:plus:1309954509040124035> ${stringifyMoney(5)}`);
                    this.economy.registerTransaction(msg.url, '1183134058415394846', message.author.id, 5, 5);
                }, 1000);
            }
        }
    }

    customerSpeak(id: string, message: string) {
        if (!this.activeCashiers[id]) return;
        const webhook = this.activeCashiers[id].webhook;

        if (this.activeCashiers[id].customer?.data.type === 'bot') {
            // get quirks
            const quirks = this.activeCashiers[id].customer.data.quirks;

            if (!quirks.includes('expletives')) {
                message = message.replaceAll(' bitch', '')
                    .replaceAll(' fucker', '')
                    .replaceAll(' fucking', '').replaceAll('fucking ', '');
            }

            if (quirks.includes('hashtag')) {
                // for each word, 50% chance of all being hashtags
                message = message.split(' ').map(word => Math.random() > 0.5 ? '#'.repeat(word.length) : word).join(' ');
            }

            if (quirks.includes('leet')) {
                // replace letters with numbers
                const leetMap = new Map([
                    ['a', '4'], ['e', '3'], ['i', '1'], ['o', '0'], ['t', '7']
                ]);
                message = message.split('').map(char => leetMap.get(char.toLowerCase()) || char).join('');
            }

            if (quirks.includes('screaming')) {
                // make the message all uppercase and then append a bunch of exclamation marks
                message = message.toUpperCase() + '!'.repeat(Math.floor(Math.random() * 10) + 1);
            }

            if (quirks.includes('lowercase')) {
                // make the message all lowercase
                message = message.toLowerCase();
            }

            if (quirks.includes('dumb')) {
                // remove 40% of words. while removing them, 50% chance of replace with `umm` or `uhh`, 50% chance of replace with ''
                message = message.split(' ').filter(() => Math.random() > 0.4).map(word => Math.random() > 0.5 ? word : (Math.random() > 0.5 ? 'umm' : 'uhh')).join(' ');
            }

            webhook.send({
                content: message + ' _ _',
                avatarURL: this.activeCashiers[id].customer?.data.avatar,
                username: this.activeCashiers[id].customer?.data.name,
                threadId: this.activeCashiers[id].channel.id,
                allowedMentions: { parse: [] },
            });
        }
    }
}