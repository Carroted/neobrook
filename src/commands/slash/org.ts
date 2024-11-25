import type SlashCommand from '../../SlashCommand';
import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder } from 'discord.js';

const command: SlashCommand = {
    type: "slash",
    data: new SlashCommandBuilder()
        .setName('org')
        .setDescription('Commands related to orgs')
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM])
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View a specific org')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('The org to view')
                        .setRequired(true).setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('leave')
                .setDescription('Leave an org')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('The org to leave')
                        .setRequired(true).setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('payall')
                .setDescription('Pay all members of an org you\'re admin of')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('The org to pay users of')
                        .setRequired(true).setAutocomplete(true))
                .addIntegerOption(option => option.setName('amount').setDescription('The amount to pay each user').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('draw')
                .setDescription('Take currency out of an org you\'re admin of')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('The org to draw from')
                        .setRequired(true).setAutocomplete(true))
                .addIntegerOption(option => option.setName('amount').setDescription('The amount to draw').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('transfer')
                .setDescription('Transfer ownership of an org you own of to a user')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('The org to transfer')
                        .setRequired(true).setAutocomplete(true))
                .addUserOption(option => option.setName('user').setDescription('The new org owner').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete an org you own')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('The org to delete')
                        .setRequired(true).setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('invite')
                .setDescription('Invite a user to an org you\'re admin of. Invite is sent here, so make sure they can see the channel.')
                .addUserOption(option => option.setName('user').setDescription('The user to invite').setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('The org to invite the user to')
                        .setRequired(true).setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('kick')
                .setDescription('Remove a user from an org you\'re admin of')
                .addUserOption(option => option.setName('user').setDescription('The user to remove').setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('The org to kick the user from')
                        .setRequired(true).setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create an org'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List orgs')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('What orgs to list')
                        .setRequired(true)
                        .setChoices([
                            { name: 'All', value: 'all' },
                            { name: 'Orgs you own', value: 'owned' },
                            { name: 'Orgs you\'re in', value: 'member' },
                        ])))
};

export default command;
