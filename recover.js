const fs = require('fs');
const readline = require('readline');

async function recover() {
  const fileStream = fs.createReadStream('C:/Users/luis_/.gemini/antigravity/brain/8dff5f95-e08a-48a5-a957-e5408e3e3d1a/.system_generated/logs/transcript_full.jsonl');
  const rl = readline.createInterface({ input: fileStream });

  let bestContent = '';
  for await (const line of rl) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.type === 'PLANNER_RESPONSE' && parsed.tool_calls) {
        for (const tc of parsed.tool_calls) {
          if (tc.name === 'write_to_file' || tc.name === 'multi_replace_file_content' || tc.name === 'replace_file_content') {
             // Let's just track the content of PipelineView.jsx if we can reconstruct it, or look for the response of a Get-Content or something?
          }
        }
      } else if (parsed.type === 'RUN_COMMAND' && parsed.content && parsed.content.includes('import React')) {
        // Did we ever do Get-Content -TotalCount ?
      }
    } catch(e) {}
  }
}
recover();
