import { ActionRowBuilder, ButtonBuilder, ButtonStyle, Client, EmbedBuilder, Events, Message, TextChannel, User, type APIEmbedField, type OmitPartialGroupDMChannel } from "discord.js";
import Database from "bun:sqlite";
import Economy, { stringifyMoney } from "./Economy";
import type WizardHelper from "./WizardHelper";

export interface Org {
    org_id: string;
    description: string;
    icon: string;
    members: string[];
    owner: string;
    created: number;
}

export default class Orgs {
    db: Database;
    economy: Economy | null = null;
    client: Client;
    wizardHelper: WizardHelper;

    constructor(db: Database, client: Client, wizardHelper: WizardHelper) {
        this.db = db;
        this.client = client;
        this.wizardHelper = wizardHelper;

        this.db.run("create table if not exists orgs (org_id text, description text, icon text, members text, owner text, created integer);"); // members is array of user IDs as JSON

        // org invites omg
        this.db.run("create table if not exists org_invites (org_id text, user_id text, message_id text);");

        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (interaction.isAutocomplete()) {
                const focusedOption = interaction.options.getFocused(true);
                if (focusedOption.name !== 'type') {
                    const orgs = this.getOrgs();
                    let matching = orgs.filter((org) => org.org_id.includes(focusedOption.value.toLowerCase()));
                    // filter to at most 25
                    matching = matching.slice(0, 25);
                    await interaction.respond(matching.map((choice) => { return { name: choice.org_id, value: choice.org_id }; }));
                }
            } else if (interaction.isButton()) {
                if (interaction.customId === 'reject_invite') {
                    let result = this.rejectOrgInvite(interaction.message.id, interaction.user);
                    let inviteGoneMessage: string | null = null;

                    if (result.type === 'success_invited') {
                        interaction.reply({
                            content: 'Phew, I was worried. Invite rejected and purged from   Timeline',
                            ephemeral: false,
                        });
                        inviteGoneMessage = 'rejected';
                    } else if (result.type === 'success_inviter') {
                        interaction.reply({
                            content: 'Ahhh  nevermind <@' + result.data + '> the the the inviter changed mind in, sorry gamery',
                            ephemeral: false,
                        });
                        inviteGoneMessage = 'cancelled';
                    } else if (result.type === 'no_invite') {
                        interaction.reply({
                            content: 'Offer retracted prior    Consult originator',
                            ephemeral: false,
                        });
                    } else if (result.type === 'wrong_user') {
                        interaction.reply({
                            content: 'Buddy you are not even part of the  control group. I am so far beyond you',
                            ephemeral: true,
                        });
                    }

                    if (inviteGoneMessage) {
                        interaction.message.edit({
                            content: interaction.message.content + '\n\n*Invite was ' + inviteGoneMessage + '*',
                            components: [],
                        });
                    }
                } else if (interaction.customId === 'accept_invite') {
                    let result = this.acceptOrgInvite(interaction.message.id, interaction.user);
                    let inviteAcceptedMessage: string | null = null;

                    if (result === 'success') {
                        interaction.reply({
                            content: 'I\'m sorry, I wish I could\'ve done more. Invite   accepted',
                            ephemeral: false,
                        });
                        inviteAcceptedMessage = 'accepted';
                    } else if (result === 'already_in_org') {
                        interaction.reply({
                            content: 'What\n\n__         __Silly, you are      already\n\n__    __Contained',
                            ephemeral: false,
                        });
                    } else if (result === 'no_invite') {
                        interaction.reply({
                            content: 'Offer retracted prior    Consult originator',
                            ephemeral: false,
                        });
                    } else if (result === 'wrong_user') {
                        interaction.reply({
                            content: 'Buddy you are not even part of the  control group. I am so far beyond you',
                            ephemeral: true,
                        });
                    }

                    if (inviteAcceptedMessage) {
                        interaction.message.edit({
                            content: interaction.message.content + '\n\n*Invite was ' + inviteAcceptedMessage + '*',
                            components: [],
                        });
                    }
                }
            }
            if (!interaction.isCommand()) return;
            if (!interaction.isChatInputCommand()) return;

            if (interaction.commandName === 'org') {
                const subcommand = interaction.options.getSubcommand();

                if (subcommand === 'view') {
                    const id = interaction.options.getString('id', true);

                    let org = this.getOrg(id);
                    if (!org) {
                        interaction.reply({
                            content: 'Org not found.',
                            ephemeral: true,
                        });
                        return;
                    }
                    let invites = this.getOrgInvites(id);
                    const embed = new EmbedBuilder()
                        .setAuthor({
                            name: org.org_id,
                            iconURL: org.icon
                        })
                        .setDescription('"' + org.description + '"')
                        .setColor(0x2b2d31)
                        .setFields([{
                            name: 'Members (' + org.members.length + ')',
                            value: '<@' + org.members.join('>, <@') + '>',
                        }, {
                            name: 'Owner',
                            value: '<@' + org.owner + '>',
                        }, {
                            name: 'Pending Invites',
                            value: invites.length > 0 ? '<@' + invites.join('>, <@') + '>' : 'None',
                        }, {
                            name: 'Balance',
                            value: stringifyMoney(this.economy!.getMoney(org.org_id)),
                        }, {
                            name: 'Created',
                            value: `<t:${Math.round(org.created / 1000)}:f> (<t:${Math.round(org.created / 1000)}:R>)`,
                        }]);

                    await interaction.reply({
                        embeds: [embed],
                        ephemeral: true,
                    });
                } else if (subcommand === 'create') {
                    if (!interaction.guild) {
                        await interaction.reply({
                            content: 'You can only create guilds from the Brook server itself!',
                            ephemeral: true,
                        });
                        return;
                    }

                    let channel = interaction.channel as TextChannel;

                    let userOwnedOrgCount = this.getUserOwnedOrgs(interaction.user.id).length;
                    // users can only own 5
                    if (userOwnedOrgCount >= 5) {
                        await interaction.reply({
                            content: `Sorry, you can only own 5 orgs at a time. You can delete one of your existing orgs with \`/org delete\` or transfer ownership to someone else with \`/org transfer\`, but you can't create a new one while you have 5. People also can't transfer orgs to you if you have 5.`,
                            ephemeral: true,
                        });
                        return;
                    }

                    // get org name
                    await interaction.reply(`What ID would you like to give your org? It needs to follow these rules:
1. Must be unique (not already taken by another org)
2. Must be 3-20 characters long
3. Must only contain lowercase letters, numbers, and hyphens (\`-\`)
4. Must not start or end with a hyphen
5. Must not contain two hyphens in a row

For example, you could use \`my-org-123\` or \`cool-org\`, but not \`My_Org\` or \`cool--org\`.

Please type your desired ID now.`);

                    let response = (await this.wizardHelper.getResponse({
                        channelID: channel.id,
                        userID: interaction.user.id,
                    })).content;

                    let orgID = response.trim();
                    if (!orgID.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) || orgID.length < 3 || orgID.length > 20) {
                        await channel.send(`Sorry, that ID doesn't follow the rules. Please try again.`);
                        return;
                    }

                    // secret bonus rule: it cant be all numbers, to prevent it being confused with user IDs
                    if (orgID.match(/^[0-9]+$/)) {
                        await channel.send(`Ooh, that's clever. Nice try bozer, but it can't be all numbers. Please try again.`);
                        return;
                    }

                    // make sure it's not a reserved word
                    let reserved = [
                        'brook',
                        'server',
                        'org',
                        'official',
                        'admin',
                        'mod',
                        'staff',
                        'bank',
                        'shop',
                        'store',
                        'economy',
                        'default',
                        'amy',
                        'bot',
                        'gov',
                        'government',
                        'council',
                        'congress',
                        'army',
                        'military'
                    ];

                    if (reserved.includes(orgID)) {
                        await channel.send(`Sorry, that ID is reserved. Please try again.`);
                        return;
                    }

                    // check if org already exists
                    let org = this.getOrg(orgID);
                    if (org) {
                        await channel.send(`Sorry, an org with that ID already exists. Please try again.`);
                        return;
                    }

                    // get org description
                    await channel.send(`What description would you like to give your org? This will be displayed when people view your org. You can always change it later.

It can be up to 100 characters long. Please type your desired description now.`);

                    response = (await this.wizardHelper.getResponse({
                        channelID: channel.id,
                        userID: interaction.user.id,
                    })).content;

                    let description = response.trim();
                    if (description.length > 100) {
                        await channel.send(`Sorry, that description is too long. Please try again.`);
                        return;
                    }

                    // finally, org icon
                    await channel.send(`Lastly, what icon would you like to give your org? This will be displayed when people view your org. You can always change it later.

Please upload an image to use as the icon now. It should be a square image, at least 128x128 pixels. If you delete the message, the icon will die for eternity.`);

                    let iconData = (await this.wizardHelper.getResponse({
                        channelID: channel.id,
                        userID: interaction.user.id,
                    }));

                    if (iconData.attachments.length === 0) {
                        await channel.send(`Sorry, you didn't upload an image. Please try again.`);
                        return;
                    }

                    let iconURL = iconData.attachments[0];

                    // create org
                    this.createOrg(orgID, description, iconURL, interaction.user.id);

                    await channel.send(`Org created! You can view it with \`/org view ${orgID}\`.`);
                } else if (subcommand === 'leave') {
                    const id = interaction.options.getString('id', true);

                    let org = this.getOrg(id);
                    if (!org) {
                        interaction.reply({
                            content: 'Org not found.',
                            ephemeral: true,
                        });
                        return;
                    }

                    if (!org.members.includes(interaction.user.id)) {
                        interaction.reply({
                            content: 'Are you okay?',
                            ephemeral: false, // ahahahahaha
                        });

                        if (interaction.guild) {
                            let channel = interaction.channel as TextChannel;

                            let response = (await this.wizardHelper.getResponse({
                                channelID: channel.id,
                                userID: interaction.user.id,
                            })).content;

                            if (response.toLowerCase().includes('no')) {
                                channel.send('Do you need a hug?');

                                let response = (await this.wizardHelper.getResponse({
                                    channelID: channel.id,
                                    userID: interaction.user.id,
                                })).content;

                                if (response.toLowerCase().includes('ye')) {
                                    channel.send('Okay. Here you go');
                                }
                            }
                        }

                        return;
                    }

                    if (org.owner === interaction.user.id) {
                        interaction.reply({
                            content: 'Not yet. Soon.',
                            ephemeral: true,
                        });
                        return;
                    }

                    this.removeOrgMember(id, interaction.user.id);
                    await interaction.reply('You are gone');
                } else if (subcommand === 'kick') {
                    const user = interaction.options.getUser('user', true);
                    const orgID = interaction.options.getString('id', true);

                    let org = this.getOrg(orgID);
                    if (!org) {
                        interaction.reply('Org not found.');
                        return;
                    }

                    if (user.id === interaction.user.id) {
                        interaction.reply('No');
                        return;
                    }

                    // make sure the user is the owner
                    if (org.owner !== interaction.user.id) {
                        interaction.reply('You are not the owner of that org. Until org roles are implemented, only the owner can nuke people :hourglass:');
                        return;
                    }


                    if (!org.members.includes(user.id)) {
                        interaction.reply('That user isn\'t in the org. Take your pills.');
                        return;
                    }

                    this.removeOrgMember(orgID, user.id);

                    await interaction.reply('Annihilated up');
                } else if (subcommand === 'list') {
                    const type = interaction.options.getString('type', true);

                    if (type === 'all') {
                        let orgs = this.getOrgs();
                        let fields: APIEmbedField[] = [];
                        for (let org of orgs) {
                            fields.push({
                                name: org.org_id,
                                value: 'Owner: <@' + org.owner + '>\nMembers: ' + org.members.length
                            });
                        }
                        interaction.reply({
                            embeds: [{
                                title: 'All Orgs',
                                color: 0x2b2d31,
                                fields: fields
                            }],
                            ephemeral: true,
                        });
                    } else if (type === 'owned') {
                        let orgs = this.getUserOwnedOrgs(interaction.user.id);
                        let fields: APIEmbedField[] = [];
                        for (let org of orgs) {
                            fields.push({
                                name: org.org_id,
                                value: 'Members: ' + org.members.length
                            });
                        }
                        interaction.reply({
                            embeds: [{
                                title: 'Orgs You Own',
                                color: 0x2b2d31,
                                fields: fields
                            }],
                            ephemeral: true,
                        });
                    } else if (type === 'member') {
                        let orgs = this.getOrgsUserIsIn(interaction.user.id);
                        let fields: APIEmbedField[] = [];
                        for (let org of orgs) {
                            fields.push({
                                name: org.org_id,
                                value: 'Owner: <@' + org.owner + '>\nMembers: ' + org.members.length
                            });
                        }
                        interaction.reply({
                            embeds: [{
                                title: 'Orgs You\'re In',
                                color: 0x2b2d31,
                                fields: fields
                            }],
                            ephemeral: true,
                        });
                    } else {
                        interaction.reply('Invalid subcommand. Use `all`, `owned`, or `member`. How did you do that anyway?');
                    }
                } else if (subcommand === 'invite') {
                    if (!interaction.guild) {
                        interaction.reply('I need a server for this one');
                        return;
                    }

                    let channel = interaction.channel as TextChannel;

                    const user = interaction.options.getUser('user', true);
                    const orgID = interaction.options.getString('id', true);

                    let org = this.getOrg(orgID);
                    if (!org) {
                        interaction.reply('Org not found.');
                        return;
                    }

                    if (user.id === interaction.user.id) {
                        interaction.reply('No');
                        return;
                    }

                    // make sure the user is the owner
                    if (org.owner !== interaction.user.id) {
                        interaction.reply('You are not the owner of that org. Until org roles are implemented, only the owner can invite people :hourglass:');
                        return;
                    }

                    if (org.members.includes(user.id)) {
                        interaction.reply('That user is already in the org. Take your pills.');
                        return;
                    }

                    const confirm = new ButtonBuilder()
                        .setCustomId('accept_invite')
                        .setLabel('Accept')
                        .setStyle(ButtonStyle.Danger);

                    const cancel = new ButtonBuilder()
                        .setCustomId('reject_invite')
                        .setLabel('Reject')
                        .setStyle(ButtonStyle.Secondary);

                    const row = new ActionRowBuilder<ButtonBuilder>()
                        .addComponents([confirm, cancel]);

                    let message = await channel.send({
                        content: `<@${user.id}>, you have been invited to join the org **${org.org_id}**. What is your final decision? You cannot turn back, be careful.`,
                        components: [row],
                    });

                    this.addOrgInvite(orgID, user.id, message.id);

                    interaction.reply({
                        content: 'Invite sent! To cancel it, simply press the **Reject** button on the invite; either the recipient or the inviter can press it.',
                        ephemeral: true,
                    })
                } else if (subcommand === 'payall') {
                    const orgID = interaction.options.getString('id', true);
                    const amount = interaction.options.getInteger('amount', true);

                    let org = this.getOrg(orgID);
                    if (!org) {
                        interaction.reply('Org not found.');
                        return;
                    }

                    // make sure the user is the owner
                    if (org.owner !== interaction.user.id) {
                        interaction.reply('You are not the owner of that org. Until org roles are implemented, only the owner can pay all peoples :hourglass:');
                        return;
                    }

                    if (!this.economy) {
                        interaction.reply('Economy somehow isnt connected to bot, consult a Brook bot specialist');
                        return;
                    }

                    let orgMoneyBefore = this.economy.getMoney(orgID);

                    if (this.economy.getMoney(orgID) < (org.members.length * amount)) {
                        interaction.reply({
                            content: 'Org lacks the required monetary. Needs ' + stringifyMoney(org.members.length * amount) + ', has ' + stringifyMoney(this.economy.getMoney(orgID)),
                            ephemeral: true,
                        });
                        return;
                    }

                    let membersPaid: string[] = [];
                    org.members.forEach((member) => {
                        this.economy?.changeMoney(orgID, -amount);
                        this.economy?.changeMoney(member, amount);
                        membersPaid.push(member);
                    });

                    await interaction.reply({
                        ephemeral: false,
                        content: membersPaid.map(member => `<@${member}>`).join(' '),
                        embeds: [{
                            color: 0x2b2d31,
                            author: {
                                name: 'Payment from ' + orgID + ' to all its members',
                                icon_url: org.icon,
                            },
                            description: `## Transaction Receipt\n
**${org.org_id}**'s previous balance: **${stringifyMoney(orgMoneyBefore)}**

Amount paid to each member: **${stringifyMoney(amount)}**
> ### __Total paid to members: **${stringifyMoney(membersPaid.length * amount)}**__

**${org.org_id}** now has **${stringifyMoney(this.economy.getMoney(org.org_id))}** (<:minus:1309954499850407987> ${stringifyMoney(membersPaid.length * amount)})
Each member now has <:plus:1309954509040124035> **${stringifyMoney(amount)}**`
                        }],
                    });

                    const receipt = await interaction.fetchReply();

                    membersPaid.forEach((member) => {
                        this.economy!.registerTransaction(receipt.url, org.org_id, member, amount, amount);
                    });
                } else if (subcommand === 'draw') {
                    const orgID = interaction.options.getString('id', true);
                    const amount = interaction.options.getInteger('amount', true);

                    let org = this.getOrg(orgID);
                    if (!org) {
                        interaction.reply('Org not found.');
                        return;
                    }

                    // make sure the user is the owner
                    if (org.owner !== interaction.user.id) {
                        interaction.reply('You are not the owner of that org. Until org roles are implemented, only the owner can draw thethe :hourglass:');
                        return;
                    }

                    if (!this.economy) {
                        interaction.reply('Economy somehow isnt connected to bot, consult a Brook bot specialist');
                        return;
                    }

                    this.economy.pay(org, interaction.user, amount, interaction);
                } else if (subcommand === 'transfer') {
                    const orgID = interaction.options.getString('id', true);
                    const newOwner = interaction.options.getUser('user', true);

                    let org = this.getOrg(orgID);
                    if (!org) {
                        interaction.reply('Org not found.');
                        return;
                    }

                    // make sure the user is the owner
                    if (org.owner !== interaction.user.id) {
                        interaction.reply('You are not the owner of that org');
                        return;
                    }

                    if (newOwner.bot) {
                        interaction.reply('cant be a bot, i rememeber how that went');
                        return;
                    }

                    this.transferOrgOwnership(orgID, newOwner.id);

                    interaction.reply({
                        content: '<@' + newOwner.id + '>, you are the New Owner of ' + orgID + ' even if you werent Ready. if you hate your new realing, transfer it to someone else OR just delete it with /org delete',
                    })
                } else if (subcommand === 'delete') {
                    const orgID = interaction.options.getString('id', true);

                    let org = this.getOrg(orgID);
                    if (!org) {
                        interaction.reply('Org not found.');
                        return;
                    }

                    // make sure the user is the owner
                    if (org.owner !== interaction.user.id) {
                        interaction.reply('You are not the owner of that org');
                        return;
                    }

                    this.deleteOrg(orgID);

                    interaction.reply('🫡 it was an honor');
                }
            }
        });
    }

    createOrg(org_id: string, description: string, icon: string, owner: string) {
        this.db.run("insert into orgs (org_id, description, icon, owner, created, members) values (?, ?, ?, ?, ?, ?)", [
            org_id,
            description,
            icon,
            owner,
            Date.now(),
            JSON.stringify([owner])
        ]);
    }

    getOrg(org_id: string): Org | null {
        // we are gonna JSON.parse the members array
        let stmt = this.db.query("select * from orgs where org_id = ?");
        let rows = stmt.all(org_id);
        if (rows.length > 0) {
            let org = {
                org_id: (rows[0] as any).org_id,
                description: (rows[0] as any).description,
                icon: (rows[0] as any).icon,
                members: JSON.parse((rows[0] as any).members),
                owner: (rows[0] as any).owner,
                created: (rows[0] as any).created
            };
            return org;
        }
        else {
            return null;
        }
    }

    addOrgMember(org_id: string, member: string) {
        let stmt = this.db.query("select * from orgs where org_id = ?");
        let rows = stmt.all(org_id);
        if (rows.length > 0) {
            let members = JSON.parse((rows[0] as any).members);
            members.push(member);
            this.db.run("update orgs set members = ? where org_id = ?", [
                JSON.stringify(members),
                org_id
            ]);
        }
    }

    removeOrgMember(org_id: string, member: string) {
        let stmt = this.db.query("select * from orgs where org_id = ?");
        let rows = stmt.all(org_id);
        if (rows.length > 0) {
            let members = JSON.parse((rows[0] as any).members);
            members = members.filter((m: string) => m !== member);
            this.db.run("update orgs set members = ? where org_id = ?", [
                JSON.stringify(members),
                org_id
            ]);
        }
    }

    addOrgInvite(org_id: string, user_id: string, message_id: string) {
        this.db.run("insert into org_invites (org_id, user_id, message_id) values (?, ?, ?)", [
            org_id,
            user_id,
            message_id,
        ]);
    }

    removeOrgInvite(message_id: string) {
        this.db.run("delete from org_invites where message_id = ?", [
            message_id,
        ]);
    }

    acceptOrgInvite(message_id: string, accepter: User): "already_in_org" | "no_invite" | "success" | "wrong_user" {
        // make sure they have an invite
        let stmt = this.db.query("select * from org_invites where message_id = ?");
        let rows = stmt.all(message_id);
        if (rows.length > 0) {
            let org_id = (rows[0] as any).org_id;
            let user_id = (rows[0] as any).user_id;
            let org = this.getOrg(org_id);

            if (!org) {
                this.removeOrgInvite(message_id);
                return "no_invite";
            }

            if (user_id === accepter.id) {
                this.removeOrgInvite(message_id);
                if (org.members.includes(user_id)) {
                    return "already_in_org";
                }
                this.addOrgMember(org_id, user_id);
                return "success";
            } else {
                return "wrong_user";
            }
        }
        else {
            return "no_invite";
        }
    }

    rejectOrgInvite(message_id: string, rejecter: User): {
        type: "no_invite" | "success_inviter" | "success_invited" | "wrong_user",
        data?: string,
    } {
        // make sure they have an invite
        let stmt = this.db.query("select * from org_invites where message_id = ?");
        let rows = stmt.all(message_id);
        if (rows.length > 0) {
            let org_id = (rows[0] as any).org_id;
            let user_id = (rows[0] as any).user_id;
            let org = this.getOrg(org_id);

            if (!org) {
                this.removeOrgInvite(message_id);
                return { type: "no_invite" };
            }

            if (org.owner === rejecter.id) {
                this.removeOrgInvite(message_id);
                return {
                    type: "success_inviter",
                    data: user_id,
                };
            } else if (user_id === rejecter.id) {
                this.removeOrgInvite(message_id);
                return {
                    type: "success_invited"
                };
            } else {
                return {
                    type: "wrong_user"
                };
            }
        }
        else {
            return {
                type: "no_invite"
            };
        }
    }

    getUserOrgInvites(user_id: string): string[] {
        let stmt = this.db.query("select * from org_invites where user_id = ?");
        let rows = stmt.all(user_id);
        return (rows as any[]).map(row => (row as any).org_id);
    }

    getOrgInvites(org_id: string): string[] {
        let stmt = this.db.query("select * from org_invites where org_id = ?");
        let rows = stmt.all(org_id);
        return (rows as any[]).map(row => (row as any).user_id);
    }

    deleteOrg(org_id: string) {
        this.db.run("delete from orgs where org_id = ?", [org_id]);
    }

    updateOrgDescription(org_id: string, description: string) {
        let stmt = this.db.query("select * from orgs where org_id = ?");
        let rows = stmt.all(org_id);
        if (rows.length > 0) {
            this.db.run("update orgs set description = ? where org_id = ?", [
                description,
                org_id
            ]);
        }
    }

    updateOrgIcon(org_id: string, icon: string) {
        let stmt = this.db.query("select * from orgs where org_id = ?");
        let rows = stmt.all(org_id);
        if (rows.length > 0) {
            this.db.run("update orgs set icon = ? where org_id = ?", [
                icon,
                org_id
            ]);
        }
    }

    transferOrgOwnership(org_id: string, newOwner: string) {
        let stmt = this.db.query("select * from orgs where org_id = ?");
        let rows = stmt.all(org_id);
        if (rows.length > 0) {
            this.db.run("update orgs set owner = ? where org_id = ?", [
                newOwner,
                org_id
            ]);
        }
    }

    updateOrgID(oldID: string, newID: string) {
        let stmt = this.db.query("select * from orgs where org_id = ?");
        let rows = stmt.all(oldID);
        if (rows.length > 0) {
            this.db.run("update orgs set org_id = ? where org_id = ?", [
                newID,
                oldID
            ]);
        }
    }

    getOrgs(): Org[] {
        let stmt = this.db.query("select * from orgs");
        let rows = stmt.all();
        return (rows as any[]).map<Org>(row => {
            return {
                org_id: row.org_id,
                description: row.description,
                icon: row.icon,
                members: JSON.parse(row.members),
                owner: row.owner,
                created: row.created
            };
        });
    }

    getUserOwnedOrgs(user_id: string): Org[] {
        let stmt = this.db.query("select * from orgs where owner = ?");
        let rows = stmt.all(user_id);
        return (rows as any[]).map<Org>(row => {
            return {
                org_id: row.org_id,
                description: row.description,
                icon: row.icon,
                members: JSON.parse(row.members),
                owner: row.owner,
                created: row.created
            };
        });
    }

    getOrgsUserIsIn(user_id: string): Org[] {
        let stmt = this.db.query("select * from orgs");
        let rows = stmt.all();
        let orgs = (rows as any[]).map<Org>(row => {
            return {
                org_id: row.org_id,
                description: row.description,
                icon: row.icon,
                members: JSON.parse(row.members),
                owner: row.owner,
                created: row.created
            };
        });
        return orgs.filter(org => org.members.includes(user_id));
    }
}