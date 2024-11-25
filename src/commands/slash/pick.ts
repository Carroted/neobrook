import type SlashCommand from '../../SlashCommand';
import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder } from 'discord.js';

const command: SlashCommand = {
    type: "slash",
    data: new SlashCommandBuilder()
        .setName('pick')
        .setDescription('Picks a random item from a list')
        .addStringOption(option => option.setName('items').setRequired(true).setDescription('The list of items, separated by spaces'))
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall),
    async execute(interaction) {
        let items = interaction.options.getString('items', true).trim().split(' ');

        if (items.length === 0) {
            interaction.reply({
                content: 'Please specify at least one option!',
                ephemeral: true,
            });
            return;
        }
        // get random number between 0 and options.length - 1
        let random = crypto.getRandomValues(new Uint8Array(1))[0] % items.length;
        interaction.reply({
            content: 'I pick **' + items[random] + '**.', allowedMentions: { parse: [] }, ephemeral: false,
        });
    }
};

export default command;
