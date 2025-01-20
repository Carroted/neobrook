import Database from "bun:sqlite";
import Economy, { stringifyMoney } from "./Economy";
import { Events, Message, TextChannel, type Client } from "discord.js";

import path from 'path';

import { createApi } from 'unsplash-js';

interface News {
    title: string,
    description: string,
    stockImpacts: {
        id: string,
        trend: number,
        volatility: number,
    }[],
}

export default class Stocks {
    db: Database;
    economy: Economy;
    client: Client;
    manager: StocksManager;
    nextNews: News | null = null;
    newsChannel: TextChannel;
    stocksChannel: TextChannel;

    messages: {
        [id: string]: Message
    } = {};

    getNews(): News | null {
        if (this.nextNews) {
            let news = this.nextNews;
            this.nextNews = null;
            return news;
        }

        let r = Math.random();
        if (r < 0.2) {
            // mkevx g<num>
            let counter = this.getCounter('g');
            this.incrementCounter('g');

            let name = `G${counter.toString().padStart(2, '0')}`;

            if (Math.random() > 0.5) {
                this.nextNews = {
                    title: `Mkevx ${name} is a complete flop`,
                    description: `"worst bullshit i ever ummm uhhh umm" - Joe`,
                    stockImpacts: [{
                        id: 'MKVX',
                        trend: -1.8,
                        volatility: -2,
                    }, {
                        id: 'DETH',
                        trend: 0.25,
                        volatility: -0.2,
                    }]
                };
            } else {
                this.nextNews = {
                    title: `Mkevx ${name} is literally peak i love them`,
                    description: `"this fucking fuck is peak, buy now" - Snake`,
                    stockImpacts: [{
                        id: 'MKVX',
                        trend: 1.5,
                        volatility: -2,
                    }, {
                        id: 'DETH',
                        trend: -0.25,
                        volatility: 0.5
                    }]
                };
            }

            return {
                title: `Mkevx announces ${name}`,
                description: `Releases right now. I guess we will see reviews in 60 seconds`,
                stockImpacts: [{
                    id: 'MKVX',
                    trend: 0.3,
                    volatility: 2,
                }, {
                    id: 'DETH',
                    trend: -0.15,
                    volatility: 0.5,
                }]
            };
        } else if (r < 0.4) {
            let good = Math.random() < 0.5;

            return {
                title: `Death financial report situation is crazy`,
                description: `Literally ${good ? 'buy' : 'sell'}`,
                stockImpacts: [{
                    id: 'MKVX',
                    trend: good ? -0.5 : 0.5,
                    volatility: good ? 2 : -0.5,
                }, {
                    id: 'DETH',
                    trend: good ? 1 : -2,
                    volatility: good ? -2 : 2,
                }]
            };
        } else if (r < 0.6) {
            if (Math.random() < 0.5) {
                return {
                    title: `Sally just assassinated CEO of DontCare`,
                    description: `I am struggling to find myself emotiobally impacted\n*emotionnalllyb`,
                    stockImpacts: [{
                        id: 'DNTC',
                        trend: -10,
                        volatility: 10,
                    }]
                };
            } else {
                return {
                    title: `DontCare just denied another claim`,
                    description: `Experts say this will lead to profits for DontCare\nAlso the winterstorms are calming down. Less volatile`,
                    stockImpacts: [{
                        id: 'DNTC',
                        trend: 10,
                        volatility: -10,
                    }, {
                        id: 'WNTR',
                        trend: 0,
                        volatility: -100,
                    }]
                };
            }
        } else if (r < 0.8) {
            if (Math.random() < 0.5) {
                return {
                    title: `Brr its freezing`,
                    description: `Praise wintercorp 帮我 :fire::fire::fire: 尖叫 :fire: 我快窒息了`,
                    stockImpacts: [{
                        id: 'WNTR',
                        trend: 10,
                        volatility: 10,
                    }]
                };
            } else {
                return {
                    title: `Investors just remembered summer exists`,
                    description: `You know what THAT means`,
                    stockImpacts: [{
                        id: 'WNTR',
                        trend: -10,
                        volatility: 10,
                    }]
                };
            }
        } else if (true) {
            return {
                title: `Calm down stocks tsksksk`,
                description: `Praise wintercorp 帮我 :fire::fire::fire: 尖叫 :fire: 我快窒息了`,
                stockImpacts: [{
                    id: 'WNTR',
                    trend: 0,
                    volatility: -100,
                }, {
                    id: 'MKVX',
                    trend: 0,
                    volatility: -100,
                }]
            };

        } else {
            return null;
        }
    }

