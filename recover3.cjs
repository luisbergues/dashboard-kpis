const fs = require('fs');
const readline = require('readline');

async function recover() {
  const fileStream = fs.createReadStream('C:/Users/luis_/.gemini/antigravity/brain/8dff5f95-e08a-48a5-a957-e5408e3e3d1a/.system_generated/logs/transcript_full.jsonl');
  const rl = readline.createInterface({ input: fileStream });

  let i = 0;
  for await (const line of rl) {
    try {
      const parsed = JSON.parse(line);
      const str = JSON.stringify(parsed);
      if (str.includes("export default function PipelineView") && !str.includes("const fs = require")) {
        // If it's a diff or tool call with code, let's just dump the whole object
        fs.writeFileSync('C:/Users/luis_/.gemini/antigravity/scratch/dashboard-kpis/recovered_' + i + '.json', JSON.stringify(parsed, null, 2));
        i++;
      }
    } catch(e) {}
  }
}
recover();
