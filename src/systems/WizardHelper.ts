import { Client, Message } from "discord.js";

export default class WizardHelper {
    client: Client;

    activeWizards: {
        [userID: string]: string; // channelID
    } = {};

    responsePromiseResolves: {
        [userID: string]: (data: {
            content: string,
            attachments: string[],
        }) => void;
    } = {};

    constructor(client: Client) {
        this.client = client;
    }

    async message(message: Message) {
        if (message.author.bot) return;
        if (this.activeWizards[message.author.id] && message.channel.id === this.activeWizards[message.author.id]) {
            this.responsePromiseResolves[message.author.id]({
                content: message.content,
                attachments: message.attachments.map(a => a.url),
            });
            delete this.activeWizards[message.author.id];
            delete this.responsePromiseResolves[message.author.id];
        }
    }

    async getResponse(wizard: {
        userID: string,
        channelID: string,
    }): Promise<{
        content: string,
        attachments: string[],
    }> {
        return new Promise<{
            content: string,
            attachments: string[],
        }>(resolve => {
            this.activeWizards[wizard.userID] = wizard.channelID;
            this.responsePromiseResolves[wizard.userID] = resolve;
        });
    }
}