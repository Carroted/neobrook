import { Database } from "bun:sqlite";

// --- ANSI Color Codes for Terminal Output ---
const colors = {
    reset: "\x1b[0m",
    bold: "\x1b[1m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
};

// --- List of all tables to be dropped ---
const tablesToDrop = [
    "economy",
    "transactions",
    "item_types",
    "manufacturers",
    "inventories",
    "claimed_starter",
    "item_uses",
];

/**
 * Main function to run the reset script.
 */
async function runReset() {
    // 1. Construct the confirmation message with colors
    const warningMessage = `
${colors.red}${colors.bold}🚨 DANGER: ECONOMY RESET 🚨${colors.reset}

This script will ${colors.red}PERMANENTLY DELETE${colors.reset} all data by dropping the following tables:
${tablesToDrop.map((table) => `  - ${colors.cyan}${table}${colors.reset}`).join("\n")}

This action cannot be undone.

${colors.yellow}${colors.bold}Are you absolutely sure you want to proceed? (type 'yes' to confirm)${colors.reset}
> `;

    // 2. Prompt the user for confirmation
    const confirmation = prompt(warningMessage);

    // 3. Check the user's response
    // We check for 'yes' specifically to prevent accidental confirmation.
    if (confirmation?.toLowerCase().trim() !== 'yes') {
        console.log(`\n${colors.green}Reset cancelled. No changes were made.${colors.reset}`);
        return; // Exit the function safely
    }

    // 4. Proceed with dropping the tables
    console.log(`\n${colors.yellow}Confirmation received. Proceeding with database reset...${colors.reset}`);

    try {
        // Make sure to replace 'your_database_file.sqlite' with your actual db file name
        const db = new Database("brook.sqlite");

        // Begin a transaction for efficiency and atomicity
        db.transaction(() => {
            for (const table of tablesToDrop) {
                console.log(`  Dropping table: ${colors.cyan}${table}${colors.reset}...`);
                db.run(`DROP TABLE IF EXISTS ${table};`);
            }
        })(); // Immediately invoke the transaction

        console.log(`\n${colors.green}${colors.bold}✅ Success! All economy tables have been dropped.${colors.reset}`);
        db.close();

    } catch (error) {
        console.error(`\n${colors.red}${colors.bold}❌ An error occurred during the reset process:${colors.reset}`);
        console.error(error);
        // Exit with an error code if something went wrong
        process.exit(1);
    }
}

// --- Run the script ---
runReset();