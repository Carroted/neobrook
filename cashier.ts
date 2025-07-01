import type SlashCommand from '../../SlashCommand';
import { SlashCommandBuilder } from 'discord.js';

const command: SlashCommand = {
    type: "slash",
    data: new SlashCommandBuilder()
        .setName('cashier')
        .setDescription('Work as a cashier. You can get real drops!!! Woaow!11')

        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Do you want to be super? Do you want to be ultra?')
                .addChoices(
                    { name: 'normal', value: 'normal' },
                    { name: 'super', value: 'super' },
                    { name: 'ultra', value: 'ultra' }
                )
                .setRequired(false))
};

export default command;
