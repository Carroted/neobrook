import type SlashCommand from '../../SlashCommand';
import { SlashCommandBuilder } from 'discord.js';

const command: SlashCommand = {
    type: "slash",
    data: new SlashCommandBuilder()
        .setName('cashier')
        .setDescription('Work as a cashier. You can get real drops!!! Woaow!11')
};

export default command;
