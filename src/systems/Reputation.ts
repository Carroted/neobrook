import { Client, Events, GuildMember, Message, MessageReaction, TextChannel, User } from "discord.js";
import type { PartialMessageReaction, PartialUser, } from 'discord.js';
import Database from "bun:sqlite";

export default class Reputation {
    db: Database;
    client: Client;

    constructor(db: Database, client: Client) {
        this.db = db;
        this.client = client;

        this.db.run("create table if not exists upvotes (source_message_id text, new_message_id text);");
        this.db.run("create table if not exists reputation (user_id text, reputation integer);");

        this.client.on(Events.MessageReactionAdd, async (reaction, user) => {
            this.reactionAdd(reaction, user);
        });

        this.client.on(Events.MessageReactionRemove, async (reaction, user) => {
            this.reactionRemove(reaction, user);
        });
    }

    async reactionAdd(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
        if (user.id === '1171991184227442759') return;
        console.log('reaction');
        if (user.id === this.client.user!.id) return;
        // if guild isnt 1224881201379016825
        if (!reaction.message.guild || reaction.message.guild.id !== '1224881201379016825') return;
        if (reaction.partial) reaction = await reaction.fetch();
        let message = reaction.message;
        if (message.partial) message = await message.fetch();
        console.log('passed tests');

        if (message.channel.id === '1224889114344685709') {
            return;
        }

        if (reaction.emoji.id === '1309965553770954914' && reaction.emoji.name === "upvote") {
            // the message.author.id gets +1 reputation unless theyre the same as user.id
            if (message.author.id !== user.id) {
                console.log('ready to process rep change');
                // check if user.id is in the database
                let stmt = this.db.query("select * from reputation where user_id = ?");
                let rows = stmt.all(message.author.id);
                if (rows.length > 0) {
                    // update
                    this.db.run("update reputation set reputation = reputation + 1 where user_id = ?", [
                        message.author.id
                    ]);
                    console.log('Added to someones rep! omg theyre so lucky and cool');
                }
                else {
                    // insert
                    this.db.run("insert into reputation (user_id, reputation) values (?, ?)", [
                        message.author.id,
                        1
                    ]);
                    console.log('initialized new rep');
                }
            }
            else {
                console.log('someone tried to upvote their own message lamo what a bozo');
            }
        }
        // same for downvote (<:downvote:1309965539514257459>)
        else if (reaction.emoji.id === '1309965539514257459' && reaction.emoji.name === "downvote") {
            // the message.author.id gets -1 reputation unless theyre the same as user.id
            if (message.author.id !== user.id) {
                // check if user.id is in the database
                let stmt = this.db.query("select * from reputation where user_id = ?");
                let rows = stmt.all(message.author.id);
                if (rows.length > 0) {
                    // update
                    this.db.run("update reputation set reputation = reputation - 1 where user_id = ?", [
                        message.author.id
                    ]);
                }
                else {
                    // insert
                    this.db.run("insert into reputation (user_id, reputation) values (?, ?)", [
                        message.author.id,
                        -1
                    ]);
                }

                // 1/10 chance of removing 1 rep from user.id as well, this encourages not downvoting for no reason
                if (Math.random() < 0.1) {
                    // check if user.id is in the database
                    let stmt = this.db.query("select * from reputation where user_id = ?");
                    let rows = stmt.all(user.id);
                    if (rows.length > 0) {
                        // update
                        this.db.run("update reputation set reputation = reputation - 1 where user_id = ?", [
                            user.id
                        ]);
                    }
                    else {
                        // insert
                        this.db.run("insert into reputation (user_id, reputation) values (?, ?)", [
                            user.id,
                            -1
                        ]);
                    }
                }
            }
        }

        // basically, if 3 people react <:upvote:1309965553770954914> on something, its sent to <#1224889114344685709>. this is just like starboard, but built into this bot so we dont rely on closed source code
        if (reaction.emoji.id === '1309965553770954914' && reaction.emoji.name === "upvote" && reaction.count >= 3) {
            console.log('upvote');
            this.updateTop(message, reaction);
        }
        else {
            console.log('name: `' + reaction.emoji.name + '` id: `' + reaction.emoji.id + '`');
        }
    }