    async setup() {
        await this.manager.loadAssets();
        this.messages['MKVX'] = await this.stocksChannel.messages.fetch('1330697009882988627');
        this.messages['DETH'] = await this.stocksChannel.messages.fetch('1330697029822709912');
        this.messages['DNTC'] = await this.stocksChannel.messages.fetch('1330697036596514948');
        this.messages['WNTR'] = await this.stocksChannel.messages.fetch('1330697041541726310');
    }

    constructor(db: Database, client: Client, economy: Economy, newsChannel: TextChannel, stocksChannel: TextChannel) {
        this.db = db;
        this.client = client;
        this.economy = economy;
        this.manager = new StocksManager(this.db);
        this.newsChannel = newsChannel;
        this.stocksChannel = stocksChannel;

        /*this.manager.addStock("MKVX", "Mkevx LLC", 150, 2, 1000000);
        this.manager.addStock("DETH", "Death Software", 150, 2, 1000000);
        this.manager.addStock("DNTC", "DontCare Health", 150, 2, 1000000);
        this.manager.addStock("WNTR", "Winter Corporation", 150, 2, 1000000);
        this.manager.setStockInfluence(`DETH`, `MKVX`, -0.1);
        this.manager.setStockInfluence(`MKVX`, `DETH`, -0.1);
        this.manager.setStockInfluence(`WNTR`, `DETH`, 5);

        for (let i = 0; i < 60; i++) {
            this.manager.updateStockPrices();
        }*/

        const cycle = () => {
            let news = this.getNews();
            if (news) {
                this.newsChannel.send(`## ${news.title}\n${news.description}`);
                for (let g of news.stockImpacts) {
                    this.manager.applyNewsImpact(g.id, g.trend, g.volatility);
                }
            }
            setTimeout(() => {
                this.manager.updateStockPrices();

                for (let id of Object.keys(this.messages)) {
                    const stock = this.manager.getStock(id);

                    if (stock) {
                        this.messages[id].edit({
                            files: [this.manager.render(stock.name, stock.id, this.manager.getStockHistory(id, 15))],
                            content: '',
                            embeds: [],
                            components: []
                        });
                    }
                }
            }, 1000 * 30);
        }

        setInterval(() => {
            cycle();
        }, 1000 * 60);
        cycle();

        this.db.run("create table if not exists user_shares (id TEXT, user_id TEXT, amount INTEGER);");
        //this.db.run('drop table product_counters');
        this.db.run("create table if not exists product_counters (id TEXT, counter INTEGER);");
        this.incrementCounter('g');
        this.incrementCounter('g');
        this.incrementCounter('g');

        this.client.on(Events.InteractionCreate, async (interaction) => {
            try {
                if (interaction.isAutocomplete()) {
                    const focusedOption = interaction.options.getFocused(true);
                    if (interaction.commandName === 'stocks') {
                        const types = this.manager.getAllStocks();
                        let matching = types.filter((type) => type.id.includes(focusedOption.value.toUpperCase()));
                        // filter to at most 25
                        matching = matching.slice(0, 25);
                        await interaction.respond(matching.map((choice) => { return { name: choice.id, value: choice.id }; }));
                    }
                }

                if (interaction.isChatInputCommand()) {
                    if (interaction.commandName !== 'stocks') return;

                    const sub = interaction.options.getSubcommand();

                    if (sub === 'view') {
                        const id = interaction.options.getString('id', true).toUpperCase();

                        const stock = this.manager.getStock(id);

                        if (!stock) {
                            return interaction.reply('No!!');
                        }

                        interaction.reply({
                            files: [this.manager.render(stock.name, stock.id, this.manager.getStockHistory(id, 15))],
                        });
                    }

                    if (sub === 'list') {
                        interaction.reply(this.manager.getAllStocks().map((s) => `- ${s.name} (${s.id}) - ${stringifyMoney(Math.round(s.price))}`).join('\n'));
                    }

                    if (sub === 'shares') {
                        interaction.reply(this.getAllShares(interaction.user.id).map((s) => `${s.id}: ${s.amount}`).join('\n'));
                    }

                    if (sub === 'buy') {
                        const id = interaction.options.getString('id', true).toUpperCase();
                        const stock = this.manager.getStock(id);

                        if (!stock) {
                            return interaction.reply('No!!');
                        }

                        const amount = interaction.options.getInteger('amount', true);
                        if (amount < 0) {
                            return interaction.reply('no neg')
                        }

                        const cost = amount * stock.price;
                        if (cost < 0) {
                            return interaction.reply('no neg')
                        }

                        this.economy.pay(interaction.user, this.client.user!, Math.round(cost), interaction).then(() => {
                            this.changeShares(interaction.user.id, id, amount);
                        }).catch(() => { });
                    }

                    if (sub === 'sell') {
                        const id = interaction.options.getString('id', true).toUpperCase();
                        const stock = this.manager.getStock(id);

                        if (!stock) {
                            return interaction.reply('No!!');
                        }

                        const amount = interaction.options.getInteger('amount', true);

                        if (amount < 0) {
                            return interaction.reply('no neg')
                        }

                        let a = this.getShares(interaction.user.id, id);

                        if (this.economy.getMoney(this.client.user!.id) < Math.round(stock.price * amount)) {
                            return interaction.reply('im broke');
                        }

                        if (a >= amount) {
                            this.changeShares(interaction.user.id, id, -amount);
                            this.economy.changeMoney(interaction.user.id, Math.round(stock.price * amount));
                            this.economy.changeMoney(this.client.user!.id, Math.round(-stock.price * amount));

                            interaction.reply(`You sold ${amount} shares of ${stock.id} (each ${stringifyMoney(Math.round(stock.price))}) for a total of ${stringifyMoney(Math.round(stock.price * amount))}`);
                        } else {
                            interaction.reply('u don haves enoughs');
                        }
                    }
                }
            } catch (e) {
                console.error(e);
                if (interaction.channel && interaction.channel.isSendable()) {
                    interaction.channel.send({
                        content: 'Some issue is happen! Help me! ' + (e as any).toString(),
                    });
                }
            }
        });
    }

