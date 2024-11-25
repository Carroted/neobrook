import type SlashCommand from '../../SlashCommand';
import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder } from 'discord.js';

const command: SlashCommand = {
    type: "slash",
    data: new SlashCommandBuilder()
        .setName('pay')
        .setDescription('Pay a user or an org')
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .addSubcommand(subcommand =>
            subcommand
                .setName('user')
                .setDescription('Pay a specific user')
                .addUserOption(option =>
                    option
                        .setName('target')
                        .setDescription('The user to pay')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('The amount to pay')
                        .setMinValue(1)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('org')
                .setDescription('Pay an org')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('The org to pay')
                        .setRequired(true).setAutocomplete(true))
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('The amount to pay')
                        .setMinValue(1)
                        .setRequired(true))),
};

export default command;
