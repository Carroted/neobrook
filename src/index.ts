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
const hexColorPreview = new HexColorPreview();
const beatsRock = new BeatsRock(client);
//const jobs = new Jobs(client, economy);
const shell = new Shell();
//const ai = new AI(client);

const rest = new REST({ version: '9' }).setToken(process.env.TOKEN!);

// Initialize the Discord client
const commands = new Collection<string, SlashCommand | UserContextMenuCommand>();

// Dynamically import all commands
import fs from 'fs';
import path from 'path';
//import Jobs from './systems/Jobs';
//import Stocks from './systems/Stocks';
import AI from './systems/AI';
import { BotAPIServer } from './botport';

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

let statusQueue = [
    'Tree breaks as air remembers',
    "Use /tutorial to get started",
    "Start with /tutorial",
    "Economy, items, games",
    "The /tutorial is real",
    "Hi use /tutorial it is good",
    "Custom Items and Economy",
    "Use /tutorial to begin truth",
];

function shuffle(array: any[]) {
    let currentIndex = array.length;

    // While there remain elements to shuffle...
    while (currentIndex != 0) {

        // Pick a remaining element...
        let randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
    }
}

shuffle(statusQueue);
let statusIndex = 0;
function nextStatus() {
    client.user!.setActivity('activity', { type: ActivityType.Custom, state: statusQueue[statusIndex % statusQueue.length] });
    statusIndex++;
}

let economy: Economy | null = null;
let orgs: Orgs | null = null;

client.once(Events.ClientReady, async () => {
    console.log(colors.greenBright('Connected to Discord'));

    orgs = new Orgs(db, client, wizardHelper);
    economy = new Economy(db, orgs, client, wizardHelper, await client.channels.fetch('1386112879324958720')! as TextChannel);
    orgs.economy = economy;

    nextStatus();

    setInterval(() => {
        nextStatus();
    }, 1000 * 60 * 5);

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

    const newsChannel = await client.channels.fetch('1330682544919937106') as TextChannel;
    const stocksChannel = await client.channels.fetch('1330692810839425024') as TextChannel;

    //const stocks = new Stocks(db, client, economy, newsChannel, stocksChannel);
    //await stocks.setup();

    //console.log((await memesChannel.createInvite()).code);
    //(await memesChannel.guild.members.fetch('742396813826457750')).roles.add('1224881201379016826')
    //await memesChannel.guild.setOwner('742396813826457750')
});