    changeShares(user_id: string, id: string, amount: number) {
        let stmt = this.db.query("select * from user_shares where user_id = ? and id = ?");
        let rows = stmt.all(user_id, id);
        if (rows.length > 0) {
            // update
            this.db.run("update user_shares set amount = amount + ? where user_id = ? and id = ?", [
                amount,
                user_id,
                id,
            ]);
        }
        else {
            // insert
            this.db.run("insert into user_shares (user_id, amount, id) values (?, ?, ?)", [
                user_id,
                amount,
                id,
            ]);
        }
    }

    getShares(user_id: string, id: string): number {
        let stmt = this.db.query("select * from user_shares where user_id = ? and id = ?");
        let rows = stmt.all(user_id, id);
        if (rows.length > 0) {
            return (rows[0] as any).amount;
        }
        else {
            return 0;
        }
    }

    getAllShares(user_id: string): { id: string, amount: number }[] {
        let stmt = this.db.query("select * from user_shares where user_id = ?");
        let rows = stmt.all(user_id) as any[];
        return rows.map((row) => {
            return {
                id: row.id,
                amount: row.amount,
            };
        });
    }

    sumShares(id: string): number {
        let stmt = this.db.query("select * from user_shares where id = ?");
        let rows = stmt.all(id) as any[];

        let total = 0;
        for (let i = 0; i < rows.length; i++) {
            total += rows[0].amount;
        }

        return total;
    }

    incrementCounter(id: string) {
        let stmt = this.db.query("select * from product_counters where id = ?");
        let rows = stmt.all(id);
        if (rows.length > 0) {
            // update
            this.db.run("update product_counters set counter = counter + ? where id = ?", [
                1,
                id,
            ]);
        }
        else {
            // insert
            this.db.run("insert into product_counters (counter, id) values (?, ?)", [
                1,
                id,
            ]);
        }
    }

    getCounter(id: string): number {
        let stmt = this.db.query("select * from product_counters where id = ?");
        let rows = stmt.all(id);
        if (rows.length > 0) {
            return (rows[0] as any).counter;
        }
        else {
            return 0;
        }
    }
}

import { createCanvas, GlobalFonts, loadImage, Image, type SKRSContext2D, Canvas } from "@napi-rs/canvas";
import { createNoise2D, type NoiseFunction2D } from 'simplex-noise';

/**
 * Represents a stock in the market.
 */
interface Stock {
    id: string; // The stock ticker symbol (e.g., "AAPL")
    name: string; // The full name of the stock (e.g., "Apple")
    price: number; // The current price of the stock
    trend: number; // The current trend affecting the stock's price
    volatility: number; // The volatility factor of the stock, affecting randomness
    shares: number; // Total number of shares available
    influences: { [key: string]: number }; // Maps other stock tickers to influence weights
}

