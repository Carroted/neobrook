import {
    Client,
    GatewayIntentBits,
    ButtonBuilder, ButtonStyle,
    ChannelType, TextChannel, WebhookClient, ActivityType, PermissionsBitField, Guild, Events, BaseGuildTextChannel, Message, Partials, MessageReaction, GuildMember, ActionRowBuilder, ComponentType, User,
    EmbedBuilder,
    AttachmentBuilder,
    ThreadChannel,
    Collection,
    SlashCommandBuilder,
    REST,
    Routes,
} from 'discord.js';

import type { TextBasedChannel, GuildTextBasedChannel, NonThreadGuildBasedChannel, ChatInputCommandInteraction, RESTPostAPIChatInputApplicationCommandsJSONBody, } from 'discord.js';

import colors from 'ansi-colors';
import { Database } from "bun:sqlite";

import type SlashCommand from './SlashCommand';
import type UserContextMenuCommand from './UserContextMenuCommand';

import Memes from './systems/Memes';
import Reputation from './systems/Reputation';
import HexColorPreview from './systems/HexColorPreview';
import BeatsRock from './systems/BeatsRock';
import Shell from './systems/Shell';
import Economy, { stringifyMoney } from './systems/Economy';
import Orgs from './systems/Orgs';
import WizardHelper from './systems/WizardHelper';

const db = new Database("brook.sqlite");

let paymentRequests: {
    [userID: string]: {
        author: string, // who ran !api payrequest
        amount: number, // amount of money requested
        description: string, // description of payment request
        channel: string, // channel ID of where someone used !api payrequest
        message: string, // message ID of where someone used !api payrequest
    }[]
} = {};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages
    ],
    partials: [Partials.Message, Partials.Channel, Partials.GuildMember, Partials.Reaction, Partials.User]
});

const rep = new Reputation(db, client);
const wizardHelper = new WizardHelper(client);
const orgs = new Orgs(db, client, wizardHelper);
const economy = new Economy(db, orgs, client, wizardHelper);
orgs.economy = economy;
const hexColorPreview = new HexColorPreview();
const beatsRock = new BeatsRock(client);
const jobs = new Jobs(client, economy);
const shell = new Shell();

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN!);

// Initialize the Discord client
const commands = new Collection<string, SlashCommand | UserContextMenuCommand>();

// Dynamically import all commands
import fs from 'fs';
import path from 'path';
import Jobs from './systems/Jobs';

const slashCommandFiles = fs.readdirSync(path.join(__dirname, 'commands', 'slash')).filter(file => file.endsWith('.ts'));

for (const file of slashCommandFiles) {
    const command = require(`./commands/slash/${file}`).default as SlashCommand;
    commands.set(command.data.name, command);
}

const userContextMenuCommandFiles = fs.readdirSync(path.join(__dirname, 'commands', 'context')).filter(file => file.endsWith('.ts'));

for (const file of userContextMenuCommandFiles) {
    const command = require(`./commands/context/${file}`).default as UserContextMenuCommand;
    commands.set(command.data.name, command);
}

client.once(Events.ClientReady, async () => {
    console.log(colors.greenBright('Connected to Discord'));

    try {
        const commandArray = commands.map(command => command.data.toJSON());

        await rest.put(
            Routes.applicationCommands(client.user!.id),
            { body: commandArray },
        );

        console.log(colors.greenBright('Successfully registered application commands.'));
    } catch (error) {
        console.error(error);
    }

    const memesChannel = await client.channels.fetch('1224889094438387725') as TextChannel;
    new Memes(db, memesChannel);
});

