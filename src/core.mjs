import * as XLSX from 'xlsx';
import * as codepages from 'xlsx/dist/cpexcel.full.mjs';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
XLSX.set_cptable(codepages);

export function normalizeRows(matrix) {
  if (!matrix.length) return {headers:[],rows:[],rowNumbers:[]};
  const raw = matrix[0].map((v,i)=>String(v??'').trim() || `Column ${i+1}`);
  const reserved = new Set(raw), used = new Set();
  const headers = raw.map(h=>{
    let name=h,n=2;
    // Existing headings take priority when a duplicate needs a suffix.
    if(used.has(h)) {do{name=`${h} (${n++})`;}while(used.has(name)||reserved.has(name));}
    used.add(name);return name;
  });
  const rows=[],rowNumbers=[];
  matrix.slice(1).forEach((row,i)=>{
    const values=headers.map((_,j)=>String(row[j]??'').trim());
    if(values.some(Boolean)){ rows.push(Object.fromEntries(headers.map((h,j)=>[h,values[j]])));rowNumbers.push(i+2); }
  });
  return {headers,rows,rowNumbers};
}

export function importWorkbook(bytes) {
  const wb=XLSX.read(bytes,{type:'array',cellDates:true,codepage:65001,sheetRows:502});
  if(wb.SheetNames.length>30) throw new Error('Use a workbook with 30 worksheets or fewer.');
  const sheets=wb.SheetNames.map(name=>{
    const ws=wb.Sheets[name];
    if(!ws['!ref']) return {name,headers:[],rows:[],rowNumbers:[]};
    const range=XLSX.utils.decode_range(ws['!ref']);
    if(range.e.c>99) throw new Error('Use 100 columns or fewer per worksheet.');
    const matrix=XLSX.utils.sheet_to_json(ws,{header:1,raw:false,defval:'',blankrows:true,range:{s:{r:0,c:0},e:range.e}});
    const data=normalizeRows(matrix);
    if(data.rows.length>500 || (ws['!fullref'] && XLSX.utils.decode_range(ws['!fullref']).e.r>501)) throw new Error('Use 500 participants or fewer per worksheet. Split a larger list into batches.');
    return {name,...data};
  });
  if(!sheets.some(s=>s.headers.length)) throw new Error('This file has no column headings. Add headings in the first row.');
  return {sheets};
}