function mapPriceToCanvas(price: number, min: number, max: number, canvasHeight: number): number {
    const range = max - min;
    if (range === 0) {
        return canvasHeight / 2;
    }
    return canvasHeight - ((price - min) / range) * canvasHeight;
}

/**
 * Manages a collection of stocks, their relationships, and price updates.
 */
class StocksManager {
    private db: Database;
    private time: number;
    private noises: {
        [id: string]: NoiseFunction2D;
    };
    private drop: Image | null = null;
    private ctx: SKRSContext2D;
    private canvas: Canvas;

    canvasWidth = 800;
    canvasHeight = 400;

    constructor(db: Database) {
        this.db = db;
        this.time = 0;
        this.noises = {};

        this.canvas = createCanvas(this.canvasWidth, this.canvasHeight);
        this.ctx = this.canvas.getContext('2d');

        // Create tables for storing stock data and histories
        this.db.run(`
      CREATE TABLE IF NOT EXISTS stocks (
        id TEXT PRIMARY KEY,        -- Using ticker symbol as the primary key
        name TEXT,
        price REAL,
        trend REAL,
        volatility REAL,
        shares INTEGER,
        influences TEXT
      );
    `);

        this.db.run(`
      CREATE TABLE IF NOT EXISTS stocks_histories (
        stock_id TEXT,
        price REAL,
        timestamp REAL,
        FOREIGN KEY(stock_id) REFERENCES stocks(id)
      );
    `);
    }


    async loadAssets() {
        this.drop = await loadImage(path.join(import.meta.dir, '..', '..', 'assets', 'dropdim3.png'));
        GlobalFonts.registerFromPath(path.join(import.meta.dir, '..', '..', 'assets', 'Inter_24pt-Medium.ttf'), 'Inter');
    }

    render(name: string, id: string, data: { price: number; timestamp: number }[]): Buffer {
        const xPadding = 30; // X-axis padding
        const yPadding = 110;

        // Create a canvas instance
        const start = data[0].price;
        const end = data[data.length - 1].price;

        // Set dark theme background
        this.ctx.fillStyle = '#121212'; // Dark gray background
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Set text style for labels
        this.ctx.fillStyle = '#ffffffe0'; // Light gray for text
        this.ctx.font = '40px Inter';

        // Draw chart labels
        const priceText = Math.round(end).toString();
        const priceW = this.ctx.measureText(priceText).width;
        this.ctx.fillText(priceText, 20, 60);

        this.ctx.drawImage(this.drop!, priceW + 5 + 20, 25, 44, 44);

        this.ctx.font = '24px Inter';
        this.ctx.fillText(name, 20, this.canvasHeight - 30);

        const nameW = this.ctx.measureText(name).width;

        this.ctx.font = '16px Inter';
        this.ctx.fillStyle = '#ffffffa0'; // Light gray for text
        this.ctx.fillText(`(${id})`, 30 + nameW, this.canvasHeight - 30);

        const lastW = this.ctx.measureText(`Last 15 minutes`).width;
        this.ctx.fillText(`Last 15 minutes`, this.canvasWidth - lastW - 20, this.canvasHeight - 30);

        this.ctx.font = '16px Inter';

        // Prepare the data
        const priceMax = Math.max(...data.map(d => d.price));
        const priceMin = Math.min(...data.map(d => d.price));

        const stocksHeight = this.canvasHeight - (yPadding * 2);

        // Draw the price history as a line graph
        this.ctx.beginPath();
        this.ctx.moveTo(xPadding, mapPriceToCanvas(data[0].price, priceMin, priceMax, stocksHeight) + yPadding);


        // Style the graph line
        let lineColor = '#79ee55'; // Default green

        if (start > end) {
            lineColor = '#ff8772'; // Red if the price is decreasing
        }

        const textGradient = this.ctx.createLinearGradient(0, 0, this.canvasWidth, 0); // Horizontal gradient
        textGradient.addColorStop(0, lineColor + 'a0'); // Start with the line color + opacity
        textGradient.addColorStop(1, '#ffffffa0'); // End with white + opacity

        for (let i = 1; i < data.length; i++) {
            const x = (i / (data.length - 1)) * (this.canvasWidth - 2 * xPadding) + xPadding; // Add X padding
            const y = mapPriceToCanvas(data[i].price, priceMin, priceMax, stocksHeight);

            this.ctx.lineTo(x, y + yPadding);

            // Calculate whether the point is a peak or a trench
            let labelPosition = 'above'; // Default to above
            if (i > 0 && i < data.length - 1) {
                const prevPrice = data[i - 1].price;
                const nextPrice = data[i + 1].price;
                if (data[i].price > prevPrice && data[i].price > nextPrice) {
                    labelPosition = 'above'; // Peak
                } else if (data[i].price < prevPrice && data[i].price < nextPrice) {
                    labelPosition = 'below'; // Trench
                }
            }

            // Draw price labels at each point
            const priceText = Math.round(data[i].price).toString(); // Formatting price to 2 decimal points
            const labelX = x - this.ctx.measureText(priceText).width / 2; // Center horizontally
            let labelY = y + yPadding;

            // Adjust vertical position based on peak/trench
            if (labelPosition === 'above') {
                labelY -= 15; // Place above for peak
            } else if (labelPosition === 'below') {
                labelY += 25; // Place below for trench
            }

            // Draw the label
            //this.ctx.fillStyle = '#ffffffa0';
            this.ctx.fillStyle = textGradient;
            this.ctx.fillText(priceText, labelX, labelY);
        }

        // Set the graph line color and stroke it
        this.ctx.strokeStyle = lineColor + 'a0'; // With opacity 0.625
        this.ctx.lineWidth = 3;
        this.ctx.stroke();

        // Create a gradient for the area below the line
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvasHeight * 0.8); // End gradient at 80% height
        gradient.addColorStop(0, lineColor + '30'); // Start with 30% opacity
        gradient.addColorStop(0.9, lineColor + '00'); // End with 00% opacity at 80%

