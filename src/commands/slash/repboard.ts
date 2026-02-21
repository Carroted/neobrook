import type SlashCommand from '../../SlashCommand';
import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder, type APIEmbed } from 'discord.js';
import { Database } from "bun:sqlite";

const command: SlashCommand = {
    type: "slash",
    data: new SlashCommandBuilder()
        .setName('repboard')
        .setDescription('View the reputation leaderboard')
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall),
    async execute(interaction) {
        const db = new Database("brook.sqlite");
        const stmt = db.prepare("SELECT user_id, reputation FROM reputation ORDER BY reputation DESC LIMIT 10");
        const rows = stmt.all() as { user_id: string, reputation: number }[];
        db.close();

        if (rows.length === 0) {
            await interaction.reply({
                content: 'No reputation data found yet!',
                ephemeral: true,
            });
            return;
        }

        const embed: APIEmbed = {
            color: 0x2b2d31,
            title: 'Reputation Leaderboard',
            description: rows.map((row, index) => {
                return `${index + 1}. <@${row.user_id}>: **${row.reputation}**`;
            }).join('\n')
        };

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

export default command;