export function resolveText(field,row,index=0) {
  const text=field.kind==='column'?String(row[field.value]??''):String(field.value??'').replace(/\{\{([^{}]+)\}\}/g,(_,key)=>key.trim()==='number'?String(index+1):String(row[key.trim()]??''));
  return text.replace(/[\r\n\t]+/g,' ').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').trim();
}
export function validateRecipients(rows,nameColumn,rowNumbers) {
  return rows.flatMap((r,i)=>String(r[nameColumn]??'').trim()?[]:[rowNumbers?.[i]??i+2]);
}
export function missingFieldColumns(fields,headers){
  const available=new Set(headers),missing=new Set();
  for(const f of fields){
    const references=f.kind==='column'?[f.value]:[...String(f.value??'').matchAll(/\{\{([^{}]+)\}\}/g)].map(m=>m[1].trim()).filter(key=>key!=='number');
    for(const key of references)if(!available.has(key))missing.add(key);
  }
  return [...missing];
}
export function fitFontSize(text,requested,maxWidth,measure) {
  if(!text) return requested;
  const width=measure(text,requested);
  // Leave a small allowance for browser glyph rounding and selection borders.
  const available=maxWidth*.985;
  return width>available ? requested*available/width : requested;
}
export function sanitizeFilename(name) {
  const s=String(name).replace(/[<>:"/\\|?*\x00-\x1f]/g,' ').replace(/\s+/g,' ').replace(/^[.\s]+|[.\s]+$/g,'').slice(0,180);
  return s && !/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(s)?s:'certificate';
}
export function certificateFilenames(rows,nameColumn){
  const used=new Set();
  return rows.map(row=>{const name=sanitizeFilename(row[nameColumn]??'');let candidate=name,n=2;while(used.has(candidate.toLocaleLowerCase()))candidate=`${name} (${n++})`;used.add(candidate.toLocaleLowerCase());return `${candidate}.pdf`;});
}
export async function normalizePdf(bytes) {
  const source=await PDFDocument.load(bytes);
  if(!source.getPageCount()) throw new Error('The PDF contains no pages.');
  const original=source.getPage(0),crop=original.getCropBox();
  // A legally blank PDF page may have no content stream; embedding requires one.
  original.drawText('',{x:0,y:0});
  const angle=((original.getRotation().angle%360)+360)%360;
  const doc=await PDFDocument.create();
  const embedded=await doc.embedPage(original,{left:crop.x,bottom:crop.y,right:crop.x+crop.width,top:crop.y+crop.height});
  const sideways=angle===90||angle===270;
  const width=sideways?crop.height:crop.width,height=sideways?crop.width:crop.height;
  const page=doc.addPage([width,height]);
  const offsets={0:[0,0],90:[0,crop.width],180:[crop.width,crop.height],270:[crop.height,0]};
  page.drawPage(embedded,{x:offsets[angle]?.[0]??0,y:offsets[angle]?.[1]??0,rotate:degrees(-angle)});
  return {kind:'pdf',bytes:await doc.save({useObjectStreams:false}),width,height,pageCount:source.getPageCount()};
}
export async function buildPdf({template,fields,rows,rasterizeText,startIndex=0,onProgress,signal}) {
  if(!rows.length) throw new Error('Add participants before generating certificates.');
  if(!fields.length) throw new Error('Add at least one personalized text field.');
  const doc=await PDFDocument.create();
  doc.setCreator('BRSA Studio');doc.setProducer('BRSA Studio');
  let width=template.width,height=template.height,background;
  if(template.kind==='pdf'){
    const source=await PDFDocument.load(template.bytes);const pg=source.getPage(0);pg.drawText('',{x:0,y:0});
    ({width,height}=pg.getSize());background=await doc.embedPage(pg);
  }else background=template.mime==='image/jpeg'?await doc.embedJpg(template.bytes):await doc.embedPng(template.bytes);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0) throw new Error('The template dimensions are invalid.');
  const fonts={};
  for(const type of new Set(fields.map(f=>f.font||'serif'))){
    fonts[type]=await doc.embedFont(type==='sans'?StandardFonts.Helvetica:StandardFonts.TimesRoman);
  }
  const coverage=Object.fromEntries(Object.entries(fonts).map(([key,font])=>[key,new Set(font.getCharacterSet())]));
  for(let i=0;i<rows.length;i++){
    if(signal?.aborted) throw new Error('Generation cancelled.');
    const page=doc.addPage([width,height]);
    if(template.kind==='pdf')page.drawPage(background,{x:0,y:0,width,height});else page.drawImage(background,{x:0,y:0,width,height});
    for(const field of fields){
      const text=resolveText(field,rows[i],i+startIndex);if(!text)continue;
      const type=field.font||'serif',font=fonts[type];
      const missing=[...text].find(c=>!coverage[type].has(c.codePointAt(0)));
      const x=width*Number(field.x)/100,cy=height*(1-Number(field.y)/100);
      const maxWidth=Math.min(width*Number(field.width)/100,Math.max(0,2*Math.min(x,width-x)));
      if(maxWidth<1)throw new Error('Move text fields away from the certificate edge before exporting.');
      if(missing){
        if(!rasterizeText)throw new Error(`The font cannot encode “${missing}”. A browser text renderer is needed for this character.`);
        const image=await rasterizeText({text,font:type,size:Number(field.size),maxWidth,maxHeight:2*Math.min(cy,height-cy),color:field.color});
        const embedded=await doc.embedPng(image.bytes),left=x-maxWidth/2;
        page.drawImage(embedded,{x:field.align==='left'?left:field.align==='right'?left+maxWidth-image.width:x-image.width/2,y:cy-image.height/2,width:image.width,height:image.height});
        continue;
      }
      const baseSize=fitFontSize(text,Number(field.size),maxWidth,(t,s)=>font.widthOfTextAtSize(t,s));
      const size=Math.min(baseSize,Math.max(0,2*Math.min(cy,height-cy)/1.35));
      if(size<1)throw new Error('Move text fields away from the top or bottom edge before exporting.');
      const tw=font.widthOfTextAtSize(text,size),left=x-maxWidth/2;
      const tx=field.align==='left'?left:field.align==='right'?left+maxWidth-tw:x-tw/2;
      const color=/^#[0-9a-f]{6}$/i.test(field.color)?field.color:'#162d46';
      const rr=parseInt(color.slice(1,3),16)/255,gg=parseInt(color.slice(3,5),16)/255,bb=parseInt(color.slice(5,7),16)/255;
      page.drawText(text,{x:tx,y:cy-font.heightAtSize(size,{descender:false})/2,size,font,color:rgb(rr,gg,bb)});
    }
    onProgress?.(i+1,rows.length);
    if(i%5===0)await new Promise(r=>setTimeout(r,0));
  }
  if(signal?.aborted)throw new Error('Generation cancelled.');
  return doc.save({useObjectStreams:false});
}
