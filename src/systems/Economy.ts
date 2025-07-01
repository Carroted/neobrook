import { ActionRowBuilder, ButtonInteraction, ChatInputCommandInteraction, Client, EmbedBuilder, Events, Message, ModalBuilder, ModalSubmitInteraction, PermissionsBitField, TextChannel, TextInputBuilder, TextInputStyle, User, UserContextMenuCommandInteraction, type APIEmbed, type APIEmbedField, type Interaction, type MessageCreateOptions, type ModalActionRowComponentBuilder, type OmitPartialGroupDMChannel } from "discord.js";
import Database from "bun:sqlite";
import type Orgs from "./Orgs";
import type { Org } from "./Orgs";
import { ECONOMY_NAME_PLURAL, ECONOMY_PREFIX, ECONOMY_SUFFIX_PLURAL, ECONOMY_SUFFIX_SINGULAR } from "../constants";
import numberWithCommas from "../numberWithCommas";
import type WizardHelper from "./WizardHelper";

/** Stringify money using specified prefix and suffix, as well as number formatting. */

function stringifyMoney(money: number) {
    let suffix = money === 1 ? ECONOMY_SUFFIX_SINGULAR : ECONOMY_SUFFIX_PLURAL;
    return ECONOMY_PREFIX + numberWithCommas(money) + suffix;
}

export { stringifyMoney };

export default class Economy {
    db: Database;
    orgs: Orgs;
    client: Client;
    wizardHelper: WizardHelper;

