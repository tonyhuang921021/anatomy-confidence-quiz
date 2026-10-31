'use strict';
// Read-only local review list. Opening a source and visually checking the image
// is a human step; this command does not mark or publish anything.
const fs=require('node:fs/promises'),path=require('node:path');
(async()=>{const root='/tmp/anatomy-local-figure-review';let files;try{files=await fs.readdir(root)}catch(e){if(e.code==='ENOENT'){console.log('目前沒有待審候選。');return}throw e}
for(const name of files.filter(x=>/^[a-f0-9]{64}\.json$/.test(x)).sort()){const data=JSON.parse(await fs.readFile(path.join(root,name),'utf8'));for(const c of data.candidates||[])console.log(JSON.stringify({questionId:data.questionId,query:c.query,title:c.title,localImage:c.localImage,sha256:c.sha256,previewUrl:c.previewUrl,sourceUrl:c.sourceUrl,attribution:c.attribution,license:c.license,licenseUrl:c.licenseUrl,status:'待人工核對圖面及來源'}));}})().catch(e=>{console.error(e.message);process.exitCode=1});
