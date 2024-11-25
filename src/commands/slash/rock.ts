import type SlashCommand from '../../SlashCommand';
import { SlashCommandBuilder } from 'discord.js';

const command: SlashCommand = {
    type: "slash",
    data: new SlashCommandBuilder()
        .setName('rock')
        .setDescription('Start a new game of What Beats Rock'),
};

export default command;
