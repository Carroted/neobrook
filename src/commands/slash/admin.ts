import type SlashCommand from '../../SlashCommand';
import { ApplicationIntegrationType, InteractionContextType, PermissionsBitField, SlashCommandBuilder } from 'discord.js';

const command: SlashCommand = {
    type: "slash",
    data: new SlashCommandBuilder()
        .setName('admin')
        .setDescription('Admin commands')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('deletetype')
                .setDescription('Pay a specific user')
                .addStringOption(option =>
                    option
                        .setName('type')
                        .setDescription('The type to delete')
                        .setRequired(true).setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('deleteorg')
                .setDescription('Pay an org')
                .addStringOption(option =>
                    option
                        .setName('org')
                        .setDescription('The org to delete')
                        .setRequired(true).setAutocomplete(true)))
};

export default command;
