import type SlashCommand from '../../SlashCommand';
import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder } from 'discord.js';

const command: SlashCommand = {
    type: "slash",
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Roll some dice')
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .addStringOption(option => option.setName('dice').setDescription('Dice to roll, like "d6" or "2d20"').setRequired(true)),
    async execute(interaction) {
        let regex = new RegExp(`(\\d+)?d(\\d+)$`);
        let match = interaction.options.getString('dice', true).toLowerCase().match(regex);
        if (!match) {
            return;
        }
        let count = 1;
        let sides = 6;
        if (match[1]) {
            count = parseInt(match[1]);
        }
        sides = parseInt(match[2]);
        if (isNaN(sides)) {
            interaction.reply('Please specify a number!');
            return;
        }
        if (sides < 1) {
            interaction.reply('Please specify a number greater than 0!');
            return;
        }
        // since we use uint8arrays for crypto, we can only get up to 255, so we have to limit it to 255
        if (sides > 255) {
            interaction.reply('Please specify a number less than 256!');
            return;
        }
        let rolls = [];
        for (let i = 0; i < count; i++) {
            let random = crypto.getRandomValues(new Uint8Array(1))[0] % sides;
            rolls.push(random + 1);
        }
        let total = rolls.reduce((a, b) => a + b, 0);
        if (count === 1) {
            await interaction.reply(`You rolled a d${sides} and got ${rolls[0]}!`);
        } else {
            await interaction.reply(`You rolled ${count}d${sides} and got ${rolls.join(', ')} for a total of ${total}!`);
        }
    }
};

export default command;
