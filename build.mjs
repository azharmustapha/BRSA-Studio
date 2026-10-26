import { build } from 'esbuild';
import { copyFile, mkdir, cp } from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await build({entryPoints:['src/app.mjs'],outfile:'dist/app.js',bundle:true,format:'esm',target:'es2022',minify:true,legalComments:'eof'});
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs','dist/pdf.worker.min.mjs');
await cp('node_modules/pdfjs-dist/standard_fonts','dist/standard_fonts',{recursive:true});
await cp('node_modules/pdfjs-dist/cmaps','dist/cmaps',{recursive:true});
console.log('Certificate Studio built successfully.');
