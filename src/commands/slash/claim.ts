import type SlashCommand from '../../SlashCommand';
import { SlashCommandBuilder } from 'discord.js';

const command: SlashCommand = {
    type: "slash",
    data: new SlashCommandBuilder()
        .setName('claim')
        .setDescription('Claim your starting drops'),
};

export default command;
