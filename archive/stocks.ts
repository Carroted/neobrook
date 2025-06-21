// import type SlashCommand from '../../SlashCommand';
// import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder } from 'discord.js';

// const command: SlashCommand = {
//     type: "slash",
//     data: new SlashCommandBuilder()
//         .setName('stocks')
//         .setDescription('Become a multi-trillionaire')
//         .setContexts([InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel])
//         .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall)
//         .addSubcommand(subcommand =>
//             subcommand
//                 .setName('buy')
//                 .setDescription('Buy some [[SHARE]] of a')
//                 .addStringOption(option =>
//                     option
//                         .setName('id')
//                         .setDescription('Symbol of the stock. See /stocks list')
//                         .setRequired(true).setAutocomplete(true))
//                 .addIntegerOption(option =>
//                     option
//                         .setName('amount')
//                         .setDescription('The amount of shares to buy. Be careful, make sure check the price first')
//                         .setMinValue(1)
//                         .setRequired(true)))
//         .addSubcommand(subcommand =>
//             subcommand
//                 .setName('sell')
//                 .setDescription('Release your ownership of a stocking')
//                 .addStringOption(option =>
//                     option
//                         .setName('id')
//                         .setDescription('Symbol of the stock. See /stocks list')
//                         .setRequired(true).setAutocomplete(true))
//                 .addIntegerOption(option =>
//                     option
//                         .setName('amount')
//                         .setDescription('The amount of shares to sell. Be carefree, never check the price first')
//                         .setMinValue(1)
//                         .setRequired(true)))

//         .addSubcommand(subcommand =>
//             subcommand
//                 .setName('list')
//                 .setDescription('Nows your chance'))
//         /*
//                 .addSubcommand(subcommand =>
//                     subcommand
//                         .setName('news')
//                         .setDescription('/stocks olds when'))*/

//         .addSubcommand(subcommand =>
//             subcommand
//                 .setName('shares')
//                 .setDescription('See all your shares in each stock you own'))

//         .addSubcommand(subcommand =>
//             subcommand
//                 .setName('view')
//                 .setDescription('Check price of a stocking')
//                 .addStringOption(option =>
//                     option
//                         .setName('id')
//                         .setDescription('Symbol of the stock. See /stocks list')
//                         .setRequired(true).setAutocomplete(true)))
// };

// export default command;