    constructor(db: Database, orgs: Orgs, client: Client, wizardHelper: WizardHelper) {
        this.db = db;
        this.orgs = orgs;
        this.client = client;
        this.wizardHelper = wizardHelper;

        db.run("create table if not exists economy (user_id text, money integer);");
        db.run("create table if not exists transactions (transaction_id text, sender text, recipient text, amount_sent integer, amount_received integer, date integer);");
        // item types are string (the type) and it has name and emoji and manufacturers string (json)
        db.run("create table if not exists item_types (type text, name text, emoji text, manufacturers text, owner text);");
        // manufacturer data also in manufacturers table
        db.run("create table if not exists manufacturers (user text, type text);");
        // inventories table has a row for each player inventory, with just json
        db.run("create table if not exists inventories (user_id text, items text);");
        db.run("create table if not exists claimed_starter (user_id text);");

        // items can have Uses. discard is whether or not to destroy the item after use
        db.run("create table if not exists item_uses (item_type text, discard integer, data text);");

        let claimedStarter = (user_id: string): boolean => {
            const stmt = this.db.prepare("select * from claimed_starter where user_id = ?;");
            const row = stmt.get(user_id);
            if (row) {
                return true;
            } else {
                return false;
            }
        };

        interface ItemUse {
            discard: boolean;
            data: {
                type: "role" | "http" | "command" | "message", // message will just do nothing other than the message. http returns response as message override
                value: string, // this is for example role ID, http url, or text command. we will replace $USER with user id of one who used it and $CHANNEL with channel id they used it in etc and $AMOUNT
                message: string,
                ephemeral: boolean, // if true, message will be ephemeral
                place: string, // for role this is server ID, for http and message this has nothing, for command this is channel ID to run it.
            }
        }
        let getItemUse = (item_type: string): ItemUse | null => {
            const stmt = this.db.prepare("select * from item_uses where item_type = ?;");
            const row = stmt.get(item_type) as any;
            if (row) {
                return { discard: row.discard === 1, data: JSON.parse(row.data) };
            } else {
                return null;
            }
        };

        let setItemUse = (item_type: string, use: ItemUse | null): void => {
            if (!use) {
                const stmt = this.db.prepare("delete from item_uses where item_type = ?;");
                stmt.run(item_type);
            } else {
                let existing = getItemUse(item_type);

                if (existing) {
                    // update, set discard and data
                    const stmt = this.db.prepare("update item_uses set discard = ?, data = ? where item_type = ?");
                    stmt.run(use.discard ? 1 : 0, JSON.stringify(use.data), item_type);
                } else {
                    // insert new row
                    const stmt = this.db.prepare("insert into item_uses (item_type, discard, data) values (?, ?, ?)");
                    stmt.run(item_type, use.discard ? 1 : 0, JSON.stringify(use.data));
                }
            }
        };

        if (this.sum() === 0) {
            this.changeMoney('1183134058415394846', 1000000);
            console.log('g');
        } else {
            console.log('Sum good');
        }

        this.client.on(Events.InteractionCreate, async (interaction) => {
            try {
                if (interaction.isAutocomplete()) {
                    const focusedOption = interaction.options.getFocused(true);
                    if (focusedOption.name === 'type' && interaction.commandName === 'item') {
                        const types = this.getAllItemTypes();
                        let matching = types.filter((type) => type.includes(focusedOption.value.toLowerCase()));
                        // filter to at most 25
                        matching = matching.slice(0, 25);
                        await interaction.respond(matching.map((choice) => { return { name: choice, value: choice }; }));
                    }
                }

                if (interaction.isChatInputCommand()) {
                    if (interaction.commandName === 'tutorial') {
                        interaction.reply({
                            content: '## Brook Tutorial\n\nGreetings mortal. Brook is a bot with Economy, Utilities, and Items. We also have Games, but most only work within the Brook server itself, which this bot is made for.\n\nHowever, economy and items work everywhere.\n\nIn the life of a brooked, we often want to create our very own Items. In order to do this, you have to first make an Org, a group of people.\n\nSo first, run `/org create`. Then you\'ll have an org you can use to make your items.\n\nAnd so then, you can do `/item createtype`. This allows you to make your own kind of item, such as Guns, Apples, etc.\n\nAfter creating your item type, you can manufacture some of your item with `/item create`. And then bam, you have items. Check your `/inventory` to see em\n\nNow you can Sell these to people. Ask them to `/pay` you in exchange for your product, which you\'ll hand over with a `/item give`. You are now a Manufacturer and they are the Consumer\n\nYou can also make your items do stuff. If you add brook to your server, you can make an item that gives someone a role in your server. You can also make items that run text chat commands (not slash commands but traditional prefix ones), or an item which just says a message, or even makes an HTTP request. All of these functionalities are set up with `/item setuse` and happen when users do `/item use`.\n\nLastly, you may wonder how to get Brook Currency, other than selling things. Joiners of brook server (which bot was made for) can do `/claim` there for ' + stringifyMoney(50000) + ' (currency of the bot). In [brook server](<https://discord.gg/FuHtxRQK6s>) you can also do `/cashier` to earn some.',
                            ephemeral: true,
                        });
                    } else if (interaction.commandName === 'claim') {
                        if (interaction.user.bot) {
                            await interaction.reply({ content: 'This command is only available to realers.', ephemeral: true });
                            return;
                        }
                        if (interaction.guildId !== '1224881201379016825') {
                            await interaction.reply({ content: 'This command is only available in the main server.', ephemeral: true });
                            return;
                        }
                        if (!interaction.member) {
                            // not allowed
                            await interaction.reply({ content: 'You must be a member of the server to claim your starter.', ephemeral: true });
                            return;
                        }
                        const activeRole = '1228879761036677130';
                        if (Array.isArray(interaction.member.roles)) {
                            // check if they have the role
                            if (!interaction.member.roles.includes(activeRole)) {
                                await interaction.reply({ content: `You must have the <@&${activeRole}> role to claim your starter ${ECONOMY_NAME_PLURAL}.`, ephemeral: true });
                                return;
                            }
                        }
                        if (!claimedStarter(interaction.user.id)) {
                            const stmt = this.db.prepare("insert into claimed_starter (user_id) values (?);");
                            stmt.run(interaction.user.id);

                            this.changeMoney(interaction.user.id, 1000);
                            this.changeMoney('1183134058415394846', -1000);

                            await interaction.reply({ content: `You have claimed your starter ${ECONOMY_NAME_PLURAL}! You now have **${stringifyMoney(this.getMoney(interaction.user.id))}**.`, ephemeral: false });
                            let msg = await interaction.fetchReply();
                            this.registerTransaction(msg.url, '1183134058415394846', interaction.user.id, 1000, 1000);
                        } else {
                            await interaction.reply({ content: `You have already claimed your starter ${ECONOMY_NAME_PLURAL}.`, ephemeral: true });
                        }
                    }
                    else if (interaction.commandName === 'admin') {
                        if (interaction.options.getSubcommand() === 'deletetype') {
                            const type = interaction.options.getString('type', true);
                            this.db.run('delete from item_types where type=?', [type]);
                            await interaction.reply({ content: `Deleted item type ${type}.`, ephemeral: false });
                        }
                        if (interaction.options.getSubcommand() === 'pay') {
                            const user1 = interaction.options.getUser('person1', true);
                            const user2 = interaction.options.getUser('person2', true);
                            const amount = interaction.options.getInteger('amount', true);

                            this.pay(user1, user2, amount, interaction, true);
                        }
                    }
                    else if (interaction.commandName === 'pay') {
                        const amount = Math.abs(interaction.options.getInteger('amount', true));

                        if (interaction.options.getSubcommand() === 'user') {
                            const user = interaction.options.getUser('target', true);

                            this.pay(interaction.user, user, amount, interaction);
                        } else if (interaction.options.getSubcommand() === 'org') {
                            const id = interaction.options.getString('id', true);

                            const org = this.orgs.getOrg(id);

                            if (!org) {
                                await interaction.reply('Specified org doesn\'t exist!');
                            } else {
                                this.pay(interaction.user, org, amount, interaction);
                            }
                        }
                    } else if (interaction.commandName === 'balance') {
                        let money = this.getMoney(interaction.user.id);

                        let profile = {
                            name: interaction.user.displayName,
                            avatar: interaction.user.displayAvatarURL(),
                            id: interaction.user.id,
                        };

                        let member = interaction.member;

                        if (member) {
                            if ('displayName' in member) {
                                profile.name = member.displayName;
                            }
                            if ('displayAvatarURL' in member) {
                                profile.avatar = member.displayAvatarURL();
                            }
                        };

                        await interaction.reply({
                            embeds: [
                                {
                                    color: 0x2b2d31,
                                    author: {
                                        name: profile.name,
                                        icon_url: profile.avatar,
                                    },
                                    description: `# ${stringifyMoney(money)}\nYour balance`,
                                }
                            ],
                            ephemeral: true,
                        });
                    } else if (interaction.commandName === 'transactions') {
                        let transactions = this.getTransactions(interaction.user.id, 10);
                        if (transactions.length === 0) {
                            interaction.reply({
                                content: 'You haven\'t had any transactions yet!',
                                ephemeral: true,
                            });
                            return;
                        }

                        let embed: APIEmbed = {
                            color: 0x2b2d31,
                            description: `## Transaction History\n\nUp to 10 recent transactions are displayed.\n\n` + transactions.map(transaction => {
                                // if its to us, start with +
                                let regex = /^[0-9]+$/;
                                if (transaction.recipient === interaction.user.id) {
                                    let formatted = regex.test(transaction.sender) ? `<@${transaction.sender}>` : `${transaction.sender}`;
                                    return `<:plus:1309954509040124035> **${stringifyMoney(transaction.amount_received)}** (from ${formatted}) - [receipt](${transaction.transaction_id}) - <t:${Math.floor(transaction.date / 1000)}:R>`;
                                }
                                else {
                                    let formatted = regex.test(transaction.recipient) ? `<@${transaction.recipient}>` : `${transaction.recipient}`;
                                    return `<:minus:1309954499850407987> **${stringifyMoney(transaction.amount_sent)}** (to ${formatted}) - [receipt](${transaction.transaction_id}) - <t:${Math.floor(transaction.date / 1000)}:R>`;
                                }
                            }).join('\n')
                        };
                        await interaction.reply({ embeds: [embed], ephemeral: true });
                    } else if (interaction.commandName === 'leaderboard') {
                        // 1 in 5 chance
                        function randomRange(min: number, max: number) {
                            return Math.floor(Math.random() * (max - min + 1)) + min;
                        }
                        let value = randomRange(1, 10);
                        if (value < 2) {

                            let quotes = [
                                "Air isn't something that holds memories.",
                                "The tree breaks when the air remembers",
                                "The past comes back into awareness",
                                "Once, I was at the forest",
                                "While there, I saw something I wouldn't forget",
                                "It dreamed of stars",
                                "I tried to reach out, but...",
                                "There was a sudden air movement",
                                "And then our beloved tree fell",
                                "I didn't sleep that night",
                            ];
                            let quote = quotes[Math.floor(Math.random() * quotes.length)];

                            interaction.reply({
                                content: quote,
                                ephemeral: false,
                            });
                            return;
                        }

                        let moneyRankings = this.getMoneyRankings(10);
                        let embed2: APIEmbed = {
                            color: 0x2b2d31,
                            title: ECONOMY_NAME_PLURAL + ' Leaderboard',
                            description: `${stringifyMoney(this.sum())} are currently in circulation.\n\n`
                        };
                        let index2 = 0;
                        let leaderboardCount2 = 0;
                        while (true) {
                            if (index2 >= moneyRankings.length) break;
                            if (leaderboardCount2 >= 10) break;
                            let row = moneyRankings[index2];
                            let isUser = /^\d+$/.test(row.user_id);
                            if (isUser) {
                                embed2.description += `${leaderboardCount2 + 1}. <@${row.user_id}>: ${stringifyMoney(row.money)}\n`;
                            } else {
                                embed2.description += `${leaderboardCount2 + 1}. **${row.user_id}**: ${stringifyMoney(row.money)}\n`;
                            }

                            index2++;
                            leaderboardCount2++;
                        }

                        interaction.reply({ embeds: [embed2], ephemeral: true });
                    } else if (interaction.commandName === 'inventory') {
                        let inv = this.getInventory(interaction.user.id);
                        let embed2: APIEmbed = {
                            color: 0x2b2d31,
                            title: 'Inventory',
                            description: `All the items you've got`,
                            fields: [],
                        };

                        for (let item of Object.keys(inv)) {
                            let type = this.getItemType(item)!;
                            embed2.fields!.push({
                                name: `${inv[item]}x ${type.emoji} \`${item}\``,
                                value: type.name
                            });
                            if (embed2.fields?.length == 23) {
                                embed2.fields!.push({
                                    name: `youve got more but hit max embed fields`,
                                    value: `pagination coming soons!!!`
                                });
                                break;
                            }
                        }

                        interaction.reply({ embeds: [embed2], ephemeral: true });
                    } else if (interaction.commandName === 'sum') {
                        interaction.reply({ content: `The sum of all ${ECONOMY_NAME_PLURAL} is **${stringifyMoney(this.sum())}**.`, ephemeral: true });
                    } else if (interaction.commandName === 'item') {
                        if (interaction.options.getSubcommand() === 'createtype') {
                            let id = interaction.options.getString('id', true).toLowerCase().trim().replaceAll('@', '');

                            let existing = this.getItemType(id);

                            if (existing) {
                                return interaction.reply({ content: `Item type with ID **${id}** already exists.`, ephemeral: true });
                            } else {
                                this.addItemType(id, interaction.options.getString('name', true).trim(), (interaction.options.getString('emoji', false) ?? '🪨').trim(), [interaction.user.id], interaction.options.getString('org', true).trim().toLowerCase());

                                interaction.reply({ content: `Item type ${(interaction.options.getString('emoji', false) ?? '🪨').trim()} **${interaction.options.getString('name', true).trim()}** created with ID **${id}**.`, ephemeral: false });
                            }

                        } else if (interaction.options.getSubcommand() === 'create') {
                            let type = interaction.options.getString('type', true);
                            let item = this.getItemType(type);
                            if (!item) {
                                interaction.reply({ content: `Item type **${type}** does not exist.`, ephemeral: true });
                            } else {
                                let manufacturers = this.getManufacturers(type);
                                if (!manufacturers.includes(interaction.user.id)) {
                                    interaction.reply({ content: `You are not a manufacturer of the type **${type}**. You'd need to ask a manufacturer to make you be one too.`, ephemeral: false });
                                    return;
                                }
                                this.addInventoryItems(interaction.user.id, type, interaction.options.getInteger('amount', true));
                                interaction.reply({ content: `Added **${interaction.options.getInteger('amount', true)}** of item type **${type}** to your inventory.`, ephemeral: false });
                            }

                        } else if (interaction.options.getSubcommand() === 'give') {
                            let user = interaction.options.getUser('user', true);
                            let amount = interaction.options.getInteger('amount', false) || 1;
                            let type = interaction.options.getString('type', true);

                            let inventoryA = this.getInventory(interaction.user.id);
                            let inventoryB = this.getInventory(user.id);

                            if (!inventoryA[type]) {
                                interaction.reply({
                                    content: `You don't have any **${type}** in your inventory.`, ephemeral: true,
                                    allowedMentions: { parse: [] },
                                });
                                return;
                            }
                            if (inventoryA[type] < amount) {
                                interaction.reply({
                                    content: `You don't have enough **${type}** in your inventory.`, ephemeral: true,
                                    allowedMentions: { parse: [] },
                                });
                                return;
                            }

                            this.removeInventoryItems(interaction.user.id, type, amount); // Remove from sender's inventory
                            this.addInventoryItems(user.id, type, amount); // Add to receiver's inventory

                            interaction.reply({ content: `You have successfully transferred **${amount}** **${type}** to ${user}.`, ephemeral: false });
                        } else if (interaction.options.getSubcommand() === 'use') {
                            let amount = interaction.options.getInteger('amount', false) || 1;
                            let type = interaction.options.getString('type', true);

                            let inventory = this.getInventory(interaction.user.id);

                            if (!inventory[type]) {
                                interaction.reply({
                                    content: `You don't have any **${type}** in your inventory.`, ephemeral: true,
                                    allowedMentions: { parse: [] },
                                });
                                return;
                            }
                            if (inventory[type] < amount) {
                                amount = inventory[type];
                            }

                            let use = getItemUse(type);
                            if (!use) {
                                interaction.reply({
                                    content: `The item **${type}** cannot be used.`, ephemeral: true,
                                    allowedMentions: { parse: [] },
                                });
                                return;
                            }

                            let formattedValue = use.data.value.replaceAll('$USER', interaction.user.id).replaceAll('$AMOUNT', amount.toString()).replaceAll('$CHANNEL', interaction.channelId);
                            let formattedMessage = use.data.message.replaceAll('$USER', interaction.user.id).replaceAll('$AMOUNT', amount.toString()).replaceAll('$CHANNEL', interaction.channelId);

                            if (use.data.type === 'message') {
                                if (use.discard) {
                                    this.removeInventoryItems(interaction.user.id, type, amount); // Remove from sender's inventory
                                }
                                interaction.reply({
                                    content: `You used **${amount}x ${type}**.\n\n> ${(formattedValue + formattedMessage).split('\n').join('\n> ')}`, ephemeral: use.data.ephemeral,
                                    allowedMentions: { parse: [] },
                                });
                            } else if (use.data.type === 'command') {
                                // use.data.place is channel id
                                let channel = await this.client.channels.fetch(use.data.place);
                                if (!channel || !channel.isSendable()) {
                                    interaction.reply({
                                        content: `Item use failed. It is trying to run a command in channel of ID ${use.data.place}, but that isnt a channel i can access (or it isnt a text channel).\n\nTell item owner to change the use of the item to fix this.`, ephemeral: false,
                                        allowedMentions: { parse: [] },
                                    });
                                    return; // dont discard
                                }

                                if (formattedValue.trim().startsWith('1183134058415394846!api pay ')) {
                                    interaction.reply({
                                        content: `Item use failed. It is trying to make me pay someone. This is Illegal.\n\nTell item owner to change the use of the item to fix this.`, ephemeral: false,
                                        allowedMentions: { parse: [] },
                                    });
                                    return;
                                }

                                if (use.discard) {
                                    this.removeInventoryItems(interaction.user.id, type, amount); // Remove from sender's inventory
                                }

                                // use.data.value is the thing to send
                                await channel.send({ content: formattedValue, allowedMentions: { parse: [] } }); // Send the message to the channel

                                // reply to user
                                interaction.reply({ content: `You used **${amount}x ${type}**.\n\n> ${formattedMessage.split('\n').join('\n> ')}`, ephemeral: use.data.ephemeral });
                            } else if (use.data.type === 'role') {
                                // use.data.value is the role id to give. place is the server id
                                let guild = await client.guilds.fetch(use.data.place);
                                if (!guild) {
                                    interaction.reply({
                                        content: `Item use failed. It is trying to give a role in server of ID ${use.data.place}, but that isnt a server i can access.\n\nTell item owner to change the use of the item to fix this.`, ephemeral: false,
                                        allowedMentions: { parse: [] },
                                    });
                                    return;
                                }

                                let role = await guild.roles.fetch(use.data.value);
                                if (!role) {
                                    interaction.reply({
                                        content: `Item use failed. It is trying to give a role of ID ${use.data.value}, but that isn't a role in the server.\n\nTell item owner to change the use of the item to fix this.`, ephemeral: false,
                                        allowedMentions: { parse: [] },
                                    });
                                    return;
                                }

                                let member = await guild.members.fetch(interaction.user.id);
                                if (!member) {
                                    interaction.reply({ content: `Item use failed. It is trying to give a role to you, but you either aren't a member in the server or I don't have the perms for this.`, ephemeral: false });
                                    return;
                                }
                                if (member.roles.cache.has(role.id)) {
                                    interaction.reply({ content: `Item use failed. You already have the role this would give you.`, ephemeral: false });
                                    return;
                                }

                                member.roles.add(role.id).catch((err) => {
                                    interaction.reply({ content: `Item use failed. It is trying to give a role to you, but I don't have the perms for this.`, ephemeral: false });
                                    console.error(err);
                                }).then(() => {
                                    if (use.discard) {
                                        this.removeInventoryItems(interaction.user.id, type, amount); // Remove from sender's inventory
                                    }

                                    interaction.reply({
                                        content: `You used **${amount}x ${type}**.\n\n> ${(formattedMessage).split('\n').join('\n> ')}\n\nYou have been given <@&${role.id}>.`,
                                        ephemeral: use.data.ephemeral,
                                        allowedMentions: { parse: [] },
                                    });
                                });
                            } else if (use.data.type === 'http') {
                                // value is the url. no body or anything, they can use query params like ?amount=$AMOUNT and the above will format it for that
                                if (use.discard) {
                                    this.removeInventoryItems(interaction.user.id, type, amount); // Remove from sender's inventory
                                }

                                // result of the request (as text, not json) will be appended to the message

                                await fetch(use.data.value, { method: 'GET' }).then(async res => {
                                    const text = await res.text();
                                    await interaction.reply({
                                        content: `You used **${amount}x ${type}**.\n\n> ${(formattedMessage + text).split('\n').join('\n> ')}`,
                                        ephemeral: use.data.ephemeral,
                                        allowedMentions: { parse: [] },
                                    });
                                });
                            }
                        } else if (interaction.options.getSubcommand() === 'setemoji') {
                            let type = interaction.options.getString('type', true);

                            // first make sure exists
                            let item = this.getItemType(type);
                            if (!item) {
                                interaction.reply({ content: `Item type **${type}** does not exist.`, ephemeral: true });
                                return;
                            }

                            // now make sure they are the owner of the org
                            let org = this.orgs.getOrg(item.owner);
                            if (!org) {
                                interaction.reply({ content: `Something fishy is happening. I can feel it`, ephemeral: true });
                                return;
                            }

                            if (org.owner !== interaction.user.id) {
                                interaction.reply({ content: `You are not the owner of the org that owns the item type`, ephemeral: true });
                                return;
                            }

                            // now we can set the emoji
                            let emoji = interaction.options.getString('emoji', true);

                            this.setItemEmoji(type, emoji.trim());
                            interaction.reply(`The emoji for item type **${type}** has been set to ${emoji.trim()}.`);
                        } else if (interaction.options.getSubcommand() === 'setname') {
                            let type = interaction.options.getString('type', true);

                            // first make sure exists
                            let item = this.getItemType(type);
                            if (!item) {
                                interaction.reply({ content: `Item type **${type}** does not exist.`, ephemeral: true });
                                return;
                            }

                            // now make sure they are the owner of the org
                            let org = this.orgs.getOrg(item.owner);
                            if (!org) {
                                interaction.reply({ content: `Something fishy is happening. I can feel it`, ephemeral: true });
                                return;
                            }

                            if (org.owner !== interaction.user.id) {
                                interaction.reply({ content: `You are not the owner of the org that owns the item type`, ephemeral: true });
                                return;
                            }

                            // now we can set the name
                            let name = interaction.options.getString('name', true);

                            this.setItemName(type, name.trim());
                            interaction.reply(`The name for item type **${type}** has been set to ${name.trim()}.`);
                        } else if (interaction.options.getSubcommand() === 'setuse') {
                            if (!interaction.guildId) {
                                await interaction.reply({
                                    content: 'This command can only be used in a server.',
                                    ephemeral: true,
                                });
                                return;
                            }

                            let type = interaction.options.getString('type', true);

                            // first make sure exists
                            let item = this.getItemType(type);
                            if (!item) {
                                interaction.reply({ content: `Item type **${type}** does not exist.`, ephemeral: true });
                                return;
                            }

                            // now make sure they are the owner of the org
                            let org = this.orgs.getOrg(item.owner);
                            if (!org) {
                                interaction.reply({ content: `Something fishy is happening. I can feel it`, ephemeral: true });
                                return;
                            }

                            if (org.owner !== interaction.user.id) {
                                interaction.reply({ content: `You are not the owner of the org that owns the item type`, ephemeral: true });
                                return;
                            }

                            await interaction.reply({
                                content: 'When `/item use` is ran, if there\'s a **Use** configured for the item, it will happen.\n\n4 types of item uses exist: `role`, `http`, `command`, and `message`.\n\n**role**: Assigns a role to the user who used the item.\n**http**: Sends an HTTP/HTTPS request to a URL.\n**command**: Sends a message to a specified channel. Intended to be used to run text commands.\n**message**: All item uses also send a Message to the user. But unlike the other types, this one **only** has a message, and doesn\'t do anything else.\n\nPlease specify the type of use you want to set for the item. (`role`, `http`, `command`, or `message`)\n\nYou can also say `none` to clear the item use.', ephemeral: false
                            });

                            let channel = interaction.channel as TextChannel;

                            let response = (await this.wizardHelper.getResponse({
                                channelID: channel.id,
                                userID: interaction.user.id,
                            })).content.trim().toLowerCase();

                            if (response === 'none') {
                                setItemUse(type, null);

                                await channel.send('You have set the use of `' + type + '` to **nothing**.');
                                return;
                            } else if (response === 'role') {
                                await channel.send(`What is the server ID where the role is?\n\n-# Consult [this Discord support page](<https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID>) if you don't know how to get IDs.`);

                                response = (await this.wizardHelper.getResponse({
                                    channelID: channel.id,
                                    userID: interaction.user.id,
                                })).content.trim().toLowerCase();

                                if (!response.match(/^\d+$/)) {
                                    await channel.send(`Sorry, that isn't a valid server ID.\n\nAborting.`);
                                    return;
                                }

                                if (response === '1224881201379016825' && interaction.user.id !== '742396813826457750') {
                                    await channel.send(`Fuck you\nAborting.`);
                                    return;
                                }

                                const guild = await this.client.guilds.fetch(response).catch(() => null);
                                if (!guild) {
                                    await channel.send(`Sorry, I couldn't find that server. I need to be in it, for this to work.\n\nAborting.`);
                                    return;
                                }

                                let me = await guild.members.fetchMe().catch(() => null);

                                if (!me) {
                                    await channel.send(`Sorry, I couldn't fetch my own member info for that server.\n\nAborting.`);
                                    return;
                                }

                                // make sure we have manage roles
                                if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                                    await channel.send(`Sorry, I don't have permission to manage roles in that server.\n\nAborting.`);
                                    return;
                                }
                                // make sure that user also has manage roles in that server
                                let them = await guild.members.fetch(interaction.user.id).catch(() => null);
                                if (!them) {
                                    await channel.send(`Sorry, I couldn't fetch your member info for that server.\n\nAborting.`);
                                    return;
                                }
                                if (!them.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
                                    await channel.send(`Sorry, you don't have permission to manage roles in that server.\n\nAborting.`);
                                    return;
                                }

                                await channel.send(`Ok, now I need the Role ID. Send that here now.`);

                                response = (await this.wizardHelper.getResponse({
                                    channelID: channel.id,
                                    userID: interaction.user.id,
                                })).content.trim().toLowerCase();

                                if (!response.match(/^\d+$/)) {
                                    await channel.send(`Sorry, that isn't a valid role ID.\n\nAborting.`);
                                    return;
                                }

                                const role = guild.roles.cache.get(response);
                                if (!role) {
                                    await channel.send(`Sorry, I couldn't find that role in the server.\n\nAborting.`);
                                    return;
                                }

                                // check our highest role
                                const highestRole = me.roles.highest.position;
                                if (highestRole <= role.position) {
                                    await channel.send(`Sorry, I don't have permission to assign that role.\n\nAborting.`);
                                    return;
                                }
                                const theirHighestRole = them.roles.highest.position;
                                if (theirHighestRole <= role.position) {
                                    await channel.send(`Sorry, you can't give someone a role higher than your own.\n\nAborting.`);
                                    return;
                                }

                                await channel.send('Ok I think i have perms to add that. Now, what Message should be sent when the item is used?\n\nIt will be in a quote in the `/item use` message.\n\n### Advanced Features\nIf you put in "$USER", it will be replaced with the User ID of person who used message. $CHANNEL will be channel ID of where used, and $AMOUNT will be how many of the item they used at once. For example, if you say "Wow! You just used $AMOUNT of my thing!" itll say how many they used.');

                                response = (await this.wizardHelper.getResponse({
                                    channelID: channel.id,
                                    userID: interaction.user.id,
                                })).content.trim();

                                if (response.length > 200) {
                                    await channel.send('Your message is too long! Please keep it under 200 characters. Aborting indeed');
                                    return;
                                }

                                let msg = response;

                                await channel.send('Now, should the item be discarded when it is used? Like for example, should they still have it after using it, or the item is destroyed after use? Say just `yes` or `no`');

                                response = (await this.wizardHelper.getResponse({
                                    channelID: channel.id,
                                    userID: interaction.user.id,
                                })).content.trim().toLowerCase();

                                if (response !== 'yes' && response !== 'no') {
                                    await channel.send('Invalid response! Please respond with "yes" or "no". Aborting.');
                                    return;
                                }
                                let discard = response === 'yes';

                                await channel.send('Lastly, should the `/item use` message be Ephemeral? (yes/no)\n\nIf yes, others wont see it, only the user will');

                                response = (await this.wizardHelper.getResponse({
                                    channelID: channel.id,
                                    userID: interaction.user.id,
                                })).content.trim().toLowerCase();

                                if (response !== 'yes' && response !== 'no') {
                                    await channel.send('Invalid response! Please respond with "yes" or "no". Aborting.');
                                    return;
                                }

                                let ephemeral = response === 'yes';

                                setItemUse(type, {
                                    discard,
                                    data: {
                                        type: 'role',
                                        ephemeral,
                                        message: msg,
                                        place: guild.id,
                                        value: role.id,
                                    }
                                });

                                await channel.send(`Item use for ${type} has been set to ${discard ? 'discard' : 'keep'} the item and to add a role to the user. Congrats!`);
                            } else if (response === 'http') {
                                await channel.send('Please provide the URL of the HTTP request to be made when using this item.\n\nAll options should be included in the URL. For example, `https://example.com/api?user=$USER&amount=$AMOUNT`.\n\nThe text returned by the request will be included in the `/item use` message.\n\nThe following variables are available:\n- `$USER`: The user who is using the item.\n- `$AMOUNT`: The amount of items being used.\n- `$CHANNEL`: The channel where the item is being used.');

                                response = (await this.wizardHelper.getResponse({
                                    channelID: channel.id,
                                    userID: interaction.user.id,
                                })).content.trim();

                                if (!response.startsWith('http://') && !response.startsWith('https://')) {
                                    await channel.send('Needs start with either http:// or https://, aborting.');
                                    return;
                                }

                                let url = response;

                                await channel.send('Ok that looks real. Now, what Message should be sent when the item is used?\n\nIt will be in a quote in the `/item use` message.\n\nOnce more, the same vars like $USER and $AMOUNT and $CHANNEL work.\n\nThe returned text from the request is appended after the Message you will now specify. You can also say `none` to only us the request text.');

                                response = (await this.wizardHelper.getResponse({
                                    channelID: channel.id,
                                    userID: interaction.user.id,
                                })).content.trim();

                                if (response.length > 200) {
                                    await channel.send('Your message is too long! Please keep it under 200 characters. Aborting indeed');
                                    return;
                                }

                                let msg = response;

                                if (response.toLowerCase() === 'none') {
                                    msg = '';
                                }

                                await channel.send('Now, should the item be discarded when it is used? Like for example, should they still have it after using it, or the item is destroyed after use? Say just `yes` or `no`');

                                response = (await this.wizardHelper.getResponse({
                                    channelID: channel.id,
                                    userID: interaction.user.id,
                                })).content.trim().toLowerCase();

                                if (response !== 'yes' && response !== 'no') {
                                    await channel.send('Invalid response! Please respond with "yes" or "no". Aborting.');
                                    return;
                                }
                                let discard = response === 'yes';

                                await channel.send('Lastly, should the `/item use` message be Ephemeral? (yes/no)\n\nIf yes, others wont see it, only the user will');

                                response = (await this.wizardHelper.getResponse({
                                    channelID: channel.id,
                                    userID: interaction.user.id,
                                })).content.trim().toLowerCase();

                                if (response !== 'yes' && response !== 'no') {
                                    await channel.send('Invalid response! Please respond with "yes" or "no". Aborting.');
                                    return;
                                }

                                let ephemeral = response === 'yes';

                                setItemUse(type, {
                                    discard,
                                    data: {
                                        type: 'http',
                                        ephemeral,
                                        message: msg,
                                        place: '',
                                        value: url,
                                    }
                                });

                                await channel.send({
                                    content: `Item use for ${type} has been set to ${discard ? 'discard' : 'keep'} the item and to make a request to \`${url}\`. Congrats!`,
                                    allowedMentions: { parse: [] },
                                });

                            } else if (response === 'command') {
                                await channel.send('What message should I send (text command) when the item is used?\n\nThe following variables are available:\n- `$USER`: The user who is using the item.\n- `$AMOUNT`: The amount of items being used.\n- `$CHANNEL`: The channel where the item is being used.');

                                response = (await this.wizardHelper.getResponse({
                                    channelID: channel.id,
                                    userID: interaction.user.id,
                                })).content.trim();

                                if (response.length > 2000) {
                                    await channel.send('The message is too long. Please keep it under 2000 characters. Aborting.');
                                    return;
                                }

                                let cmd = response;

                                await channel.send('Whats the Channel ID where it should be sent? Needs to be a text channel I can access.\n\nDon\'t use $CHANNEL, it needs to be a specific one, where you have some other bot that will listen for it.');

                                response = (await this.wizardHelper.getResponse({
                                    channelID: channel.id,
                                    userID: interaction.user.id,
                                })).content.trim().toLowerCase();

                                if (!response.match(/^\d+$/)) {
                                    await channel.send(`Sorry, that isn't a valid channel ID.\n\nAborting.`);
                                    return;
                                }

                                let channelID = response;
                                let c = await this.client.channels.fetch(channelID).catch(() => null);;
                                if (!c || !c.isTextBased() || !c.isSendable() || c.isDMBased()) {
                                    await channel.send(`Sorry, that isn't a valid text channel, or I cant access it.\n\nAborting.`);
                                    return;
                                }

                                // make sure that user has permission to speak in that channel
                                let user = await c.guild.members.fetch(interaction.user.id).catch(() => null);

                                if (!user) {
                                    await channel.send(`Sorry, I can't find you in that guild. Maybe you're not a member?\n\nAborting.`);
                                    return;
                                }

                                let perms = c.permissionsFor(user).has(PermissionsBitField.Flags.ManageWebhooks);

                                if (!perms) {
                                    await channel.send(`Sorry, you don't have permission to manage webhooks there.\n\nAborting.`);
                                    return;
                                }

                                await channel.send('Ok that looks real. Now, what Message should be sent when the item is used?\n\nIt will be in a quote in the `/item use` message.\n\nOnce more, the same vars like $USER and $AMOUNT and $CHANNEL work.');

                                response = (await this.wizardHelper.getResponse({
                                    channelID: channel.id,
                                    userID: interaction.user.id,
                                })).content.trim();

                                if (response.length > 200) {
                                    await channel.send('Your message is too long! Please keep it under 200 characters. Aborting indeed');
                                    return;
                                }

                                let msg = response;

                                await channel.send('Now, should the item be discarded when it is used? Like for example, should they still have it after using it, or the item is destroyed after use? Say just `yes` or `no`');

                                response = (await this.wizardHelper.getResponse({
                                    channelID: channel.id,
                                    userID: interaction.user.id,
                                })).content.trim().toLowerCase();

                                if (response !== 'yes' && response !== 'no') {
                                    await channel.send('Invalid response! Please respond with "yes" or "no". Aborting.');
                                    return;
                                }
                                let discard = response === 'yes';

                                await channel.send('Lastly, should the `/item use` message be Ephemeral? (yes/no)\n\nIf yes, others wont see it, only the user will');

                                response = (await this.wizardHelper.getResponse({
                                    channelID: channel.id,
                                    userID: interaction.user.id,
                                })).content.trim().toLowerCase();

                                if (response !== 'yes' && response !== 'no') {
                                    await channel.send('Invalid response! Please respond with "yes" or "no". Aborting.');
                                    return;
                                }

                                let ephemeral = response === 'yes';

                                setItemUse(type, {
                                    discard,
                                    data: {
                                        type: 'command',
                                        ephemeral,
                                        message: msg,
                                        place: c.id,
                                        value: cmd,
                                    }
                                });

                                await channel.send({
                                    content: `Item use for ${type} has been set to ${discard ? 'discard' : 'keep'} the item and to send \`${cmd}\` to <#${c.id}>. Congrats!`,
                                    allowedMentions: { parse: [] },
                                });
                            } else if (response === 'message') {
                                await channel.send('What Message should be sent when the item is used?\n\nIt will be in a quote in the `/item use` message.\n\n### Advanced Features\nIf you put in "$USER", it will be replaced with the User ID of person who used message. $CHANNEL will be channel ID of where used, and $AMOUNT will be how many of the item they used at once. For example, if you say "Wow! You just used $AMOUNT of my thing!" itll say how many they used.');

                                response = (await this.wizardHelper.getResponse({
                                    channelID: channel.id,
                                    userID: interaction.user.id,
                                })).content.trim();

                                if (response.length > 200) {
                                    await channel.send('Your message is too long! Please keep it under 200 characters. Aborting indeed');
                                    return;
                                }

                                let msg = response;

                                await channel.send('Now, should the item be discarded when it is used? Like for example, should they still have it after using it, or the item is destroyed after use? Say just `yes` or `no`');

                                response = (await this.wizardHelper.getResponse({
                                    channelID: channel.id,
                                    userID: interaction.user.id,
                                })).content.trim().toLowerCase();

                                if (response !== 'yes' && response !== 'no') {
                                    await channel.send('Invalid response! Please respond with "yes" or "no". Aborting.');
                                    return;
                                }
                                let discard = response === 'yes';

                                await channel.send('Lastly, should the `/item use` message be Ephemeral? (yes/no)\n\nIf yes, others wont see it, only the user will');

                                response = (await this.wizardHelper.getResponse({
                                    channelID: channel.id,
                                    userID: interaction.user.id,
                                })).content.trim().toLowerCase();

                                if (response !== 'yes' && response !== 'no') {
                                    await channel.send('Invalid response! Please respond with "yes" or "no". Aborting.');
                                    return;
                                }

                                let ephemeral = response === 'yes';

                                setItemUse(type, {
                                    discard,
                                    data: {
                                        type: 'message',
                                        ephemeral,
                                        message: msg,
                                        place: '',
                                        value: '',
                                    }
                                });

                                await channel.send({
                                    content: `Item use for ${type} has been set to ${discard ? 'discard' : 'keep'} the item and to send a Message. Congrats!`,
                                    allowedMentions: { parse: [] },
                                });
                            } else {
                                await channel.send('You have to pick one of the provided. Aborting.');
                                return;
                            }
                        } else if (interaction.options.getSubcommand() === 'types') {
                            let types = this.getItemTypesCanManufacture(interaction.user.id);
                            if (types.length === 0) {
                                interaction.reply({ content: `You can't manufacture any items at the moment. You can either have someone add you as a manufacturer (/item addmanufacturer) or you can create a new type (/item createtype).`, ephemeral: true })
                                return;
                            }
                            let stringTypes = types.map(type => `**${type}**`).join(', ');
                            interaction.reply({ content: `You can manufacture the following types: ${stringTypes}.`, ephemeral: true });
                        } else if (interaction.options.getSubcommand() === 'alltypes') {
                            let types = this.getAllItemTypes();
                            if (types.length === 0) {
                                interaction.reply({ content: `None exist right now. You can create a new type (/item createtype).`, ephemeral: true })
                                return;
                            }
                            let stringTypes = types.map(type => `**${type}**`).join(', ');

                            let content = `These types exist: ${stringTypes}.`;

                            // trim to max 2000 chars
                            if (content.length > 2000) {
                                let endString = '... (rest omitted to keep under 2k chars)';
                                content = content.substring(0, 2000 - endString.length - 1) + endString;
                            }
                            interaction.reply({ content, ephemeral: true });
                        } else if (interaction.options.getSubcommand() === 'type') {
                            let type = interaction.options.getString('type', true);
                            let item = this.getItemType(type);
                            if (!item) {
                                interaction.reply({ content: `Item type **${type}** does not exist.`, ephemeral: true });
                            } else {
                                interaction.reply({ content: `## ${item.emoji} ${item.name}\nThis item type is owned by ${item.owner}.`, ephemeral: true });
                            }
                        } else if (interaction.options.getSubcommand() === 'destroy') {
                            let type = interaction.options.getString('type', true);
                            let amount = interaction.options.getInteger('amount', false) || 1;
                            let inventory = this.getInventory(interaction.user.id);
                            if (!inventory[type]) {
                                interaction.reply({ content: `You do not have any **${type}**.`, ephemeral: true });
                            }
                            else if (inventory[type] < amount) {
                                amount = inventory[type];
                            }
                            this.removeInventoryItems(interaction.user.id, type, amount);
                            interaction.reply({ content: `You have destroyed **${amount}** ${type} that were in your inventory.`, ephemeral: false });
                        } else if (interaction.options.getSubcommand() === 'manufacturers') {
                            let type = interaction.options.getString('type', true);
                            let item = this.getItemType(type);
                            if (!item) {
                                interaction.reply({ content: `Item type **${type}** does not exist.`, ephemeral: true });
                            } else {
                                let manufacturers = this.getManufacturers(type);
                                interaction.reply({ content: `Manufacturers of **${type}**: ${manufacturers.join(', ')}`, ephemeral: true });
                            }
                        } else if (interaction.options.getSubcommand() === 'addmanufacturer') {
                            let type = interaction.options.getString('type', true);
                            let user = interaction.options.getUser('user', true);

                            // first make sure exists
                            let item = this.getItemType(type);
                            if (!item) {
                                interaction.reply({ content: `Item type **${type}** does not exist.`, ephemeral: true });
                                return;
                            }

                            // now make sure they are the owner of the org
                            let org = this.orgs.getOrg(item.owner);
                            if (!org) {
                                interaction.reply({ content: `Something fishy is happening. I can feel it`, ephemeral: true });
                                return;
                            }

                            if (org.owner !== interaction.user.id) {
                                interaction.reply({ content: `You are not the owner of the org that owns the item type`, ephemeral: true });
                                return;
                            }

                            let manufacturers = this.getManufacturers(type);
                            if (!manufacturers.includes(user.id)) {
                                this.addManufacturer(user.id, type);
                                interaction.reply({ content: `Added **${user.username}** as a manufacturer of **${type}**.`, ephemeral: false });
                            } else {
                                interaction.reply({ content: `**${user.username}** is already a manufacturer of **${type}**.`, ephemeral: true });
                            }
                        } else if (interaction.options.getSubcommand() === 'removemanufacturer') {
                            let type = interaction.options.getString('type', true);
                            let user = interaction.options.getUser('user', true);

                            // first make sure exists
                            let item = this.getItemType(type);
                            if (!item) {
                                interaction.reply({ content: `Item type **${type}** does not exist.`, ephemeral: true });
                                return;
                            }

                            // now make sure they are the owner of the org
                            let org = this.orgs.getOrg(item.owner);
                            if (!org) {
                                interaction.reply({ content: `Something fishy is happening. I can feel it`, ephemeral: true });
                                return;
                            }

                            if (org.owner !== interaction.user.id) {
                                interaction.reply({ content: `You are not the owner of the org that owns the item type`, ephemeral: true });
                                return;
                            }

                            let manufacturers = this.getManufacturers(type);
                            if (manufacturers.includes(user.id)) {
                                this.removeManufacturer(user.id, type);
                                interaction.reply({ content: `Removed **${user.username}** as a manufacturer of **${type}**.`, ephemeral: false });
                            } else {
                                interaction.reply({ content: `**${user.username}** is not a manufacturer of **${type}**.`, ephemeral: true });
                            }
                        } else if (interaction.options.getSubcommand() === 'transfertype') {
                            const type = interaction.options.getString('type', true);
                            // first make sure exists
                            let item = this.getItemType(type);
                            if (!item) {
                                interaction.reply({ content: `Item type **${type}** does not exist.`, ephemeral: true });
                                return;
                            }

                            // now make sure they are the owner of the org
                            let org = this.orgs.getOrg(item.owner);
                            if (!org) {
                                interaction.reply({ content: `Something fishy is happening. I can feel it`, ephemeral: true });
                                return;
                            }

                            if (org.owner !== interaction.user.id) {
                                interaction.reply({ content: `You are not the owner of the org that owns the item type`, ephemeral: true });
                                return;
                            }

                            let newOrg = this.orgs.getOrg(interaction.options.getString('org', true));
                            if (!newOrg) {
                                interaction.reply({ content: `The org you are trying to transfer the item type to does not exist.`, ephemeral: true });
                                return;
                            }

                            this.changeItemTypeOwner(type, interaction.options.getString('org', true));
                            interaction.reply({ content: `The item type has been transferred to ${newOrg.org_id}`, ephemeral: true });
                        }

                    }
                } else if (interaction.isUserContextMenuCommand()) {
                    if (interaction.commandName === 'Pay User') {
                        const modal = new ModalBuilder()
                            .setCustomId('pay_' + interaction.targetUser.id)
                            .setTitle('Pay User');

                        const amountInput = new TextInputBuilder()
                            .setCustomId('amount')
                            .setLabel("Amount to pay")
                            .setStyle(TextInputStyle.Short);

                        const actionRow = new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(amountInput);

                        modal.addComponents(actionRow);

                        await interaction.showModal(modal);
                    }
                } else if (interaction.isModalSubmit()) {
                    if (interaction.customId.startsWith('pay_')) {
                        const amount = Math.abs(parseInt(interaction.fields.getTextInputValue('amount')));
                        if (isNaN(amount) || amount < 1) {
                            await interaction.reply({
                                content: 'Must be a valid number!',
                                ephemeral: true,
                            });
                        } else {
                            const userID = interaction.customId.replace('pay_', '');
                            const user = await client.users.fetch(userID);
                            if (user) {
                                this.pay(interaction.user, user, amount, interaction);
                            } else {
                                await interaction.reply({
                                    content: 'Some issue is happen! Help me!',
                                    ephemeral: true,
                                });
                            }
                        }
                    }
                }
            } catch (e) {
                console.error(e);
                if (interaction.channel && interaction.channel.isSendable()) {
                    interaction.channel.send({
                        content: 'Some issue is happen! Help me! ' + (e as any).toString(),
                    });
                }
            }
        });
    }

    addItemType(type: string, name: string, emoji: string, manufacturers: string[], owner: string) {
        this.db.run("insert into item_types values (?, ?, ?, ?, ?)", [type, name, emoji, JSON.stringify(manufacturers), owner]);

        for (const manufacturer of manufacturers) {
            this.db.run("insert into manufacturers values (?, ?)", [manufacturer, type]);
        }
    }

    changeItemTypeOwner(type: string, newOwner: string) {
        this.db.run("update item_types set owner = ? where type = ?", [newOwner, type]);
    }

    getItemTypesCanManufacture(user: string): string[] { // the return data is the array of item type ids
        const stmt = this.db.prepare("select type from manufacturers where user = ?");
        const rows = stmt.all(user);
        const types = rows.map(row => (row as any).type);
        return types;
    }

    getAllItemTypes(): string[] {
        const stmt = this.db.prepare("select * from item_types");
        const rows = stmt.all();
        return rows.map(row => (row as any).type);
    }

    addManufacturer(user: string, type: string) {
        this.db.run("insert into manufacturers values (?, ?)", [user, type]);
        // find item type
        const stmt = this.db.prepare("select * from item_types where type = ?");
        const row = stmt.get(type) as any;
        if (!row) throw new Error('Item type not found');
        const manufacturers = JSON.parse(row.manufacturers);
        if (!manufacturers.includes(user)) {
            manufacturers.push(user);
            row.manufacturers = JSON.stringify(manufacturers);
            this.db.run("update item_types set manufacturers = ? where type = ?", [JSON.stringify(manufacturers), type]);
        }
    }

    removeManufacturer(user: string, type: string) {
        this.db.run("delete from manufacturers where user = ? and type = ?", [user, type]);
        // find item type
        const stmt = this.db.prepare("select * from item_types where type = ?");
        const row = stmt.get(type) as any;
        if (!row) throw new Error('Item type not found');
        const manufacturers = JSON.parse(row.manufacturers);
        if (!manufacturers.includes(user)) throw new Error('User is not a manufacturer of this item type');
        const index = manufacturers.indexOf(user);
        if (index > -1) {
            manufacturers.splice(index, 1);
            row.manufacturers = JSON.stringify(manufacturers);
            this.db.run("update item_types set manufacturers = ? where type = ?", [JSON.stringify(manufacturers), type]);
        }
    }

    getManufacturers(type: string): string[] {
        const stmt = this.db.prepare("select manufacturers from item_types where type = ?");
        const row = stmt.get(type) as any;
        if (!row) throw new Error('Item type not found');
        return JSON.parse(row.manufacturers);
    }

    getInventory(user_id: string): { [type: string]: number } {
        const stmt = this.db.prepare("select * from inventories where user_id = ?");
        const row = stmt.get(user_id) as any;
        if (!row) {
            console.log('none for', user_id);
            return {};
        }
        return JSON.parse(row.items);
    }

    /* // item types are string (the type) and it has name and emoji and manufacturers string (json)
    db.run("create table if not exists item_types (type text, name text, emoji text, manufacturers text);");
    // manufacturer data also in manufacturers table
    db.run("create table if not exists manufacturers (user text, type text);");
    // inventories table has a row for each player inventory, with just json
    db.run("create table if not exists inventories (user_id text, items text);");*/

    getItemType(type: string): { name: string, emoji: string, manufacturers: string[], owner: string } | null {
        const stmt = this.db.prepare("select * from item_types where type = ?");
        const row = stmt.get(type) as any;
        if (!row) return null;
        return {
            name: row.name,
            emoji: row.emoji,
            manufacturers: JSON.parse(row.manufacturers),
            owner: row.owner,
        };
    }

    setItemEmoji(type: string, emoji: string) {
        const stmt = this.db.prepare("update item_types set emoji = ? where type = ?");
        stmt.run(emoji, type);
    }

    setItemName(type: string, name: string) {
        const stmt = this.db.prepare("update item_types set name = ? where type = ?");
        stmt.run(name, type);
    }

    addInventoryItems(user_id: string, type: string, count: number): number { // returns new count
        const stmt = this.db.prepare("select items from inventories where user_id = ?");
        const row = stmt.get(user_id) as any;
        const items = row ? JSON.parse(row.items) : {};
        if (!items[type]) items[type] = 0;
        items[type] += count;
        if (row) {
            this.db.run("update inventories set items = ? where user_id = ?", [JSON.stringify(items), user_id]);
        } else {
            this.db.run("insert into inventories (user_id, items) values (?, ?)", [user_id, JSON.stringify(items)]);
        }
        return items[type];
    }

    removeInventoryItems(user_id: string, type: string, count: number): number { // returns new count
        const stmt = this.db.prepare("select items from inventories where user_id = ?");
        const row = stmt.get(user_id) as any;
        const items = row ? JSON.parse(row.items) : {};
        if (!items[type]) items[type] = 0;
        items[type] -= count;
        if (items[type] <= 0) {
            // we dont want that entry at all now
            delete items[type];
        }
        this.db.run("update inventories set items = ? where user_id = ?", [JSON.stringify(items), user_id]);
        return items[type];
    }

    isUser(thing: User | Org): thing is User {
        return 'id' in thing;
    }

    async pay(from: User | Org, to: User | Org, amount: number, interaction: ChatInputCommandInteraction | UserContextMenuCommandInteraction | ModalSubmitInteraction | ButtonInteraction | TextChannel, force: boolean = false) {
        if (!force) {
            if (isNaN(amount)) {
                if ('reply' in interaction) {
                    interaction.reply({
                        content: 'Please specify an amount!',
                        ephemeral: true,
                    });
                }
                return;
            }
            if (amount < 1) {
                if ('reply' in interaction) {
                    interaction.reply({
                        content: 'Please specify an amount greater than 0!',
                        ephemeral: true,
                    });
                }
                return;
            }
        }

        let fromProfile = {
            name: 'Unknown',
            avatar: '',
            id: 'Unknown',
            mention: 'Unknown'
        };

        let toProfile = {
            name: 'Unknown',
            avatar: '',
            id: 'Unknown',
            mention: 'Unknown'
        };

        if (this.isUser(from)) {
            fromProfile = {
                name: from.username,
                avatar: from.displayAvatarURL(),
                id: from.id,
                mention: `<@${from.id}>`
            };
        } else {
            fromProfile = {
                name: from.org_id,
                avatar: '',
                id: from.org_id,
                mention: from.org_id
            };
        }

        let content: string | undefined = undefined;

        if (this.isUser(to)) {
            toProfile = {
                name: to.username,
                avatar: to.displayAvatarURL(),
                id: to.id,
                mention: `<@${to.id}>`
            };
            content = `-# <@${to.id}>`;
        } else {
            toProfile = {
                name: to.org_id,
                avatar: to.icon,
                id: to.org_id,
                mention: '**' + to.org_id + '**'
            };
        }

        this.roundMoney(fromProfile.id);
        this.roundMoney(toProfile.id);

        let money = this.getMoney(fromProfile.id);
        if (money < amount && !force) {
            if ('reply' in interaction) {
                interaction.reply({
                    content: 'You don\'t have enough!\n\nYou have **' + stringifyMoney(money) + '**, but you need **' + stringifyMoney(amount) + '**.\n(missing **' + stringifyMoney(amount - money) + '**)',
                    ephemeral: true,
                });
            }
            return;
        }

        let userBMoney = this.getMoney(toProfile.id);

        this.changeMoney(fromProfile.id, -amount);
        this.changeMoney(toProfile.id, amount);

        let embeds = [{
            color: 0x2b2d31,
            author: {
                name: 'Payment from ' + fromProfile.name + ' to ' + toProfile.name,
                icon_url: fromProfile.avatar
            },
            description: `## Transaction Receipt\n
${fromProfile.mention}'s previous balance: **${stringifyMoney(money)}**
${toProfile.mention}'s previous balance: **${stringifyMoney(userBMoney)}**

> ### __Total paid to ${toProfile.mention}: **${stringifyMoney(amount)}**__

${fromProfile.mention} now has **${stringifyMoney(this.getMoney(fromProfile.id))}** (<:minus:1309954499850407987> ${stringifyMoney(amount)})
${toProfile.mention} now has **${stringifyMoney(this.getMoney(toProfile.id))}** (<:plus:1309954509040124035> ${stringifyMoney(amount)})`
        }];

        let receipt: Message;
        if ('reply' in interaction) {
            // embed of "Transaction Receipt", shows the same as above commented line, but also shows taxes, all in description
            await interaction.reply({
                ephemeral: false,
                content,
                embeds,
            });
            receipt = await interaction.fetchReply();
        } else {
            receipt = await interaction.send({
                content,
                embeds,
            });
        }
        // store transaction in database
        this.registerTransaction(receipt.url, fromProfile.id, toProfile.id, amount, amount);

        return {
            amountSent: amount,
            amountReceived: amount,
            receiptLink: receipt.url,
            sender: fromProfile.id,
            recipient: toProfile.id,
        };
    }

    /** Register a transaction into the records. Both parties involved in a transaction can now see it in their transaction history. */

    registerTransaction(receiptMessageLink: string, sender: string, recipient: string, amountSent: number, amountReceived: number) {
        this.db.run("insert into transactions (transaction_id, sender, recipient, amount_sent, amount_received, date) values (?, ?, ?, ?, ?, ?)", [
            receiptMessageLink,
            sender,
            recipient,
            amountSent,
            amountReceived,
            Date.now()
        ]);
    }

    /** Get a certain amount of the latest transactions for a user. */

    getTransactions(user: string, limit: number): {
        transaction_id: string,
        sender: string,
        recipient: string,
        amount_sent: number,
        amount_received: number,
        date: number
    }[] {
        let stmt = this.db.query("select * from transactions where sender = ? or recipient = ? order by date desc limit ?");
        let rows = stmt.all(user, user, limit);
        return rows as any;
    }

    changeMoney(user_id: string, amount: number) {
        let stmt = this.db.query("select * from economy where user_id = ?");
        let rows = stmt.all(user_id);
        if (rows.length > 0) {
            // update
            this.db.run("update economy set money = money + ? where user_id = ?", [
                amount,
                user_id
            ]);
        }
        else {
            // insert
            this.db.run("insert into economy (user_id, money) values (?, ?)", [
                user_id,
                amount
            ]);
        }
    }

    roundMoney(user_id: string) {
        // query the database for the user's current balance
        let stmt = this.db.query("select * from economy where user_id = ?");
        let rows = stmt.all(user_id) as any;

        if (rows.length > 0) {
            // round the user's current balance using Math.round
            const currentBalance = rows[0].money;
            const roundedBalance = Math.round(currentBalance);

            // update the user's balance with the rounded value
            this.db.run("update economy set money = ? where user_id = ?", [
                roundedBalance,
                user_id
            ]);
        } else {
            // if no record exists, insert a default rounded value (e.g., 0)
            this.db.run("insert into economy (user_id, money) values (?, ?)", [
                user_id,
                0
            ]);
        }
    }


    getMoney(user_id: string): number {
        let stmt = this.db.query("select * from economy where user_id = ?");
        let rows = stmt.all(user_id);
        if (rows.length > 0) {
            return (rows[0] as any).money;
        }
        else {
            return 0;
        }
    }


    /** Get a sum of all the money in the economy. */

    sum() {
        let stmt = this.db.query("select sum(money) as sum from economy");
        let rows = stmt.all();
        return (rows[0] as any).sum ?? 0;
    }

    /** Reclaims all of a user's money and gives it to the government fund, deleting their account in the process. Returns reclaimed amount. */

    delete(user_id: string): number {
        let money = this.getMoney(user_id);
        this.db.run("delete from economy where user_id = ?", [user_id]); // delete their account
        this.changeMoney(this.client.user!.id, money);
        return money;
    }

    /** Get all rows in the economy table. */

    getAll() {
        let stmt = this.db.query("select * from economy");
        let rows = stmt.all();
        return rows as any as {
            user_id: string,
            money: number
        }[];
    }

    /** Get leaderboard of richest users. */

    top(limit: number) {
        let stmt = this.db.query("select * from economy order by money desc limit ?");
        let rows = stmt.all(limit);
        return rows as any as {
            user_id: string,
            money: number
        }[];
    }

    getMoneyRankings(limit: number): { user_id: string, money: number }[] {
        let stmt = this.db.query("select * from economy order by money desc limit ?");
        let rows = stmt.all(limit);
        return rows as any as {
            user_id: string,
            money: number
        }[];
    }

}
