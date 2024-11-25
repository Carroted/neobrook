import type SlashCommand from '../../SlashCommand';
import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder } from 'discord.js';

const command: SlashCommand = {
    type: "slash",
    data: new SlashCommandBuilder()
        .setName('transactions')
        .setDescription('List your last 10 transactions')
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall),
};

export default command;
