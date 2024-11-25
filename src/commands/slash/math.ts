import type SlashCommand from '../../SlashCommand';
import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder } from 'discord.js';

import { create, all } from 'mathjs';

const math = create(all);
const limitedEvaluate = math.evaluate;

math.import({
    import: function () { throw new Error('Function import is disabled') },
    createUnit: function () { throw new Error('Function createUnit is disabled') },
    evaluate: function () { throw new Error('Function evaluate is disabled') },
    parse: function () { throw new Error('Function parse is disabled') },
    simplify: function () { throw new Error('Function simplify is disabled') },
    derivative: function () { throw new Error('Function derivative is disabled') },
    d: function (sides: number) {
        return Math.floor(Math.random() * sides) + 1;
    },
    rand: function () {
        return Math.random();
    },
    dice: function (sides: number) {
        return Math.floor(Math.random() * sides) + 1;
    },
    die: function (sides: number) {
        return Math.floor(Math.random() * sides) + 1;
    },
    hi_guys: function () {
        return 'hi guys';
    },
}, { override: true });

const command: SlashCommand = {
    type: "slash",
    data: new SlashCommandBuilder()
        .setName('math')
        .setDescription('Evaluate a math expression')
        .addStringOption(option =>
            option.setName('expression').setDescription('Math expression to evaluate').setRequired(true))
        .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall),
    async execute(interaction) {
        try {
            let expression = interaction.options.getString('expression', true).trim();
            let evaledUp = limitedEvaluate(expression);

            await interaction.reply({
                content: evaledUp.toString(), allowedMentions: { parse: [] }, ephemeral: true,
            });
        } catch (err) {
            await interaction.reply({
                embeds: [
                    {
                        author: {
                            icon_url: 'https://cdn.discordapp.com/emojis/1212168671246684281.webp?size=512&quality=lossless',
                            name: 'Math Error'
                        },
                        description: '```\n' + (err as any).toString().replace('Error: ', '').trim() + '\n```',
                        color: 0xf16158
                    }
                ],
                allowedMentions: { parse: [] },
                ephemeral: true,
            });
        }
    }
};

export default command;
