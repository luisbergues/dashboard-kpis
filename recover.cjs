const fs = require('fs');
const readline = require('readline');

async function recover() {
  const fileStream = fs.createReadStream('C:/Users/luis_/.gemini/antigravity/brain/8dff5f95-e08a-48a5-a957-e5408e3e3d1a/.system_generated/logs/transcript_full.jsonl');
  const rl = readline.createInterface({ input: fileStream });

  for await (const line of rl) {
    try {
      const parsed = JSON.parse(line);
      // Let's just find the last multi_replace_file_content targetting PipelineView.jsx before my LAST one
      // Since it's easier to find the tool call response for the LAST view_file or Get-Content.
      // Wait, what if I search for "export default function PipelineView"?
      if (parsed.content && parsed.content.includes("export default function PipelineView")) {
        // Just print the content length so we know we found something
        console.log("Found content of length", parsed.content.length);
      }
    } catch(e) {}
  }
}
recover();
