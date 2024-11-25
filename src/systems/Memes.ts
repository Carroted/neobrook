import { TextChannel } from "discord.js";
import { Database } from "bun:sqlite";

interface XKCD {
    month: string;
    num: number;
    link: string;
    year: string;
    news: string;
    safe_title: string;
    transcript: string;
    alt: string;
    img: string;
    title: string;
    day: string;
}

export default class Memes {
    db: Database;
    memesChannel: TextChannel;

    constructor(db: Database, memesChannel: TextChannel) {
        this.db = db;
        this.memesChannel = memesChannel;

        db.run("create table if not exists xkcd (num integer);");

        // hourly
        setInterval(() => {
            this.sendXKCD();
        }, 60 * 60 * 1000);

        this.sendXKCD();
    }

    async sendXKCD() {
        // latest xkcd
        let xkcd = await this.getLatestXKCD();
        let lastXKCDSent = this.getLastXKCDSent();
        if (lastXKCDSent !== xkcd.num) {
            this.memesChannel.send({
                files: [xkcd.img],
                content: `### Today's XKCD: [__${xkcd.title}__](<https://xkcd.com/${xkcd.num}>)\n"${xkcd.alt}"`
            });
        }
        this.setLastXKCDSent(xkcd.num);
    }

    async getLatestXKCD(): Promise<XKCD> {
        let response = await fetch('https://xkcd.com/info.0.json');
        let json = await response.json();
        return json as XKCD;
    }

    getLastXKCDSent(): number {
        let stmt = this.db.query("select * from xkcd");
        let rows = stmt.all();
        if (rows.length > 0) {
            return (rows[0] as any).num;
        }
        else {
            return 0;
        }
    }

    setLastXKCDSent(num: number) {
        let stmt = this.db.query("select * from xkcd");
        let rows = stmt.all();
        if (rows.length > 0) {
            this.db.run("update xkcd set num = ?", [num]);
        }
        else {
            this.db.run("insert into xkcd (num) values (?)", [num]);
        }
    }
}