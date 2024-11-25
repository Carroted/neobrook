import { ApplicationCommandType, ContextMenuCommandBuilder } from 'discord.js';
import type UserContextMenuCommand from '../../UserContextMenuCommand';

const command: UserContextMenuCommand = {
    type: "context",
    data: new ContextMenuCommandBuilder()
        .setName('Pay User')
        .setType(ApplicationCommandType.User as any),
};

export default command;
