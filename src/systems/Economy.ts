import { ActionRowBuilder, ButtonInteraction, ChatInputCommandInteraction, Client, EmbedBuilder, Events, Message, ModalBuilder, ModalSubmitInteraction, TextInputBuilder, TextInputStyle, User, UserContextMenuCommandInteraction, type APIEmbed, type Interaction, type MessageCreateOptions, type ModalActionRowComponentBuilder, type OmitPartialGroupDMChannel } from "discord.js";
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

        this.changeMoney('742396813826457750', 10000);

        this.client.on(Events.InteractionCreate, async (interaction) => {
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
                } else if (interaction.commandName === 'sum') {
                    interaction.reply({ content: `The sum of all ${ECONOMY_NAME_PLURAL} is **${stringifyMoney(this.sum())}**.`, ephemeral: true });
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

    isUser(thing: User | Org): thing is User {
        return 'id' in thing;
    }

    async pay(from: User | Org, to: User | Org, amount: number, interaction: ChatInputCommandInteraction | UserContextMenuCommandInteraction | ModalSubmitInteraction | ButtonInteraction) {
        if (isNaN(amount)) {
            interaction.reply({
                content: 'Please specify an amount!',
                ephemeral: true,
            });
            return;
        }
        if (amount < 1) {
            interaction.reply({
                content: 'Please specify an amount greater than 0!',
                ephemeral: true,
            });
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
            interaction.reply({
                content: 'You don\'t have enough!\n\nYou have **' + stringifyMoney(money) + '**, but you need **' + stringifyMoney(amount) + '**.\n(missing **' + stringifyMoney(amount - money) + '**)',
                ephemeral: true,
            });
            return;
        }

        let userBMoney = this.getMoney(toProfile.id);

        this.changeMoney(fromProfile.id, -amount);
        this.changeMoney(toProfile.id, amount);

        // embed of "Transaction Receipt", shows the same as above commented line, but also shows taxes, all in description
        await interaction.reply({
            ephemeral: false,
            content,
            embeds: [{
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
            }],
        });
        const receipt = await interaction.fetchReply();
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