import { createCanvas } from "@napi-rs/canvas";
import { Message, type OmitPartialGroupDMChannel } from "discord.js";

export default class HexColorPreview {
    async sendColorPreviews(message: OmitPartialGroupDMChannel<Message>) {
        // if your message content includes a hex color, meaning it matches regex for stuff like #ff0000, or with alpha for #ff0000ff, we send a color preview with hexColorToImage(color)
        let hexColorRegex = /#([0-9a-fA-F]{3,8})\b/g;
        let match: RegExpExecArray | null;
        let colorImages: Buffer[] = [];
        while (match = hexColorRegex.exec(message.content)) {
            if (colorImages.length === 0) {
                message.channel.sendTyping();
            }
            // if we already have 10, stop
            if (colorImages.length >= 10) {
                break;
            }
            let color = match[0];
            let buffer = await this.hexColorToImage(color);
            if (buffer) {
                colorImages.push(buffer);
            }
        }
        if (colorImages.length > 0 && colorImages.length < 10) {
            await message.channel.send({
                files: colorImages,
                flags: [4096]
            });
        } else if (colorImages.length >= 10) {
            await message.channel.send('wow thats a lot of colors bro');
        }
    }

    async hexColorToImage(color: string) {
        const canvas = createCanvas(64, 32);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 64, 32);
        return await canvas.encode('png');
    }
}