import type SlashCommand from '../../SlashCommand';
import { SlashCommandBuilder } from 'discord.js';

const command: SlashCommand = {
    type: "slash",
    data: new SlashCommandBuilder()
        .setName('securityguard')
        .setDescription('Work as a security guard. You can get real drops!!! Woaow!11 HELPO HPLE LHPE')

        .addStringOption(option =>
            option.setName('mode')
                .setDescription('Do you want to be super? Do you want to be ultra? Please dont')
                .addChoices(
                    { name: 'normal', value: 'normal' },
                    { name: 'super', value: 'super' },
                    { name: 'ultra', value: 'ultra' }
                )
                .setRequired(false))
};

export default command;
