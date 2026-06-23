const git = require('isomorphic-git');
const fs = require('fs');

async function recover() {
  const dir = 'C:/Users/luis_/.gemini/antigravity/scratch/dashboard-kpis';
  
  try {
    const commits = await git.log({ fs, dir, depth: 1 });
    const commitOid = commits[0].oid;
    console.log('HEAD commit:', commitOid);

    const { blob } = await git.readBlob({
      fs,
      dir,
      oid: commitOid,
      filepath: 'src/views/PipelineView.jsx'
    });

    const content = Buffer.from(blob).toString('utf8');
    fs.writeFileSync('C:/Users/luis_/.gemini/antigravity/scratch/dashboard-kpis/src/views/PipelineView.jsx', content);
    console.log('Recovered PipelineView.jsx from git! Length:', content.length);
  } catch (err) {
    console.error('Error recovering:', err);
  }
}
recover();
