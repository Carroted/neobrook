import { Client, Message, type OmitPartialGroupDMChannel } from "discord.js";
import { Database } from "bun:sqlite";
import fs from 'fs';
import path from 'path';
import ShellEnvironment, { dirsContainer } from "../shell";
import { WasmShell } from "wasm-shell";

function removeTrailingNewlines(str: string): string {
    while (str.endsWith('\n')) {
        str = str.substring(0, str.length - 1);
    }
    return str;
}

import { mkdir, readdir, readFile, writeFile, rm, stat as fsStat } from "fs/promises";

const dec = new TextDecoder();

export default class Shell {
    shells: {
        [userID: string]: WasmShell,
    } = {};
    db: Database;
    channelTerminals: {
        [userID: string]: {
            [channelID: string]: {
                msg: Message,
                state: string,
                msgs_since: number,
            }
        }
    } = {};
    constructor(db: Database) {
        this.db = db;
    }

    async runShell(message: OmitPartialGroupDMChannel<Message>) {
        if (!message.content.startsWith('$') || message.content.length <= 1) {
            return;
        }
        // if thing right after the $ is a number, ignore it (so when people say money like $100 it doesnt trigger this)
        if (/^\$\d/.test(message.content)) {
            return;
        }

        if (!this.shells[message.author.id]) {
            const toReal = (rel: string) => path.join(dirsContainer, message.author.id, rel);
            this.shells[message.author.id] = new WasmShell();

            this.shells[message.author.id].mount("/home/", {
                async read(path) {
                    return readFile(toReal(path));
                },
                async write(path, data) {
                    const full = toReal(path);
                    await mkdir(full.substring(0, full.lastIndexOf("/")), { recursive: true });
                    await writeFile(full, data);
                },
                async list(path) {
                    const entries = await readdir(toReal(path), { withFileTypes: true });
                    return entries.map(e => e.name);
                },
                async stat(path) {
                    const s = await fsStat(toReal(path));
                    return { isFile: s.isFile(), isDir: s.isDirectory(), isDevice: false, size: s.size };
                },
                async remove(path) {
                    await rm(toReal(path), { recursive: true, force: true });
                },
            });
            this.shells[message.author.id].setEnv("HOME", "/home");
            this.shells[message.author.id].setCwd("/home");
        }

        if (!this.channelTerminals[message.author.id]) {
            this.channelTerminals[message.author.id] = {};
        }
        const sendNew = async () => {
            let command = message.content.slice(1).trim();
            const home = this.shells[message.author.id].getEnv("HOME") ?? "/home";
            let cwdBefore = this.shells[message.author.id].getCwd();
            if (cwdBefore.startsWith(home)) {
                cwdBefore = cwdBefore.replace(home, '~');
            }
            let out = await this.shells[message.author.id].exec(command);
            // message.delete();
            // format our new cwd
            let cwdAfter = this.shells[message.author.id].getCwd();
            if (cwdAfter.startsWith(home)) {
                cwdAfter = cwdAfter.replace(home, '~');
            }
            let msg = null;
            let state = 'No output';
            if (out) {
                state = '\x1b[34;1m' + message.author.username + '@brook\x1b[0m:\x1b[36;1m' + cwdBefore + '\x1b[0m$ ' + command + '\n' + dec.decode(out.stdout) + dec.decode(out.stderr) + '\x1b[32;1m' + message.author.username + '@brook\x1b[0m:\x1b[33;1m' + cwdAfter + '\x1b[0m$ ';
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
        sendNew();
    }
}
