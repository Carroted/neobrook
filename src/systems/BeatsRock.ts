import { Client, EmbedBuilder, Events, Message, type OmitPartialGroupDMChannel } from "discord.js";

import { v4 as uuidv4 } from 'uuid';
import { exec } from 'child_process';

export default class BeatsRock {
    client: Client;

    constructor(client: Client) {
        this.client = client;

        this.client.on(Events.InteractionCreate, async (interaction) => {
            if (!interaction.isCommand()) return;
            if (!interaction.isChatInputCommand()) return;

            if (interaction.commandName === 'rock') {
                this.activeGames[interaction.user.id] = {
                    gid: uuidv4(),
                    prev: 'rock',
                    prevEmoji: '🪨',
                    chain: 'rock',
                    score: 0,
                };
                interaction.reply({
                    content: "What beats **rock**?",
                    ephemeral: false,
                });
            }
        });
    }

    activeGames: {
        [userID: string]: {
            gid: string,
            prev: string,
            prevEmoji: string,
            score: number,
            chain: string,
        }
    } = {};

    async doGames(message: OmitPartialGroupDMChannel<Message>) {
        if (this.activeGames[message.author.id]) {
            if (message.content.toLowerCase() === "stop") {
                delete this.activeGames[message.author.id];
                message.reply({
                    content: "Stopped game!",
                    allowedMentions: { repliedUser: false }
                });
                return;
            }
            function hasNumber(myString: string) {
                return /\d/.test(myString);
            }
            if (hasNumber(message.content)) {
                message.reply({
                    content: "Be careful! Site hates numbers and returns error if you use em, just write em like \"one\" instead",
                    allowedMentions: { repliedUser: false }
                });
                return;
            }
            let data = JSON.stringify({
                prev: this.activeGames[message.author.id].prev.replaceAll("'", ''),
                guess: message.content.replaceAll("'", ''),
                gid: this.activeGames[message.author.id].gid,
            });
            message.channel.sendTyping();
            let command = `curl 'https://www.whatbeatsrock.com/api/vs' --compressed -X POST -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0' -H 'Accept: */*' -H 'Accept-Language: en-CA,en-US;q=0.7,en;q=0.3' -H 'Accept-Encoding: gzip, deflate, br' -H 'Referer: https://www.whatbeatsrock.com/' -H 'Content-Type: application/json' -H 'Origin: https://www.whatbeatsrock.com' -H 'Connection: keep-alive' -H 'Sec-Fetch-Dest: empty' -H 'Sec-Fetch-Mode: cors' -H 'Sec-Fetch-Site: same-origin' -H 'TE: trailers' --data-raw '${data}'`;
            let res = await new Promise((resolve, reject) => {
                exec(command, (error, stdout, stderr) => {
                    console.log('stdout:', stdout, 'stderr:', stderr);
                    if (error === null) {
                        resolve(stdout);
                    } else {
                        reject(stdout + stderr);
                    }
                });
            });
            let json = JSON.parse(res as string);
            if (json.error || !json.data) {
                const embed = new EmbedBuilder()
                    .setColor(0xf16158)
                    .setAuthor({
                        name: 'Error',
                        iconURL: 'https://cdn.discordapp.com/emojis/1212168671246684281.webp?size=512&quality=lossless',
                    })
                    .setDescription("Error code: `" + json.error + "`");
                message.channel.send({ embeds: [embed] });
                return;
            } else {
                if (json.data.guess_wins) {
                    const embed = new EmbedBuilder()
                        .setFooter({
                            text: 'Score: ' + (this.activeGames[message.author.id].score + 1)
                        })
                        .setColor(0x2b2d31)
                        .setDescription("# " + json.data.guess_emoji + ' 🤜 ' + this.activeGames[message.author.id].prevEmoji + "\n\n> " + json.data.reason + "\n\nYou did it it beat it, now what beats `" + message.content.replaceAll("'", '') + "`\n\n```\n" + message.content.replaceAll("'", '') + ' 🤜 ' + this.activeGames[message.author.id].chain + "\n```");
                    this.activeGames[message.author.id] = {
                        prev: message.content.replaceAll("'", ''),
                        prevEmoji: json.data.guess_emoji,
                        gid: this.activeGames[message.author.id].gid,
                        chain: message.content.replaceAll("'", '') + ' 🤜 ' + this.activeGames[message.author.id].chain,
                        score: this.activeGames[message.author.id].score + 1,
                    };
                    message.channel.send({ embeds: [embed] });
                } else {
                    const embed = new EmbedBuilder()
                        .setColor(0xf16158)
                        .setFooter({
                            text: 'Score: ' + (this.activeGames[message.author.id].score)
                        })
                        .setDescription("# " + json.data.guess_emoji + ' 😵 ' + this.activeGames[message.author.id].prevEmoji + "\n\n> " + json.data.reason + "\n\nNope nuh uh\n\n```\n" + message.content.replaceAll("'", '') + ' 😵 ' + this.activeGames[message.author.id].chain + "\n```");
                    message.channel.send({ embeds: [embed] });
                    delete this.activeGames[message.author.id];
                }
            }
        }
    }
}