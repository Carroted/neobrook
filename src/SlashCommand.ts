import type { ChatInputCommandInteraction, SharedSlashCommand } from 'discord.js';
import type BrookCommand from './BrookCommand';

export default interface SlashCommand extends BrookCommand {
    type: "slash";
    data: SharedSlashCommand;
    // Command handler may be defined in the command file, or elsewhere.
    // For instance, /rock command is defined in commands/rock.ts, but is handled in systems/BeatsRock.ts.
    execute?(interaction: ChatInputCommandInteraction): Promise<void>;
}
