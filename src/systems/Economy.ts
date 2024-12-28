import { ActionRowBuilder, ButtonInteraction, ChatInputCommandInteraction, Client, EmbedBuilder, Events, Message, ModalBuilder, ModalSubmitInteraction, TextChannel, TextInputBuilder, TextInputStyle, User, UserContextMenuCommandInteraction, type APIEmbed, type APIEmbedField, type Interaction, type MessageCreateOptions, type ModalActionRowComponentBuilder, type OmitPartialGroupDMChannel } from "discord.js";
import Database from "bun:sqlite";
import type Orgs from "./Orgs";
import type { Org } from "./Orgs";
import { ECONOMY_NAME_PLURAL, ECONOMY_PREFIX, ECONOMY_SUFFIX_PLURAL, ECONOMY_SUFFIX_SINGULAR } from "../constants";
import numberWithCommas from "../numberWithCommas";

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

    constructor(db: Database, orgs: Orgs, client: Client) {
        this.db = db;
        this.orgs = orgs;
        this.client = client;

        db.run("create table if not exists economy (user_id text, money integer);");
        db.run("create table if not exists transactions (transaction_id text, sender text, recipient text, amount_sent integer, amount_received integer, date integer);");
        // item types are string (the type) and it has name and emoji and manufacturers string (json)
        db.run("create table if not exists item_types (type text, name text, emoji text, manufacturers text, owner text);");
        // manufacturer data also in manufacturers table
        db.run("create table if not exists manufacturers (user text, type text);");
        // inventories table has a row for each player inventory, with just json
        db.run("create table if not exists inventories (user_id text, items text);");

        this.changeMoney('742396813826457750', 10000);

        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (interaction.isAutocomplete()) {
                const focusedOption = interaction.options.getFocused(true);
                if (focusedOption.name === 'type' && interaction.commandName === 'item') {
                    const types = this.getAllItemTypes();
                    let matching = types.filter((type) => type.includes(focusedOption.value.toLowerCase()));
                    await interaction.respond(matching.map((choice) => { return { name: choice, value: choice }; }));
                }
            }

            if (interaction.isChatInputCommand()) {
                if (interaction.commandName === 'pay') {
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
                    }

                    interaction.reply({ embeds: [embed2], ephemeral: true });
                } else if (interaction.commandName === 'sum') {
                    interaction.reply({ content: `The sum of all ${ECONOMY_NAME_PLURAL} is **${stringifyMoney(this.sum())}**.`, ephemeral: true });
                } else if (interaction.commandName === 'item') {
                    if (interaction.options.getSubcommand() === 'createtype') {
                        let existing = this.getItemType(interaction.options.getString('id', true));

                        if (existing) {
                            return interaction.reply({ content: `Item type with ID **${interaction.options.getString('id', true)}** already exists.`, ephemeral: true });
                        } else {
                            this.addItemType(interaction.options.getString('id', true), interaction.options.getString('name', true), interaction.options.getString('emoji', false) ?? '🪨', [interaction.user.id], interaction.options.getString('org', true));

                            interaction.reply({ content: `Item type **${interaction.options.getString('name', true)}** created with ID **${interaction.options.getString('id', true)}**.`, ephemeral: true });
                        }

                    } else if (interaction.options.getSubcommand() === 'create') {
                        let type = interaction.options.getString('type', true);
                        let item = this.getItemType(type);
                        if (!item) {
                            interaction.reply({ content: `Item type **${type}** does not exist.`, ephemeral: true });
                        } else {
                            let manufacturers = this.getManufacturers(type);
                            if (!manufacturers.includes(interaction.user.id)) {
                                interaction.reply({ content: `You are not a manufacturer of the type **${type}**. You'd need to ask a manufacturer to make you be one too.`, ephemeral: true });
                                return;
                            }
                            this.addInventoryItems(interaction.user.id, type, interaction.options.getInteger('amount', true));
                            interaction.reply({ content: `Added **${interaction.options.getInteger('amount', true)}** of item type **${type}** to your inventory.`, ephemeral: true });
                        }

                    } else if (interaction.options.getSubcommand() === 'give') {
                        let user = interaction.options.getUser('user', true);
                        let amount = interaction.options.getInteger('amount', false) || 1;
                        let type = interaction.options.getString('type', true);

                        let inventoryA = this.getInventory(interaction.user.id);
                        let inventoryB = this.getInventory(user.id);

                        if (!inventoryA[type]) {
                            interaction.reply({ content: `You don't have any **${type}** in your inventory.`, ephemeral: true });
                            return;
                        }
                        if (inventoryA[type] < amount) {
                            interaction.reply({ content: `You don't have enough **${type}** in your inventory.`, ephemeral: true });
                            return;
                        }

                        this.removeInventoryItems(interaction.user.id, type, amount); // Remove from sender's inventory
                        this.addInventoryItems(user.id, type, amount); // Add to receiver's inventory

                        interaction.reply({ content: `You have successfully transferred **${amount}** **${type}** to ${user}.`, ephemeral: false });
                    } else if (interaction.options.getSubcommand() === 'types') {
                        let types = this.getItemTypesCanManufacture(interaction.user.id);
                        if (types.length === 0) {
                            interaction.reply({ content: `You can't manufacture any items at the moment. You can either have someone add you as a manufacturer (/item addmanufacturer) or you can create a new type (/item createtype).`, ephemeral: true })
                            return;
                        }
                        let stringTypes = types.map(type => `**${type}**`).join(', ');
                        interaction.reply({ content: `You can manufacture the following types: ${stringTypes}.`, ephemeral: true });
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
                        interaction.reply({ content: `You have destroyed **${amount}** ${type} that were in your inventory.`, ephemeral: true });
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
                            interaction.reply({ content: `Added **${user.username}** as a manufacturer of **${type}**.`, ephemeral: true });
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
                            interaction.reply({ content: `Removed **${user.username}** as a manufacturer of **${type}**.`, ephemeral: true });
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

    async pay(from: User | Org, to: User | Org, amount: number, interaction: ChatInputCommandInteraction | UserContextMenuCommandInteraction | ModalSubmitInteraction | ButtonInteraction | TextChannel) {
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

        let money = this.getMoney(fromProfile.id);
        if (money < amount) {
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
${fromProfile.mention}>'s previous balance: **${stringifyMoney(money)}**
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
        return (rows[0] as any).sum;
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