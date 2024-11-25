import type SlashCommand from '../../SlashCommand';
import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder } from 'discord.js';

const command: SlashCommand = {
    type: "slash",
    data: new SlashCommandBuilder()
        .setName('coin')
        .setDescription('Flips a coin')
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall),
    async execute(interaction) {
        let random = crypto.getRandomValues(new Uint8Array(1))[0];
        interaction.reply('You got **' + (random % 2 === 0 ? 'heads' : 'tails') + '**.');
    }
};

export default command;