client.on(Events.MessageCreate, async message => {
    try {
        if (message.content.startsWith(client.user!.id + '!api ')) {
            let parts = message.content.split(' ');

            let command = parts[1];
            let args = parts.slice(2);

            if (command === 'balance') {
                if (args.length === 0) {
                    message.reply(JSON.stringify({
                        status: 400,
                        body: 'Invalid request; not enough arguments'
                    }));
                } else {
                    let value = economy.getMoney(args[0]);
                    message.reply(JSON.stringify({
                        status: 200,
                        body: value,
                    }));
                }
            } else if (command === 'payrequest') {
                if (args.length < 4) {
                    message.reply(JSON.stringify({
                        status: 400,
                        body: 'Invalid request; not enough arguments'
                    }));
                } else {
                    let user = args[0];
                    let amount = parseInt(args[1]);
                    let channel = args[2];
                    if (isNaN(amount) || amount < 1) {
                        message.reply(JSON.stringify({
                            status: 400,
                            body: 'Please specify a valid amount.'
                        }));
                    } else {
                        let description = args.slice(3).join(' ');
                        if (!paymentRequests[user]) {
                            paymentRequests[user] = [];
                        }
                        let request = {
                            amount,
                            author: message.author.id,
                            channel: message.channel.id,
                            description: description,
                            message: message.id
                        };
                        paymentRequests[user].push(request);
                        let userObject = await client.users.fetch(user).catch(() => {
                            return null;
                        });
                        if (!userObject) {
                            message.reply(JSON.stringify({ status: 404, body: "User not found." }));
                            return;
                        }

                        let channelObject = await client.channels.fetch(channel).catch(() => {
                            return null;
                        });

                        if (!channelObject) {
                            message.reply(JSON.stringify({ status: 404, body: "Channel not found." }));
                            return;
                        }

                        if (channelObject.type !== ChannelType.GuildText && channelObject.type !== ChannelType.DM && channelObject.type !== ChannelType.GroupDM && channelObject.type !== ChannelType.PrivateThread && channelObject.type !== ChannelType.PublicThread || channelObject.partial) {
                            message.reply(JSON.stringify({ status: 404, body: "Invalid channel type." }));
                            return;
                        }

                        // now we send the message
                        let embed = {
                            color: 0x2b2d31,
                            description: `## Payment Request\n\n<@${message.author.id}> is requesting **${stringifyMoney(amount)}**.

> ${description.split('\n').join('\n> ')}`,
                        };

                        const confirm = new ButtonBuilder()
                            .setCustomId('confirm')
                            .setLabel('Pay')
                            .setStyle(ButtonStyle.Primary);

                        const cancel = new ButtonBuilder()
                            .setCustomId('cancel')
                            .setLabel('Decline')
                            .setStyle(ButtonStyle.Secondary);

                        const block = new ButtonBuilder()
                            .setCustomId('block')
                            .setLabel('Block')
                            .setStyle(ButtonStyle.Danger);

                        let msg = await (channelObject as TextChannel).send({
                            content: '-# <@' + userObject.id + '>',
                            embeds: [embed],
                            components: [{
                                type: ComponentType.ActionRow,
                                components: [confirm, cancel, block]
                            }]
                        }).catch(() => {
                            return null;
                        });

                        if (!msg) {
                            message.reply(JSON.stringify({ status: 500, body: "Failed to send message in target channel." }));
                            return;
                        }

                        // now we wait for a response
                        let collector = msg.createMessageComponentCollector({
                            time: 60 * 60 * 1000 * 24 * 2
                        });

                        // confirm that payment request was sent
                        message.reply(JSON.stringify({
                            status: 200,
                            body: {
                                type: "sent",
                                message: "Payment request sent."
                            },
                        }));

                        // collect it up
                        collector.on('collect', async interaction => {
                            if (!interaction.isButton()) return;

                            if (interaction.user.id !== user) {
                                await interaction.reply({
                                    content: 'You cannot respond to this payment request.',
                                    ephemeral: true
                                });
                                return;
                            }
                            if (interaction.customId === 'confirm') {
                                let paymentInfo = await economy.pay(userObject, message.author, amount, interaction); // from the person we are requesting payment from, to the person who ran this api payrequest, and send receipt in their DMs
                                if (paymentInfo) {
                                    // remove from paymentRequests
                                    let index = paymentRequests[user].indexOf(request);
                                    if (index > -1) {
                                        paymentRequests[user].splice(index, 1);
                                    }

                                    let embed2 = {
                                        color: 0x2b2d31,
                                        description: `*You accepted the request.*`,
                                    };

                                    // now remove buttons
                                    await msg.edit({
                                        embeds: [embed, embed2],
                                        components: []
                                    });

                                    // send message json
                                    message.reply(JSON.stringify({
                                        status: 200,
                                        body: {
                                            type: "accepted",
                                            message: "Payment request accepted.",
                                            paymentInfo,
                                        },
                                    }));
                                }
                                else {
                                    // remove from paymentRequests
                                    let index = paymentRequests[user].indexOf(request);
                                    if (index > -1) {
                                        paymentRequests[user].splice(index, 1);
                                    }

                                    let embed2 = {
                                        color: 0x2b2d31,
                                        description: `*Your payment failed.*`,
                                    };

                                    // now remove buttons
                                    await msg.edit({
                                        embeds: [embed, embed2],
                                        components: []
                                    });

                                    // send message json
                                    message.reply(JSON.stringify({ status: 500, body: "Payment failed. This is likely from a lack of funds." }));
                                }
                            }
                            else if (interaction.customId === 'cancel') {
                                await interaction.reply({
                                    content: 'Payment request declined.',
                                    ephemeral: true
                                });

                                // remove from paymentRequests
                                let index = paymentRequests[user].indexOf(request);
                                if (index > -1) {
                                    paymentRequests[user].splice(index, 1);
                                }

                                let embed2 = {
                                    color: 0x2b2d31,
                                    description: `*You declined the request.*`,
                                };

                                // now remove buttons
                                await msg.edit({
                                    embeds: [embed, embed2],
                                    components: []
                                });

                                // send message json
                                message.reply(JSON.stringify({ status: 200, body: { type: "declined", message: "Payment request declined by the user." } }));
                            }
                            else if (interaction.customId === 'block') {
                                await interaction.reply({
                                    content: 'Payment request declined and requester blocked from requesting more payments.',
                                    ephemeral: true
                                });

                                // coming soon

                                // remove from paymentRequests
                                let index = paymentRequests[user].indexOf(request);
                                if (index > -1) {
                                    paymentRequests[user].splice(index, 1);
                                }

                                let embed2 = {
                                    color: 0x2b2d31,
                                    description: `*You declined the request and blocked the requester.*`,
                                };

                                // now remove buttons
                                await msg.edit({
                                    embeds: [embed, embed2],
                                    components: []
                                });

                                // send message json
                                message.reply(JSON.stringify({ status: 200, body: { type: "declined", message: "Payment request declined by the user." } }));
                            }
                        });
                    }
                }
            } else if (command === 'pay') {
                if (args.length < 3) {
                    message.reply(JSON.stringify({
                        status: 400,
                        body: 'Invalid request; not enough arguments'
                    }));
                } else {
                    let user = args[0];
                    let amount = parseInt(args[1]);
                    let channel = args[2];
                    if (isNaN(amount) || amount < 1) {
                        message.reply(JSON.stringify({
                            status: 400,
                            body: 'Please specify a valid amount.'
                        }));
                    } else {
                        let userObject = await client.users.fetch(user).catch(() => {
                            return null;
                        });
                        if (!userObject) {
                            message.reply(JSON.stringify({ status: 404, body: "User not found." }));
                            return;
                        }

                        let channelObject = await client.channels.fetch(channel).catch(() => {
                            return null;
                        });

                        if (!channelObject) {
                            message.reply(JSON.stringify({ status: 404, body: "Channel not found." }));
                            return;
                        }

                        if (channelObject.type !== ChannelType.GuildText && channelObject.type !== ChannelType.DM && channelObject.type !== ChannelType.GroupDM && channelObject.type !== ChannelType.PrivateThread && channelObject.type !== ChannelType.PublicThread) {
                            message.reply(JSON.stringify({ status: 404, body: "Invalid channel type." }));
                            return;
                        }

                        let paymentInfo = await economy.pay(message.author, userObject, amount, channelObject as TextChannel);

                        if (paymentInfo) {
                            // send message json
                            message.reply(JSON.stringify({
                                status: 200,
                                body: "Payment successful.",
                            }));
                        } else {
                            message.reply(JSON.stringify({ status: 500, body: "Payment failed. This is likely from a lack of funds." }));
                        }
                    }
                }
            }
        }

        if (message.author.id === client.user!.id) return;

        wizardHelper.message(message);

        if (!message.guild || (message.guild.id !== '1224881201379016825')) return;

        hexColorPreview.sendColorPreviews(message);
        beatsRock.doGames(message);
        jobs.doJobs(message);
        shell.runShell(message);
    } catch (e) {
        console.log(e);
        message.channel.send('<:error:1224892997749964892>');
    }
});

client.login(process.env.TOKEN);

// listen for commands
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isCommand()) return;

    const command = commands.get(interaction.commandName);
    if (!command) return;
    if (!command.execute) return;

    try {
        if (interaction.isChatInputCommand()) {
            if (command.type !== 'slash') return;
            await command.execute(interaction);
        } else if (interaction.isUserContextMenuCommand()) {
            if (command.type !== 'context') return;
            await command.execute(interaction);
        }
    }
    catch (error) {
        console.error(error);
        if (interaction.replied) return;
        await interaction.reply({ content: 'There was an error while executing this command.', ephemeral: true });
    }
});
