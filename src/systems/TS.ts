import { runSandboxedCode } from "../denoer";
import Database from "bun:sqlite";

import { Client, EmbedBuilder, Events, Message, MessageType, TextChannel, type OmitPartialGroupDMChannel } from "discord.js";
import { calc } from "../commands/slash/math";

export function getMemory(db: Database, user_id: string): any {
    let stmt = db.query("select * from ts_memory where user_id = ?");
    let rows = stmt.all(user_id);
    if (rows.length > 0) {
        try {
            return JSON.parse((rows[0] as any).memory_json);
        } catch {
            return {};
        }
    }
    else {
        return {};
    }
}
export function updateMemory(db: Database, user_id: string, mem: any) {
    const stringJson = JSON.stringify(mem);
    // Update memory in DB
    db.run("insert or replace into ts_memory (user_id, memory_json) values (?, ?)", [
        user_id,
        stringJson
    ]);
}
    
export default class TS {
    client: Client;
    db: Database;

    constructor(db: Database, client: Client) {
        this.db = db;
        this.client = client;
        this.db.run("create table if not exists ts_memory (user_id text PRIMARY KEY, memory_json text);");
    }

    

    async complete(message: OmitPartialGroupDMChannel<Message>) {
        if (message.content.startsWith("!math ")) {
            const expression = message.content.slice(6);
            const result = calc(expression);
            if (result.error) {
                message.reply({
                    content: result.error,
                    allowedMentions: { parse: [] },
                });
            } else {
                message.reply({
                    content: result.result!,
                    allowedMentions: { parse: [] },
                });
            }
        }
        if (message.content.startsWith("!ts ")) {
            const code = message.content.slice(4);
            await message.channel.sendTyping();

            const mem = getMemory(this.db, message.author.id);
            try {
                const result = await runSandboxedCode(code, mem);

                const stringJson = JSON.stringify(result.mem);

                // Update memory in DB
                this.db.run("insert or replace into ts_memory (user_id, memory_json) values (?, ?)", [
                    message.author.id,
                    stringJson
                ]);

                if (result.output.trim().length === 0) {
                    message.react('✅');
                } else {
                    message.reply({
                        content: '```ansi\n' + result.output + '\n```',
                        allowedMentions: { parse: [] },
                    });
                }


            } catch (error) {
                message.reply({
                    content: `Error executing code: ${error}`,
                    allowedMentions: { parse: [] },
                });
            }
        }
    }
}