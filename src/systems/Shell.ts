import { Client, Message, type OmitPartialGroupDMChannel } from "discord.js";
import { Database } from "bun:sqlite";
import fs from 'fs';
import path from 'path';
import ShellEnvironment from "../shell";

function removeTrailingNewlines(str: string): string {
    while (str.endsWith('\n')) {
        str = str.substring(0, str.length - 1);
    }
    return str;
}

export default class Shell {
    shells: {
        [userID: string]: ShellEnvironment
    } = {};
    channelTerminals: {
        [userID: string]: {
            [channelID: string]: {
                msg: Message,
                state: string,
                msgs_since: number,
            }
        }
    } = {};

    async runShell(message: OmitPartialGroupDMChannel<Message>) {
        if (!message.content.startsWith('!$') || message.content.length <= 1) {
            return;
        }

        let newShell = false;

        if (!this.shells[message.author.id]) {
            newShell = true;
            this.shells[message.author.id] = new ShellEnvironment(message.author.id);
        }

        if (!this.channelTerminals[message.author.id]) {
            this.channelTerminals[message.author.id] = {};
        }
        const sendNew = async () => {
            let prependText = newShell ? 'Welcome to the Brook shell!\n\n' : '';
            let command = message.content.slice(2).trim();
            let cwdBefore = this.shells[message.author.id].cwd;
            if (cwdBefore.startsWith('/home/' + message.author.id)) {
                cwdBefore = cwdBefore.replace('/home/' + message.author.id, '~');
            }
            let out = this.shells[message.author.id].run(command);
            message.delete();
            // format our new cwd
            let cwdAfter = this.shells[message.author.id].cwd;
            if (cwdAfter.startsWith('/home/' + message.author.id)) {
                cwdAfter = cwdAfter.replace('/home/' + message.author.id, '~');
            }
            let msg = null;
            let state = 'No output';
            if (out) {
                state = prependText + '\x1b[32;1m' + message.author.username + '@brook\x1b[0m:\x1b[33;1m' + cwdBefore + '\x1b[0m$ ' + command + '\n' + out.stdout + out.stderr + '\x1b[32;1m' + message.author.username + '@brook\x1b[0m:\x1b[33;1m' + cwdAfter + '\x1b[0m$ ';
                msg = await message.channel.send('```ansi\n' + state + '█```');
            } else {
                msg = await message.channel.send('No output');
            }

            this.channelTerminals[message.author.id][message.channel.id] = {
                msg,
                msgs_since: 0,
                state,
            };
        }
        if (!this.channelTerminals[message.author.id][message.channel.id]) {
            sendNew();
        } else {
            if (this.channelTerminals[message.author.id][message.channel.id].msgs_since > 4) {
                sendNew();
            } else {
                let command = message.content.slice(1).trim();
                let cwdBefore = this.shells[message.author.id].cwd;
                if (cwdBefore.startsWith('/home/' + message.author.id)) {
                    cwdBefore = cwdBefore.replace('/home/' + message.author.id, '~');
                }
                let out = this.shells[message.author.id].run(command);
                message.delete();
                // format our new cwd
                let cwdAfter = this.shells[message.author.id].cwd;
                if (cwdAfter.startsWith('/home/' + message.author.id)) {
                    cwdAfter = cwdAfter.replace('/home/' + message.author.id, '~');
                }

                this.channelTerminals[message.author.id][message.channel.id].state += command + '\n' + out.stdout + out.stderr + '\x1b[32;1m' + message.author.username + '@brook\x1b[0m:\x1b[33;1m' + cwdAfter + '\x1b[0m$ ';
                this.channelTerminals[message.author.id][message.channel.id].msg.edit({
                    content: '```ansi\n' + this.channelTerminals[message.author.id][message.channel.id].state + '█```',
                });
            }
        }


    }
}
