import Database from "bun:sqlite";
import type { Client } from "discord.js";

export default class Orgs {
    db: Database;
    client: Client;

    constructor(db: Database, client: Client) {
        this.db = db;
        this.client = client;

        this.db.run("create table if not exists <...>");
    }
}