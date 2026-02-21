import type SlashCommand from '../../SlashCommand';
import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder } from 'discord.js';
import { Database } from "bun:sqlite";

const command: SlashCommand = {
    type: "slash",
    data: new SlashCommandBuilder()
        .setName('rep')
        .setDescription('Check your reputation')
        .addUserOption(option => 
            option.setName('target')
                .setDescription('The user to check the reputation of')
                .setRequired(false))
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall),
    async execute(interaction) {
        const target = interaction.options.getUser('target') ?? interaction.user;
        
        const db = new Database("brook.sqlite");
        const stmt = db.prepare("SELECT reputation FROM reputation WHERE user_id = ?");
        const row = stmt.get(target.id) as { reputation: number } | undefined;
        db.close();

        const reputation = row ? row.reputation : 0;

        await interaction.reply({
            embeds: [
                {
                    color: 0x2b2d31,
                    author: {
                        name: target.displayName,
                        icon_url: target.displayAvatarURL(),
                    },
                    description: `## ${reputation}\nReputation`,
                }
            ],
            ephemeral: true,
        });
    }
};

export default command;
