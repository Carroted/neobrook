import type { ContextMenuCommandBuilder, UserContextMenuCommandInteraction } from 'discord.js';
import type BrookCommand from './BrookCommand';

export default interface UserContextMenuCommand extends BrookCommand {
    type: "context";
    data: ContextMenuCommandBuilder;
    execute?(interaction: UserContextMenuCommandInteraction): Promise<void>;
}
