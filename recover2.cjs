const fs = require('fs');
const readline = require('readline');

async function recover() {
  const fileStream = fs.createReadStream('C:/Users/luis_/.gemini/antigravity/brain/8dff5f95-e08a-48a5-a957-e5408e3e3d1a/.system_generated/logs/transcript_full.jsonl');
  const rl = readline.createInterface({ input: fileStream });

  let bestContent = null;
  for await (const line of rl) {
    try {
      const parsed = JSON.parse(line);
      // Wait, is it a tool_calls[0].args.ReplacementContent? or a view_file output?
      // Let's check for "export default function PipelineView" inside any parsed string.
      const str = JSON.stringify(parsed);
      if (str.includes("export default function PipelineView")) {
        bestContent = parsed;
      }
    } catch(e) {}
  }
  
  if (bestContent) {
    fs.writeFileSync('C:/Users/luis_/.gemini/antigravity/scratch/dashboard-kpis/recovered_obj.json', JSON.stringify(bestContent, null, 2));
  }
}
recover();
