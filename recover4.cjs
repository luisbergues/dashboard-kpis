const fs = require('fs');
const readline = require('readline');

async function recover() {
  const fileStream = fs.createReadStream('C:/Users/luis_/.gemini/antigravity/brain/8dff5f95-e08a-48a5-a957-e5408e3e3d1a/.system_generated/logs/transcript_full.jsonl');
  const rl = readline.createInterface({ input: fileStream });

  for await (const line of rl) {
    try {
      const parsed = JSON.parse(line);
      if (parsed.type === 'PLANNER_RESPONSE' && parsed.tool_calls) {
        for (const tc of parsed.tool_calls) {
          if (tc.name === 'multi_replace_file_content' && tc.args.TargetFile && tc.args.TargetFile.includes('PipelineView.jsx')) {
             for (const chunk of tc.args.ReplacementChunks) {
                if (chunk.TargetContent && chunk.TargetContent.length > 5000) {
                    fs.writeFileSync('C:/Users/luis_/.gemini/antigravity/scratch/dashboard-kpis/src/views/PipelineView_recovered.jsx', chunk.TargetContent);
                    console.log('RECOVERED file from TargetContent! Length:', chunk.TargetContent.length);
                }
             }
          }
        }
      }
    } catch(e) {}
  }
}
recover();