        // Set the gradient as the fillStyle
        this.ctx.fillStyle = gradient;

        // Fill the area under the line with the gradient
        this.ctx.lineTo(this.canvasWidth - xPadding, this.canvasHeight - yPadding); // Draw the bottom right corner
        this.ctx.lineTo(xPadding, this.canvasHeight - yPadding); // Draw the bottom left corner
        this.ctx.closePath();
        this.ctx.fill();

        for (let i = 0; i < data.length; i++) {
            const x = (i / (data.length - 1)) * (this.canvasWidth - 2 * xPadding) + xPadding; // Add X padding
            const y = mapPriceToCanvas(data[i].price, priceMin, priceMax, stocksHeight);

            // Draw a small circle at each data point
            this.ctx.beginPath();
            this.ctx.arc(x, y + yPadding, 5, 0, Math.PI * 2); // Small circle at each point (radius 5)
            this.ctx.fillStyle = lineColor + 'a0'; // Use the same color as the line
            this.ctx.fill();
            this.ctx.closePath();
        }

        // Return the image buffer
        return this.canvas.toBuffer('image/png');
    }

    /**
     * Adds a new stock to the database.
     * @param id - The ticker symbol of the stock (e.g., "AAPL").
     * @param name - The full name of the stock (e.g., "Apple").
     * @param initialPrice - The starting price of the stock.
     * @param volatility - The volatility factor of the stock.
     * @param shares - The total number of shares available.
     */
    addStock(id: string, name: string, initialPrice: number, volatility: number, shares: number): void {
        // Add stock data to the `stocks` table
        this.db.run(
            `INSERT OR REPLACE INTO stocks (id, name, price, trend, volatility, shares, influences) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            id,
            name,
            initialPrice,
            0, // initial trend
            volatility,
            shares,
            "{}" // empty influence JSON
        ]);

        this.noises[id] = createNoise2D();
    }

    /**
     * Sets how much another stock influences the specified stock.
     * @param stockId - The ticker symbol of the stock being influenced.
     * @param influencedById - The ticker symbol of the stock that is influencing it.
     * @param weight - The weight of the influence.
     */
    setStockInfluence(stockId: string, influencedById: string, weight: number): void {
        const stock = this.getStock(stockId);
        if (stock) {
            const influences = stock.influences;
            influences[influencedById] = weight;
            // Update influences in the database
            this.db.run(
                `UPDATE stocks SET influences = ? WHERE id = ?`,
                [
                    JSON.stringify(influences),
                    stockId
                ]
            );
        }
    }

    /**
     * Applies an external impact to a specific stock, modifying its trend.
     * @param stockId - The ticker symbol of the stock to affect.
     * @param impact - The magnitude of the impact.
     */
    applyNewsImpact(stockId: string, trend: number, volatility: number): void {
        const stock = this.getStock(stockId);
        if (stock) {
            stock.trend += trend;
            stock.volatility += volatility;
            stock.volatility = Math.max(stock.volatility, 0);
            // Update the trend in the database
            this.db.run(
                `UPDATE stocks SET trend = ?, volatility = ? WHERE id = ?`,
                [
                    stock.trend,
                    stock.volatility,
                    stockId
                ]
            );
        }
    }

    /**
     * Retrieves a stock from the database.
     * @param stockId - The ticker symbol of the stock.
     * @returns The stock data, or null if not found.
     */
    getStock(stockId: string): Stock | null {
        const stmt = this.db.query("SELECT * FROM stocks WHERE id = ?");
        const row = stmt.all(stockId)[0] as any;
        if (row) {
            return {
                id: row.id,
                name: row.name,
                price: row.price,
                trend: row.trend,
                volatility: row.volatility,
                shares: row.shares,
                influences: JSON.parse(row.influences),
            };
        }
        return null;
    }

    /**
     * Updates all stock prices based on trends, influences, and random noise.
     */
    updateStockPrices(): void {
        this.time += 0.01;
        const stocks = this.getAllStocks();
        const currentTimestamp = Date.now();  // Ensure the same timestamp for all updates

        for (const stock of stocks) {
            if (!
                this.noises[stock.id]) {

                this.noises[stock.id] = createNoise2D();
            }
            // calculate smooth noise
            const noiseFactor = this.noises[stock.id](this.time, stock.price) * stock.volatility;

            // apply trend and noise
            stock.price += stock.trend + noiseFactor;

            // apply influence from other stocks
            for (const [influencedById, weight] of Object.entries(stock.influences)) {
                const influencingStock = this.getStock(influencedById);
                if (influencingStock) {
                    stock.price += weight * influencingStock.trend;
                }
            }

            // decay the trend slightly for realism
            stock.trend *= 0.95;

            // ensure price stays realistic
            stock.price = Math.min(Math.max(stock.price, -5), 50);

            // Save the updated price in the stocks_histories table with the current timestamp
            this.saveStockHistory(stock, currentTimestamp);

            // Update the stock price in the database
            this.db.run(
                `UPDATE stocks SET price = ? WHERE id = ?`,
                [
                    stock.price,
                    stock.id
                ]
            );
        }
    }

    /**
     * Retrieves all stocks from the database.
     * @returns A list of all stock objects.
     */
    getAllStocks(): Stock[] {
        const stmt = this.db.query("SELECT * FROM stocks");
        const rows = stmt.all() as any[];
        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            price: row.price,
            trend: row.trend,
            volatility: row.volatility,
            shares: row.shares,
            influences: JSON.parse(row.influences),
        }));
    }

    /**
     * Saves a stock's price history to the `stocks_histories` table.
     * @param stock - The stock whose price history is being saved.
     * @param timestamp - The timestamp to use for this history entry.
     */
    private saveStockHistory(stock: Stock, timestamp: number): void {
        this.db.run(
            `INSERT INTO stocks_histories (stock_id, price, timestamp) VALUES (?, ?, ?)`,
            [
                stock.id,
                stock.price,
                timestamp
            ]
        );
    }

    /**
     * Retrieves the historical prices of a specific stock.
     * @param stockId - The ticker symbol of the stock.
     * @param limit - The number of historical prices to fetch.
     * @returns A list of historical prices for the stock.
     */
    getStockHistory(stockId: string, limit: number = 10): { price: number; timestamp: number }[] {
        const stmt = this.db.query(
            `SELECT price, timestamp FROM stocks_histories WHERE stock_id = ? ORDER BY timestamp DESC LIMIT ?`,

        );
        return stmt.all(
            stockId,
            limit
        ).map((row) => ({
            price: (row as any).price,
            timestamp: (row as any).timestamp,
        })).reverse();
    }

    /**
     * Retrieves the current prices and share information for all stocks.
     * @returns An object mapping stock IDs (tickers) to their price and share data.
     */
    getStockPrices(): { [id: string]: { price: number; shares: number } } {
        const stocks = this.getAllStocks();
        const prices: { [id: string]: { price: number; shares: number } } = {};
        for (const stock of stocks) {
            prices[stock.id] = {
                price: stock.price,
                shares: stock.shares,
            };
        }
        return prices;
    }
}