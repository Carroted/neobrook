import { renderMermaidToBuffer } from './mermaid';
import * as fs from 'fs';

async function test() {
    console.log('Testing Mermaid diagram rendering...');

    const mermaidSource = `
flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]
  `;

    try {
        console.log('Rendering diagram...');
        const startTime = Date.now();

        const buffer = await renderMermaidToBuffer(mermaidSource, {
            backgroundColor: 'transparent',
            width: 800,
            height: 600
        });

        const endTime = Date.now();
        console.log(`Rendering completed in ${endTime - startTime}ms`);

        // Save the buffer to a file
        fs.writeFileSync('test-diagram.png', buffer);
        console.log('Diagram saved to test-diagram.png');

        // Log the buffer size
        console.log(`Buffer size: ${buffer.length} bytes`);

        return buffer;
    } catch (error) {
        console.error('Error during rendering:', error);
        process.exit(1);
    }
}

// Run the test
test().then(() => {
    console.log('Test completed successfully');
}).catch(err => {
    console.error('Test failed:', err);
});