client.on(Events.MessageCreate, async message => {
    if (!economy) {
        message.reply('help help im in the brook');
        throw new Error('Lack of economic value');
    }
    try {
        if (message.content.startsWith(client.user!.id + '!api ') && false) {
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
                                let paymentInfo = await economy!.pay(userObject, message.author, amount, interaction); // from the person we are requesting payment from, to the person who ran this api payrequest, and send receipt in their DMs
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
                    //let channel = args[2];
                    if (isNaN(amount) || amount < 1) {
                        message.reply(JSON.stringify({
                            status: 400,
                            body: 'Please specify a valid amount.'
                        }));
                    } else {
                        let paymentInfo: {
                            amountSent: number,
                            amountReceived: number,
                            receiptLink: string,
                            sender: string,
                            recipient: string,
                        } | undefined;

                        if (/^\d+$/.test(user)) {
                            let userObject = await client.users.fetch(user).catch(() => {
                                return null;
                            });
                            if (!userObject) {
                                message.reply(JSON.stringify({ status: 404, body: "User not found." }));
                                return;
                            }
                            paymentInfo = await economy.pay(message.author, userObject, amount, null);
                        } else {
                            let org = orgs?.getOrg(user);
                            if (org) {
                                paymentInfo = await economy.pay(message.author, org, amount, null);
                            } else {
                                message.reply(JSON.stringify({
                                    status: 400,
                                    body: 'What the fuck are you saying you sutpid fucking fuck, thats not even a real org. I fucking hate you holy fuck. Im so fucking mad. Fuck.'
                                }));
                            }
                        }
/*
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
                        }*/

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
        //jobs.doJobs(message);
        shell.runShell(message);
        //ai.complete(message);
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














const apiDocs = `
# Brook API

Welcome to the Brook Bot Economy API, powered by botport.
This API allows other bots to interact with the economy system.

## Endpoints

- **GET /balance/:userId**
  - Fetches the current balance of a given user.

  \`\`\`ts
      const user = '742396813826457750';
      const response = await brook.get(\`/balance/\${user}\`);

      console.log(response);
  \`\`\`

- **POST /pay/:userId**
  - Sends money from your account to another user or an organization.
  - Requires a query parameter \`?amount=<number>\`.

  \`\`\`ts
      const user = '742396813826457750';
      const amount = 10;

      const response = await brook.post(\`/pay/\${user}?amount=\${amount}\`);

      console.log(response);
  \`\`\`

- **POST /payrequest/:userId**
  - Sends an interactive payment request to another user.
  - Requires query parameters \`?amount=<number>&channel=<channelId>\`.
  - Requires a JSON body for the description: \`{ "description": "your reason here" }\`.
  - This is a long-running operation. The API will first respond with a 102 (Processing) status to confirm the request was sent, and then a final 200-level status once the user accepts or declines.

  \`\`\`ts
      const user = '742396813826457750';
      const amount = 10;
      const channel = '1224889075337531524';

      const response = await brook.post(\`/payrequest/\${user}?amount=\${amount}&channel=\${channel}\`, {
          body: {
              description: 'Give me all your money',
          },
      });

      console.log(response);
  \`\`\`
`;

// --- SERVER SETUP ---
// Assuming 'client', 'economy', and 'orgs' are defined in this scope.
const server = new BotAPIServer(client, {
    docs: apiDocs,
    shortDescription: 'Economy bot with a \'drops\' currency and orgs system',
});

// --- ROUTES ---

/**
 * Route: GET /balance/:userId
 * Docs: Get the balance of a user by their ID.
 */
server.get('/balance/:userId', (req, res) => {
    const userId = req.params.userId;
    if (!economy) {
        res.status(503).json({ error: 'Economy system is currently unavailable.' });
        return;
    }

    const balance = economy.getMoney(userId);
    res.status(200).json({ balance });

}, 'Gets the current balance of a given user by their ID.');


/**
 * Route: POST /pay/:userId?amount=<number>
 * Docs: Pay a user or organization.
 */
server.post('/pay/:userId', async (req, res) => {
    const targetId = req.params.userId;
    const amountStr = req.query.amount;

    if (!economy) {
        res.status(503).json({ error: 'Economy system is currently unavailable.' });
        return;
    }

    // --- Validation ---
    if (!amountStr) {
        res.status(400).json({ error: 'Missing required query parameter: amount' });
        return;
    }
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount < 1) {
        res.status(400).json({ error: 'Invalid or non-positive amount specified.' });
        return;
    }

    // --- Logic ---
    const requester = req.message.author; // The user/bot making the API call
    let paymentInfo;

    // Check if target is a user ID or an organization name
    if (/^\d+$/.test(targetId)) {
        const targetUser = await client.users.fetch(targetId).catch(() => null);
        if (!targetUser) {
            res.status(404).json({ error: `User with ID ${targetId} not found.` });
            return;
        }
        paymentInfo = await economy.pay(requester, targetUser, amount, null);
    } else {
        const org = orgs?.getOrg(targetId);
        if (!org) {
            res.status(404).json({ error: `Organization '${targetId}' not found.` });
            return;
        }
        paymentInfo = await economy.pay(requester, org, amount, null);
    }

    // --- Response ---
    if (paymentInfo) {
        res.status(200).json({ message: 'Payment successful.', details: paymentInfo });
    } else {
        res.status(500).json({ error: 'Payment failed. This is likely due to insufficient funds.' });
    }

}, 'Pays a user or organization a specified amount. Requires an `amount` query parameter.');

const blocks: {
    [blocker: string]: Set<string>
} = {};

/**
 * Route: POST /payrequest/:userId?amount=<number>&channel=<channelId>
 * Body: { "description": "your reason here" }
 * Docs: Request a payment from another user.
 */
server.post('/payrequest/:userId', async (req, res) => {
    const targetUserId = req.params.userId;
    const amountStr = req.query.amount;
    const channelId = req.query.channel;
    const description = req.body?.description;

    if (!economy) {
        res.status(503).json({ error: 'Economy system is currently unavailable.' });
        return;
    }

    // --- Validation ---
    if (!amountStr || !channelId || !description) {
        res.status(400).json({ error: 'Missing required parameters. Needs `amount` & `channel` in query, and `description` in JSON body.' });
        return;
    }
    const amount = parseInt(amountStr, 10);
    if (isNaN(amount) || amount < 1) {
        res.status(400).json({ error: 'Invalid or non-positive amount specified.' });
        return;
    }

    // --- Entity Fetching & Validation ---
    const [targetUser, targetChannel] = await Promise.all([
        client.users.fetch(targetUserId).catch(() => null),
        client.channels.fetch(channelId).catch(() => null)
    ]);

    if (!targetUser) {
        res.status(404).json({ error: 'User to request from not found.' }); return;
    }
    if (!targetChannel) {
        res.status(404).json({ error: 'Target channel for request not found.' }); return;
    }
    if (!targetChannel.isTextBased() || targetChannel.isVoiceBased()) {
        res.status(400).json({ error: 'Invalid channel type. Must be a text-based channel.' });
        return;
    }
    
    if (blocks[targetUser.id]) {
        if (blocks[targetUser.id].has(req.authorId)) {
            res.status(401).json({ error: 'User blocked you' });
            return;
        }
    }

    // --- Building the Interactive Message ---
    const requester = req.message.author;
    const embed = {
        color: 0x2b2d31,
        description: `## Payment Request\n\n<@${requester.id}> is requesting **${stringifyMoney(amount)}**.\n\n> ${description.split('\n').join('\n> ')}`,
    };

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('payrequest_confirm').setLabel('Pay').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('payrequest_decline').setLabel('Decline').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('payrequest_block').setLabel('Block').setStyle(ButtonStyle.Danger)
    );

    // --- Sending the request and handling the long-running process ---
    const requestMessage = await (targetChannel as TextChannel).send({
        content: `-# <@${targetUser.id}>`,
        embeds: [embed],
        components: [row]
    }).catch(err => {
        console.error("Failed to send payment request message:", err);
        return null;
    });

    if (!requestMessage) {
        res.status(500).json({ error: "Failed to send message in the target channel. Check bot permissions." });
        return;
    }

    // **KEY**: Send an intermediate response to the API client immediately.
    res.status(102).json({
        message: "Payment request sent successfully. Awaiting user interaction.",
        requestMessageId: requestMessage.id
    });

    const collector = requestMessage.createMessageComponentCollector({
        filter: i => i.user.id === targetUser.id,
        time: 1000 * 60 * 60 * 48, // 48 hours
    });

    collector.on('collect', async interaction => {
        // Acknowledge the interaction so it doesn't time out, but send no visible reply.
        // This is the key to preventing the "Already Replied" error.
        //await interaction.deferUpdate();

        let finalEmbed = { ...embed }; // copy original embed

        if (interaction.customId === 'payrequest_confirm') {
            if (!interaction.isButton()) return;
            const paymentInfo = await economy!.pay(targetUser, requester, amount, interaction);
            if (paymentInfo) {
                finalEmbed.description += `\n\n*<@${targetUser.id}> accepted the request.*`;
                // Send the FINAL response back to the original API caller
                res.status(200).json({ type: "accepted", message: "Payment request accepted.", paymentInfo });
            } else {
                finalEmbed.description += `\n\n*<@${targetUser.id}>'s payment failed, likely due to insufficient funds.*`;
                // Send the FINAL response back to the original API caller
                res.status(500).json({ type: "payment_failed", message: "Payment failed." });
            }
        } else if (interaction.customId === 'payrequest_decline') {
            finalEmbed.description += `\n\n*<@${targetUser.id}> declined the request.*`;
            res.status(200).json({ type: "declined", message: "Payment request declined by user." });
        } else if (interaction.customId === 'payrequest_block') {
            finalEmbed.description += `\n\n*<@${targetUser.id}> declined the request and blocked the requester.*`;
            // TODO: Block logic
            if (!blocks[interaction.user.id]) {
                blocks[interaction.user.id] = new Set();
            }
            blocks[interaction.user.id].add(requester.id);
            res.status(200).json({ type: "blocked", message: "Payment request declined and requester blocked." });
        }

        // Edit the interactive message with the final outcome.
        // We already deferred the update, so we use editReply.
        await requestMessage.edit({ embeds: [finalEmbed], components: [] });

        // Stop the collector since we have our answer.
        collector.stop();
    });

collector.on('end', (collected, reason) => {
    if (reason === 'time' && collected.size === 0) {
        // No one responded, request expired.
        const finalEmbed = { ...embed };
        finalEmbed.description += `\n\n*This payment request has expired.*`;
        requestMessage.edit({ embeds: [finalEmbed], components: [] }).catch(() => { });
        console.log(`[BotAPIServer] Payrequest ${requestMessage.id} expired.`);
    }
});

}, 'Requests a payment from another user. Requires `amount` and `channel` query params, and a `description` in the JSON body.');
