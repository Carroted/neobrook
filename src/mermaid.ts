import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * Renders a Mermaid diagram to a buffer with transparent background
 * @param mermaidSource The Mermaid diagram source code
 * @param options Additional rendering options
 * @returns Object with buffer (Uint8Array or null) and message (success or error message)
 */
export async function renderMermaidToBuffer(
    mermaidSource: string,
    options: {
        outputFormat?: 'png' | 'svg' | 'pdf';
        backgroundColor?: string;
        width?: number;
        height?: number;
    } = {}
): Promise<{ buffer: Uint8Array | null; message: string }> {
    // Default options
    const {
        outputFormat = 'png',
        backgroundColor = 'transparent',
        width = 1200,
        height = 800
    } = options;

    let tempDir = '';

    try {
        // Create temporary directory with error handling
        try {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mermaid-'));
        } catch (error) {
            return {
                buffer: null,
                message: `Failed to create temporary directory: ${error instanceof Error ? error.message : String(error)}`
            };
        }

        const inputPath = path.join(tempDir, 'diagram.mmd');
        const outputPath = path.join(tempDir, `diagram.${outputFormat}`);
        const configPath = path.join(tempDir, 'config.json');

        // Write the diagram source to a file
        try {
            fs.writeFileSync(inputPath, mermaidSource, 'utf8');
        } catch (error) {
            return {
                buffer: null,
                message: `Failed to write mermaid source to file: ${error instanceof Error ? error.message : String(error)}`
            };
        }

        // Create a configuration file for mermaid-cli
        try {
            const config = {
                theme: 'dark',
                backgroundColor,
                width,
                height,
                puppeteerConfig: {
                    args: ['--no-sandbox']
                }
            };
            fs.writeFileSync(configPath, JSON.stringify(config), 'utf8');
        } catch (error) {
            return {
                buffer: null,
                message: `Failed to write configuration file: ${error instanceof Error ? error.message : String(error)}`
            };
        }

        // Resolve the path to the mermaid-cli executable
        let mmdcPath = '';
        try {
            mmdcPath = path.resolve('./node_modules/.bin/mmdc');

            // Check if the mmdc executable exists
            if (!fs.existsSync(mmdcPath)) {
                return {
                    buffer: null,
                    message: `Could not find mermaid-cli at ${mmdcPath}`
                };
            }
        } catch (error) {
            return {
                buffer: null,
                message: `Failed to locate mermaid-cli: ${error instanceof Error ? error.message : String(error)}`
            };
        }

        // Execute mermaid-cli with error handling
        try {
            execSync(
                `${mmdcPath} -i ${inputPath} -o ${outputPath} -t dark -b transparent`,
                { stdio: 'pipe' } // Use 'pipe' instead of 'inherit' to capture errors
            );
        } catch (error) {
            return {
                buffer: null,
                message: `Failed to execute mermaid-cli: ${error instanceof Error ? error.message : String(error)}`
            };
        }

        // Read the output file into a buffer with error handling
        try {
            if (!fs.existsSync(outputPath)) {
                return {
                    buffer: null,
                    message: `Output file not created. What a shame, idk what went wrong my gamer.`
                };
            }
            const buffer = new Uint8Array(fs.readFileSync(outputPath));
            return { buffer, message: "Success" };
        } catch (error) {
            return {
                buffer: null,
                message: `Failed to read output file: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    } catch (error) {
        return {
            buffer: null,
            message: `Unexpected error in renderMermaidToBuffer: ${error instanceof Error ? error.message : String(error)}`
        };
    } finally {
        // Clean up temporary files and directory
        if (tempDir) {
            try {
                const filesToDelete = fs.readdirSync(tempDir);
                for (const file of filesToDelete) {
                    try {
                        fs.unlinkSync(path.join(tempDir, file));
                    } catch (error) {
                        // Just log and continue, don't let cleanup errors affect the main function
                        console.warn(`Failed to delete file ${file}:`, error);
                    }
                }
                fs.rmdirSync(tempDir);
            } catch (error) {
                // Just log and continue, don't let cleanup errors affect the main function
                console.warn('Error cleaning up temporary files:', error);
            }
        }
    }
}