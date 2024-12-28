import type SlashCommand from '../../SlashCommand';
import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder } from 'discord.js';

const command: SlashCommand = {
    type: "slash",
    data: new SlashCommandBuilder()
        .setName('item')
        .setDescription('Item-related commands')
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
        .addSubcommand(subcommand =>
            subcommand
                .setName('createtype')
                .setDescription('Create a new type of item, like sticks, phones, etc.')
                .addStringOption(option =>
                    option
                        .setName('id')
                        .setDescription('Unique item ID, can only have numbers, lowercase letters, and dashes.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('name')
                        .setDescription('Display name of the item.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('org')
                        .setDescription('The org that will own the item type. Must be an org you are in.')
                        .setRequired(true).setAutocomplete(true))
                .addStringOption(option =>
                    option
                        .setName('emoji')
                        .setDescription('A default emoji for the item, like ":rock:" (make sure have the colons)')
                        .setRequired(false)))

        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create new items of an existing type that you\'re a manufacturer of.')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Type of the item.')
                        .setRequired(true).setAutocomplete(true))
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('Amount of items to create.')
                        .setMinValue(1)
                        .setMaxValue(1000)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('give')
                .setDescription('Give items to a user.')
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to give the item to.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Type of the item.')
                        .setRequired(true).setAutocomplete(true))
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('Amount of items to give.')
                        .setMinValue(1)
                        .setMaxValue(1000)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('types')
                .setDescription('List the item types you are able to create.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('destroy')
                .setDescription('Incinerate item from your inventory. Mk VI Heavy Duty Basic Mkevx G03 Single-use.')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Type of the item to destroy.')
                        .setRequired(true).setAutocomplete(true))
                .addIntegerOption(option =>
                    option
                        .setName('amount')
                        .setDescription('Amount of items to destroy.')
                        .setMinValue(1)
                        .setMaxValue(1000)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('addmanufacturer')
                .setDescription('For item type owned by org you\'re admin, add new user to list of who make it. yes')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Type of the item to add a manufacturer to.')
                        .setRequired(true).setAutocomplete(true))
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to add as a manufacturer.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('removemanufacturer')
                .setDescription('For , opposite')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Type of the item to remove a manufacturer from.')
                        .setRequired(true).setAutocomplete(true))
                .addUserOption(option =>
                    option
                        .setName('user')
                        .setDescription('The user to remove as a manufacturer.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('manufacturers')
                .setDescription('List the users who can make an item type.')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Type of the item to list manufacturers for.')
                        .setRequired(true).setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('type')
                .setDescription('Get information about an item type.')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Type of the item to get info for.')
                        .setRequired(true).setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('transfertype')
                .setDescription('Give item type ownership to another org.')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('Type of the item to transfer.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('org')
                        .setDescription('The org to transfer it to')
                        .setRequired(true).setAutocomplete(true))
        )


};

export default command;