    async reactionRemove(reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) {
        if (user.id === '1171991184227442759') return;
        console.log('reaction removed');
        if (user.id === this.client.user!.id) return;
        // if guild isnt 1224881201379016825
        if (!reaction.message.guild || reaction.message.guild.id !== '1224881201379016825') return;
        if (reaction.partial) reaction = await reaction.fetch();
        let message = reaction.message;
        if (message.partial) message = await message.fetch();
        console.log('passed tests');

        if (message.channel.id === '1224889114344685709') {
            return;
        }

        if (reaction.emoji.id === '1309965553770954914' && reaction.emoji.name === "upvote") {
            // the message.author.id gets -1 reputation unless theyre the same as user.id
            if (message.author.id !== user.id) {
                // check if user.id is in the database
                let stmt = this.db.query("select * from reputation where user_id = ?");
                let rows = stmt.all(message.author.id);
                if (rows.length > 0) {
                    // update
                    this.db.run("update reputation set reputation = reputation - 1 where user_id = ?", [
                        message.author.id
                    ]);
                }
                else {
                    // insert
                    this.db.run("insert into reputation (user_id, reputation) values (?, ?)", [
                        message.author.id,
                        0
                    ]);
                }
            }
        }
        // same for downvote (<:downvote:1309965539514257459>)
        else if (reaction.emoji.id === '1309965539514257459' && reaction.emoji.name === "downvote") {
            // the message.author.id gets +1 reputation unless theyre the same as user.id
            if (message.author.id !== user.id) {
                // check if user.id is in the database
                let stmt = this.db.query("select * from reputation where user_id = ?");
                let rows = stmt.all(message.author.id);
                if (rows.length > 0) {
                    // update
                    this.db.run("update reputation set reputation = reputation + 1 where user_id = ?", [
                        message.author.id
                    ]);
                }
                else {
                    // insert
                    this.db.run("insert into reputation (user_id, reputation) values (?, ?)", [
                        message.author.id,
                        1
                    ]);
                }
            }
        }

        // basically, if 3 people react <:upvote:1309965553770954914> on something, its sent to <#1224889114344685709>. this is just like starboard, but built into this bot so we dont rely on closed source code
        if (reaction.emoji.id === '1309965553770954914' && reaction.emoji.name === "upvote" && reaction.count >= 3) {
            console.log('upvote');
            this.updateTop(message, reaction);
        }
    }

    async updateTop(message: Message<boolean>, reaction: MessageReaction) {
        const channel = await message.guild!.channels.fetch('1224889114344685709');
        if (!channel) return;
        // get downvote count (<:downvote:1309965539514257459>)
        let downvoteCount = 0;
        for (const reaction of message.reactions.cache.values()) {
            if (reaction.emoji.id === '1309965539514257459' && reaction.emoji.name === "downvote") {
                downvoteCount = reaction.count;
                break;
            }
        }
        let messageObject = {
            content: '-# <@' + message.author.id + '>',
            embeds: [{
                color: 0x2b2d31,
                description: message.content,
                author: {
                    name: message.member ? message.member.displayName : message.author.username,
                    icon_url: message.author.displayAvatarURL()
                },
                fields: [{
                    name: `**${reaction.count.toString()}** <:upvote:1309965553770954914>`,
                    value: `**${downvoteCount.toString()} <:downvote:1309965539514257459>**`,
                    inline: false
                }, {
                    name: 'Date',
                    value: `<t:${Math.floor(message.createdTimestamp / 1000)}:f>`,
                    inline: true
                }, {
                    name: 'Original Message',
                    value: `[Jump to message](${message.url})`,
                    inline: true
                }]
            }]
        };
        // look into db upvotes table, is there a message with the same id as the source message?
        let stmt = this.db.query("select * from upvotes where source_message_id = ?");
        let rows = stmt.all(message.id);
        if (rows.length > 0) {
            // edit with new messageObject
            let msg = await (channel as TextChannel).messages.fetch((rows[0] as any).new_message_id);
            await msg.edit(messageObject);
            console.log('edited');
            return;
        }

        let msg = await (channel as TextChannel).send(messageObject);
        // add to database, all we need it to store is source message id and new message id
        this.db.run("insert into upvotes (source_message_id, new_message_id) values (?, ?)", [
            message.id,
            msg.id
        ]);
    }

    getRep(userID: string) {
        let stmt = this.db.query("select * from reputation where user_id = ?");
        let rows = stmt.all(userID);
        if (rows.length > 0) {
            return (rows[0] as any).reputation;
        }
        return 0;
    }
    changeRep(userID: string, amount: number) {
        let stmt = this.db.query("select * from reputation where user_id = ?");
        let rows = stmt.all(userID);
        if (rows.length > 0) {
            // update
            this.db.run("update reputation set reputation = reputation + ? where user_id = ?", [
                amount,
                userID
            ]);
        }
        else {
            // insert
            this.db.run("insert into reputation (user_id, reputation) values (?, ?)", [
                userID,
                amount
            ]);
        }
    }
}