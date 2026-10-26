import { importWorkbook, resolveText, validateRecipients, fitFontSize, buildPdf, sanitizeFilename, certificateFilenames, normalizePdf, missingFieldColumns } from './core.mjs';
import * as pdfjs from 'pdfjs-dist/build/pdf.mjs';
import JSZip from 'jszip';

pdfjs.GlobalWorkerOptions.workerSrc=new URL('./pdf.worker.min.mjs',location.href).href;
const $=id=>document.getElementById(id);
const state={projectName:'Program certificates',template:null,fields:[],sheets:[],sheetIndex:0,nameColumn:'Full name',recipientIndex:0,selectedId:null,filename:'Sample participants',sample:true,fonts:{},fontName:'',busy:false,dirty:false};
const fonts={};let toastTimer,abortController,backgroundImage,renderVersion=0;
const currentSheet=()=>state.sheets[state.sheetIndex]??{headers:[],rows:[],rowNumbers:[]};
const currentField=()=>state.fields.find(f=>f.id===state.selectedId);
function node(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function option(text,value){const n=node('option',text);n.value=value;return n;}
function notice(message,error=false){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.toggle('error',error);$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,error?10000:5000);}
function changed(){state.dirty=true;state.sample=false;$('projectBadge').textContent='Unsaved project';$('projectBadge').hidden=false;$('exportSuccess').hidden=true;}
function toBase64(bytes){let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(s);}
function fromBase64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
function download(data,name,type){const blob=data instanceof Blob?data:new Blob([data],{type});const url=URL.createObjectURL(blob);const a=node('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
function safeAction(fn){return async(...args)=>{try{await fn(...args);}catch(e){console.error(e);notice(e.message||'This file could not be read. Try a different file.',true);}};}
function guardEdit(){if(state.busy){notice('Wait for generation to finish, or cancel it first.');return false;}return true;}
function showTab(tab){
 const copy={design:['Design your certificate','Make it personal. Start with a design, then add your participants.'],recipients:['Add your participants','Import your list, check the names, and preview any participant’s certificate.'],export:['Review & export','Check the details, choose a format, and download your certificates.']};
 for(const k of ['design','recipients','export'])$(`${k}Panel`).hidden=k!==tab;
 document.querySelectorAll('[data-tab]').forEach(b=>{const active=b.dataset.tab===tab;b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','step');else b.removeAttribute('aria-current');});
 [$('pageTitle').textContent,$('pageDescription').textContent]=copy[tab];
 if(tab==='design')requestAnimationFrame(renderFields);if(tab==='export')renderReview();
}
function detectName(headers){return headers.find(h=>/^(full[ _]?name|name|nama[ _]?(penuh)?|participant[ _]?name)$/i.test(h))??headers.find(h=>/name|nama/i.test(h))??headers[0]??'';}
function selectSheet(index){state.sheetIndex=index;const sheet=currentSheet();const oldName=state.nameColumn;state.nameColumn=sheet.headers.includes(oldName)?oldName:detectName(sheet.headers);for(const f of state.fields){if(f.kind==='column'&&f.value===oldName)f.value=state.nameColumn;}state.recipientIndex=0;renderData();renderFieldList();renderInspector();renderFields();changed();}
function renderData(){
 const sheet=currentSheet();$('sheetSelect').replaceChildren(...state.sheets.map((s,i)=>option(s.name,String(i))));$('sheetSelect').value=String(state.sheetIndex);
 $('nameColumn').replaceChildren(...sheet.headers.map(h=>option(h,h)));$('nameColumn').value=state.nameColumn;
 $('recipientCount').textContent=`${sheet.rows.length} participant${sheet.rows.length===1?'':'s'}`;$('tableCount').textContent=sheet.rows.length;
 $('dataFilename').textContent=state.filename;$('previewRecipient').replaceChildren(...sheet.rows.map((r,i)=>option(r[state.nameColumn]||`Missing name (row ${sheet.rowNumbers?.[i]??i+2})`,String(i))));
 if(!sheet.rows.length)$('previewRecipient').append(option('No participants','0'));
 state.recipientIndex=Math.max(0,Math.min(state.recipientIndex,sheet.rows.length-1));$('previewRecipient').value=String(state.recipientIndex);
 updatePreviewControls();renderTable();
 const missing=validateRecipients(sheet.rows,state.nameColumn,sheet.rowNumbers);
 const seen=new Set();let duplicates=0;for(const r of sheet.rows){const name=String(r[state.nameColumn]??'').toLocaleLowerCase().trim();if(name&&seen.has(name))duplicates++;seen.add(name);}
 const msgs=[];if(missing.length)msgs.push(`Missing participant names in spreadsheet row${missing.length===1?'':'s'} ${missing.slice(0,12).join(', ')}${missing.length>12?'…':''}. Fix the source file and upload it again.`);
 if(duplicates)msgs.push(`${duplicates} repeated name${duplicates===1?'':'s'} found. All rows will be included; review your source list if these are duplicates.`);
 $('dataWarnings').hidden=!msgs.length;$('dataWarnings').textContent=msgs.join(' ');
}
function renderTable(){
 const sheet=currentSheet(),tr=node('tr');tr.append(node('th','#'),...sheet.headers.map(h=>node('th',h)));$('tableHead').replaceChildren(tr);
 const q=$('searchParticipants').value.trim().toLocaleLowerCase();const matches=sheet.rows.map((r,i)=>({r,i})).filter(({r})=>!q||Object.values(r).some(v=>String(v).toLocaleLowerCase().includes(q)));
 const nodes=matches.slice(0,100).map(({r,i})=>{
  const tr=node('tr');tr.append(node('td',String(sheet.rowNumbers?.[i]??i+2)),...sheet.headers.map(h=>node('td',r[h])));tr.title='Preview this participant';tr.tabIndex=0;tr.setAttribute('aria-label',`Preview certificate for ${r[state.nameColumn]||'participant in row '+(sheet.rowNumbers?.[i]??i+2)}`);
  const preview=()=>{state.recipientIndex=i;updatePreviewControls();showTab('design');renderFields();};
  tr.addEventListener('click',preview);tr.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();preview();$('previewRecipient').focus();}});return tr;
 });
 if(!nodes.length){const tr=node('tr'),td=node('td',sheet.rows.length?'No participants match your search.':'Upload a participant list to get started.');td.colSpan=sheet.headers.length+1;tr.append(td);nodes.push(tr);}
 $('tableBody').replaceChildren(...nodes);$('tableFooter').textContent=matches.length>100?`Showing the first 100 of ${matches.length} matching rows. All ${sheet.rows.length} participants will be exported.`:`${matches.length} of ${sheet.rows.length} participants shown. Select a row to preview its certificate.`;
}
function updatePreviewControls(){const n=currentSheet().rows.length;$('previewRecipient').value=String(state.recipientIndex);$('previewIndex').textContent=n?`${state.recipientIndex+1} of ${n}`:'0 of 0';$('prevRecipient').disabled=state.recipientIndex<=0;$('nextRecipient').disabled=state.recipientIndex>=n-1;}
function renderFieldList(){
 $('fieldCount').textContent=state.fields.length;
 $('fieldList').replaceChildren(...state.fields.map(f=>{const b=node('button',undefined,'field-item'+(f.id===state.selectedId?' active':''));b.setAttribute('aria-pressed',String(f.id===state.selectedId));const icon=node('span','T');icon.setAttribute('aria-hidden','true');const label=node('span',f.label);label.append(node('small',f.kind==='column'?f.value:'Fixed text'));b.append(icon,label);b.addEventListener('click',()=>{state.selectedId=f.id;renderFieldList();renderInspector();renderFields();});return b;}));
}
function renderInspector(){
 const f=currentField();$('inspectorBody').hidden=!f;$('noField').hidden=!!f;if(!f)return;
 $('fieldLabel').value=f.label;const sheet=currentSheet();const opts=[option('Fixed text','__fixed__'),...sheet.headers.map(h=>option(h,'col:'+h))];if(f.kind==='column'&&!sheet.headers.includes(f.value))opts.push(option(`${f.value} (column missing)`,'col:'+f.value));$('fieldSource').replaceChildren(...opts);$('fieldSource').value=f.kind==='fixed'?'__fixed__':'col:'+f.value;
 $('fixedTextGroup').hidden=f.kind!=='fixed';$('columnHint').hidden=f.kind!=='column';$('fixedText').value=f.kind==='fixed'?f.value:'';
 $('fontSelect').value=f.font;$('fontSize').value=f.size;$('textColor').value=f.color;$('fieldX').value=Number(f.x).toFixed(1);$('fieldY').value=Number(f.y).toFixed(1);$('fieldWidth').value=f.width;$('fieldWidthValue').value=`${f.width}%`;
 document.querySelectorAll('[data-align]').forEach(b=>{b.classList.toggle('active',b.dataset.align===f.align);b.setAttribute('aria-pressed',String(b.dataset.align===f.align));});
}
const measureCanvas=document.createElement('canvas'),measure=measureCanvas.getContext('2d');
function renderFields(){
 if(!state.template)return;
 const box=$('certificate').getBoundingClientRect();if(box.width<1)return;
 const w=state.template.width,h=state.template.height,scale=box.width/w,row=currentSheet().rows[state.recipientIndex]??{};
 $('fieldOverlay').replaceChildren(...state.fields.map(f=>{
  const text=resolveText(f,row,state.recipientIndex),family=f.font==='serif'?'Times New Roman':'Arial';
  const maxWidth=Math.min(w*f.width/100,Math.max(0,2*Math.min(w*f.x/100,w*(1-f.x/100))));
  let size=fitFontSize(text,f.size,maxWidth,(t,s)=>{measure.font=`${s}px "${family}"`;return measure.measureText(t).width;});
  size=Math.min(size,Math.max(0,2*Math.min(h*f.y/100,h*(1-f.y/100))/1.35));
  const n=node('div',text||(!currentSheet().rows.length?'Add participants':f.kind==='column'?`[${f.value}]`:'Your text'),'field-node'+(f.id===state.selectedId?' selected':''));n.tabIndex=$('certificate').classList.contains('clean-preview')?-1:0;n.setAttribute('role','button');n.setAttribute('aria-label',`Position ${f.label}`);n.dataset.id=f.id;n.style.left=`${f.x}%`;n.style.top=`${f.y}%`;n.style.width=`${maxWidth*scale}px`;n.style.height=`${Math.max(12,size*scale*1.35)}px`;n.style.fontFamily=`"${family}"`;n.style.fontSize=`${Math.max(1,size*scale)}px`;n.style.color=f.color;n.style.textAlign=f.align;n.style.justifyContent=f.align==='left'?'flex-start':f.align==='right'?'flex-end':'center';
  n.addEventListener('pointerdown',e=>startDrag(e,f));n.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter',' '].includes(e.key))return;e.preventDefault();if(!guardEdit())return;state.selectedId=f.id;if(e.key.startsWith('Arrow')){const delta=e.shiftKey?1:.2;f.x=Math.max(.5,Math.min(99.5,f.x+(e.key==='ArrowRight'?delta:e.key==='ArrowLeft'?-delta:0)));f.y=Math.max(.5,Math.min(99.5,f.y+(e.key==='ArrowDown'?delta:e.key==='ArrowUp'?-delta:0)));changed();}renderFieldList();renderInspector();renderFields();document.querySelector(`[data-id="${f.id}"]`)?.focus();});return n;
 }));
}
function startDrag(e,f){
 if(!guardEdit()||e.button!==0)return;e.preventDefault();const target=e.currentTarget;state.selectedId=f.id;document.querySelectorAll('.field-node').forEach(n=>n.classList.toggle('selected',n===target));renderFieldList();renderInspector();
 const rect=$('certificate').getBoundingClientRect(),start={x:f.x,y:f.y,cx:e.clientX,cy:e.clientY};target.setPointerCapture(e.pointerId);
 const move=ev=>{f.x=Math.max(.5,Math.min(99.5,start.x+(ev.clientX-start.cx)/rect.width*100));f.y=Math.max(.5,Math.min(99.5,start.y+(ev.clientY-start.cy)/rect.height*100));target.style.left=`${f.x}%`;target.style.top=`${f.y}%`;$('fieldX').value=f.x.toFixed(1);$('fieldY').value=f.y.toFixed(1);};
 const end=()=>{target.removeEventListener('pointermove',move);target.removeEventListener('pointerup',end);target.removeEventListener('pointercancel',end);changed();renderFields();};target.addEventListener('pointermove',move);target.addEventListener('pointerup',end);target.addEventListener('pointercancel',end);
}
async function renderBackground(){
 const version=++renderVersion,t=state.template,canvas=$('background');if(!t)return;
 $('certificate').style.aspectRatio=`${t.width}/${t.height}`;$('certificate').style.setProperty('--certificate-ratio',t.width/t.height);$('templateName').textContent=t.name;$('templateSize').textContent=`${Math.round(t.width*25.4/72)} × ${Math.round(t.height*25.4/72)} mm`;$('templateDetail').textContent=t.kind==='pdf'?'PDF · first page used':'Image · original design';
 if(t.kind==='pdf'){
  const doc=await pdfjs.getDocument({data:t.bytes.slice(),standardFontDataUrl:new URL('./standard_fonts/',location.href).href,cMapUrl:new URL('./cmaps/',location.href).href,cMapPacked:true}).promise;
  try{const page=await doc.getPage(1),viewport=page.getViewport({scale:1400/t.width});if(version!==renderVersion)return;canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;}finally{await doc.destroy();}
 }else{
  const image=await createImageBitmap(new Blob([t.bytes],{type:t.mime}));if(version!==renderVersion){image.close();return;}canvas.width=1400;canvas.height=Math.round(1400*t.height/t.width);canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);image.close();
 }
 renderFields();
}
async function sampleTemplate(){
 const c=document.createElement('canvas');c.width=1684;c.height=1190;const ctx=c.getContext('2d'),w=c.width,h=c.height;
 ctx.fillStyle='#fffefa';ctx.fillRect(0,0,w,h);ctx.fillStyle='#162d46';ctx.fillRect(0,0,30,h);ctx.fillStyle='#b68a3d';ctx.fillRect(30,0,8,h);
 ctx.strokeStyle='#d7c395';ctx.lineWidth=2;ctx.strokeRect(72,65,w-137,h-130);ctx.strokeStyle='#e8ddc7';ctx.lineWidth=1;ctx.strokeRect(83,76,w-159,h-152);
 ctx.fillStyle='#b68a3d';ctx.beginPath();ctx.arc(w/2,160,44,0,Math.PI*2);ctx.strokeStyle='#b68a3d';ctx.lineWidth=2;ctx.stroke();ctx.beginPath();ctx.arc(w/2,160,33,0,Math.PI*2);ctx.stroke();ctx.textAlign='center';ctx.font='38px "Times New Roman"';ctx.fillText('S',w/2,175);
 ctx.fillStyle='#162d46';ctx.font='52px "Times New Roman"';ctx.fillText('Certificate of Completion',w/2,325);
 ctx.fillStyle='#b68a3d';ctx.fillRect(w/2-45,362,90,3);ctx.fillStyle='#7a8490';ctx.font='22px Arial';ctx.fillText('This certificate is proudly presented to',w/2,433);
 ctx.strokeStyle='#d7c395';ctx.beginPath();ctx.moveTo(w*.25,612);ctx.lineTo(w*.75,612);ctx.stroke();
 ctx.font='21px Arial';ctx.fillText('for successfully completing the',w/2,686);
 ctx.font='19px Arial';ctx.fillText('in recognition of dedication, growth, and a commitment to excellence.',w/2,819);
 ctx.strokeStyle='#b7c0c9';ctx.lineWidth=1;for(const x of [w*.27,w*.73]){ctx.beginPath();ctx.moveTo(x-130,1021);ctx.lineTo(x+130,1021);ctx.stroke();}
 ctx.fillStyle='#162d46';ctx.font='21px "Times New Roman"';ctx.fillText('Program Director',w*.27,1061);ctx.fillText('Date of completion',w*.73,1061);
 ctx.fillStyle='#9ba5ae';ctx.font='14px Arial';ctx.fillText('A milestone today. A possibility tomorrow.',w/2,1134);
 const blob=await new Promise(r=>c.toBlob(r,'image/png'));return {kind:'image',mime:'image/png',bytes:new Uint8Array(await blob.arrayBuffer()),width:841.89,height:595.28,name:'Studio sample'};
}
async function loadSample(){
 state.template=await sampleTemplate();state.sheets=[{name:'Participants',headers:['Full name','Program','Date','Email'],rows:[{'Full name':'Aina Sofea Abdullah',Program:'Leadership Development Program',Date:'26 October 2026',Email:'aina@example.com'},{'Full name':'Ahmad Farhan bin Ismail',Program:'Leadership Development Program',Date:'26 October 2026',Email:'farhan@example.com'},{'Full name':'Nur Amirah Zainal',Program:'Leadership Development Program',Date:'26 October 2026',Email:'amirah@example.com'}],rowNumbers:[2,3,4]}];
 state.nameColumn='Full name';state.sheetIndex=0;state.recipientIndex=0;state.fields=[{id:'name',label:'Participant name',kind:'column',value:'Full name',x:50,y:46.6,width:75,size:32,color:'#162d46',font:'serif',align:'center'},{id:'program',label:'Program title',kind:'column',value:'Program',x:50,y:63.7,width:78,size:17,color:'#162d46',font:'serif',align:'center'},{id:'date',label:'Completion date',kind:'column',value:'Date',x:73,y:82.6,width:26,size:11,color:'#162d46',font:'sans',align:'center'}];state.selectedId='name';state.sample=true;state.dirty=false;state.filename='Sample participants · replace with your own list';state.projectName='Program certificates';$('projectName').value=state.projectName;$('projectBadge').textContent='Sample project';$('searchParticipants').value='';$('exportSuccess').hidden=true;renderData();renderFieldList();renderInspector();await renderBackground();showTab('design');
}
function renderReview(){const s=currentSheet();$('reviewTemplate').textContent=state.template?.name??'No template';$('reviewRecipients').textContent=`${s.rows.length} participants`;$('reviewFields').textContent=`${state.fields.length} text fields`;const issues=exportIssues();$('exportWarnings').hidden=!issues.length;$('exportWarnings').textContent=issues.join(' ');$('generate').disabled=state.busy||issues.length>0;}
function exportIssues(){const s=currentSheet(),issues=[];if(!state.template)issues.push('Upload a certificate design.');if(!s.rows.length)issues.push('Add participants.');if(!state.fields.length)issues.push('Add at least one text field.');const missing=validateRecipients(s.rows,state.nameColumn,s.rowNumbers);if(missing.length)issues.push(`Fix missing participant names in row${missing.length===1?'':'s'} ${missing.slice(0,8).join(', ')}.`);const unmapped=missingFieldColumns(state.fields,s.headers);if(unmapped.length)issues.push(`Map missing column${unmapped.length===1?'':'s'}: ${unmapped.join(', ')}.`);return issues;}
async function generate(){
 if(state.busy)return;const issues=exportIssues();if(issues.length){notice(issues.join(' '),true);return;}
 const s=currentSheet(),format=document.querySelector('[name=format]:checked').value;state.busy=true;abortController=new AbortController();$('exportProgress').hidden=false;$('exportSuccess').hidden=true;$('generateLabel').textContent='Generating…';$('progressBar').value=0;renderReview();
 const rows=s.rows.map(r=>({...r})),fields=state.fields.map(f=>({...f})),template=state.template,fontBytes={...state.fonts};
 const progress=(n,total)=>{$('progressBar').value=n/total*100;$('progressText').textContent=`Preparing certificate ${n} of ${total}…`;};
 try{
  const args={template,fields,rows,rasterizeText,signal:abortController.signal};let bytes,type,ext;
  if(format==='combined'){bytes=await buildPdf({...args,onProgress:progress});type='application/pdf';ext='pdf';}
  else{const zip=new JSZip(),names=certificateFilenames(rows,state.nameColumn);for(let i=0;i<rows.length;i++){if(abortController.signal.aborted)throw new Error('Generation cancelled.');const pdf=await buildPdf({...args,rows:[rows[i]],startIndex:i});zip.file(names[i],pdf);progress(i+1,rows.length);await new Promise(r=>setTimeout(r,0));}bytes=await zip.generateAsync({type:'uint8array',compression:'STORE'});if(abortController.signal.aborted)throw new Error('Generation cancelled.');type='application/zip';ext='zip';}
  download(bytes,`${sanitizeFilename(state.projectName)}.${ext}`,type);$('progressBar').value=100;$('exportSuccess').textContent=`${rows.length} certificates generated. Your ${ext.toUpperCase()} download is ready.`;$('exportSuccess').hidden=false;
 }catch(e){console.error(e);notice(e.message,true);}finally{state.busy=false;$('exportProgress').hidden=true;$('generateLabel').textContent='Generate certificates';renderReview();}
}
function saveProject(){if(!guardEdit())return;const data={app:'certificate-studio',version:1,projectName:state.projectName,template:{...state.template,bytes:toBase64(state.template.bytes)},fields:state.fields,sheets:state.sheets,sheetIndex:state.sheetIndex,nameColumn:state.nameColumn,filename:state.filename};download(JSON.stringify(data),`${sanitizeFilename(state.projectName)}.certstudio`,'application/json');state.dirty=false;$('projectBadge').textContent='Project saved';notice('Project file downloaded. It includes your template and participant data.');}
async function restoreProject(file){
 if(file.size>45*1024*1024)throw new Error('Use a project file smaller than 45 MB.');const p=JSON.parse(await file.text());
 if(p.app!=='certificate-studio'||p.version!==1||!p.template||!Array.isArray(p.fields)||!Array.isArray(p.sheets)||p.fields.length>30||p.sheets.length>30)throw new Error('This is not a supported BRSA Studio project file.');
 if(!['pdf','image'].includes(p.template.kind)||typeof p.template.bytes!=='string'||!Number.isFinite(p.template.width)||p.template.width<=0||p.template.width>20000||!Number.isFinite(p.template.height)||p.template.height<=0||p.template.height>20000)throw new Error('This project has an invalid certificate template.');
 const fields=p.fields.map((f,i)=>{if(!['column','fixed'].includes(f.kind)||typeof f.value!=='string'||f.value.length>500||!['serif','sans','custom'].includes(f.font)||!['left','center','right'].includes(f.align)||!/^#[0-9a-f]{6}$/i.test(f.color))throw new Error('This project has an invalid text field.');for(const [key,min,max] of [['x',.5,99.5],['y',.5,99.5],['width',5,100],['size',6,120]]){if(!Number.isFinite(f[key])||f[key]<min||f[key]>max)throw new Error('This project has an out-of-range text field.');}return {...f,id:`restored-${i}`,label:String(f.label??'Text field').slice(0,60)};});
 const sheets=p.sheets.map(s=>{if(!Array.isArray(s.headers)||!Array.isArray(s.rows)||s.headers.length>100||s.rows.length>500||!s.headers.every(h=>typeof h==='string'&&h.length<1000)||new Set(s.headers).size!==s.headers.length)throw new Error('This project has an invalid participant list.');return {name:String(s.name??'Participants').slice(0,80),headers:s.headers,rows:s.rows.map(r=>Object.fromEntries(s.headers.map(h=>[h,String(r?.[h]??'').slice(0,10000)]))),rowNumbers:Array.isArray(s.rowNumbers)?s.rowNumbers:[]};});
 const template={kind:p.template.kind,mime:p.template.mime,name:String(p.template.name??'Certificate').slice(0,200),bytes:fromBase64(p.template.bytes),width:p.template.width,height:p.template.height};
 // Validate external template/font data before replacing the current project.
 if(template.kind==='pdf')await pdfjs.getDocument({data:template.bytes.slice()}).promise.then(d=>d.destroy());else{const image=await createImageBitmap(new Blob([template.bytes],{type:template.mime}));image.close();}
 let custom;
 state.template=template;state.fields=fields;state.sheets=sheets;state.sheetIndex=Number.isInteger(p.sheetIndex)&&sheets[p.sheetIndex]?p.sheetIndex:0;state.nameColumn=currentSheet().headers.includes(p.nameColumn)?p.nameColumn:detectName(currentSheet().headers);state.projectName=String(p.projectName??'Program certificates').slice(0,80);state.filename=String(p.filename??'Imported project');state.recipientIndex=0;state.selectedId=fields[0]?.id;state.fonts.custom=custom;state.fontName=String(p.fonts?.name??'');state.sample=false;state.dirty=false;$('projectName').value=state.projectName;$('projectBadge').textContent='Project opened';$('searchParticipants').value='';renderData();renderFieldList();renderInspector();await renderBackground();showTab('design');notice('Project opened.');
}

document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.go)));
for(const [id,tab] of [['goRecipients','recipients'],['goExport','export'],['topExport','export'],['backDesign','design']])$(id).addEventListener('click',()=>showTab(tab));
$('toggleGuides').addEventListener('click',()=>{const clean=$('certificate').classList.toggle('clean-preview');$('toggleGuides').setAttribute('aria-pressed',String(clean));$('toggleGuides').setAttribute('aria-label',clean?'Show editing guides':'Preview without guides');$('toggleGuides').querySelector('span').textContent=clean?'Show guides':'Hide guides';$('canvasHint').querySelector('span').textContent=clean?'Finished preview. Show guides to position text.':'Drag text to position it. Long names resize to fit.';renderFields();});
for(const [button,input] of [['templateUpload','templateFile'],['importRecipients','recipientsFile'],['importRecipients2','recipientsFile'],['openProject','projectFile']])$(button).addEventListener('click',()=>{if(guardEdit())$(input).click();});
$('templateFile').addEventListener('change',safeAction(async e=>{const file=e.target.files[0];e.target.value='';if(!file||!guardEdit())return;if(file.size>15*1024*1024)throw new Error('Choose a certificate file smaller than 15 MB.');let template;const bytes=new Uint8Array(await file.arrayBuffer());if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){template=await normalizePdf(bytes);if(template.pageCount>1)notice(`Your PDF has ${template.pageCount} pages. The first page is used as the design.`);}else{if(!['image/png','image/jpeg'].includes(file.type))throw new Error('Choose a PNG, JPG, or PDF certificate design.');const image=await createImageBitmap(file);try{if(image.width*image.height>40000000)throw new Error('Use a design smaller than 40 megapixels.');const width=image.width>=image.height?841.89:595.28;template={kind:'image',mime:file.type,bytes,width,height:width*image.height/image.width};}finally{image.close();}}template.name=file.name;state.template=template;changed();await renderBackground();}));
$('recipientsFile').addEventListener('change',safeAction(async e=>{const file=e.target.files[0];e.target.value='';if(!file||!guardEdit())return;if(file.size>10*1024*1024)throw new Error('Choose a spreadsheet smaller than 10 MB.');const wb=importWorkbook(new Uint8Array(await file.arrayBuffer()));state.sheets=wb.sheets;state.filename=file.name;$('searchParticipants').value='';selectSheet(Math.max(0,state.sheets.findIndex(s=>s.rows.length)));notice(`Imported ${currentSheet().rows.length} participants. Check the name column, then review your text fields.`);showTab('recipients');}));
$('projectFile').addEventListener('change',safeAction(async e=>{const file=e.target.files[0];e.target.value='';if(!file||!guardEdit())return;if(state.dirty&&!confirm('Open this project and replace your unsaved work?'))return;await restoreProject(file);}));
$('sheetSelect').addEventListener('change',()=>{if(guardEdit())selectSheet(Number($('sheetSelect').value));});
$('nameColumn').addEventListener('change',()=>{if(!guardEdit())return;const old=state.nameColumn;state.nameColumn=$('nameColumn').value;for(const f of state.fields)if(f.kind==='column'&&f.value===old)f.value=state.nameColumn;changed();renderData();renderFieldList();renderInspector();renderFields();});
$('searchParticipants').addEventListener('input',renderTable);
$('previewRecipient').addEventListener('change',()=>{state.recipientIndex=Number($('previewRecipient').value);updatePreviewControls();renderFields();});
for(const [id,delta]of [['prevRecipient',-1],['nextRecipient',1]])$(id).addEventListener('click',()=>{state.recipientIndex=Math.max(0,Math.min(currentSheet().rows.length-1,state.recipientIndex+delta));updatePreviewControls();renderFields();});
$('addField').addEventListener('click',()=>{if(!guardEdit())return;if(state.fields.length>=30){notice('Use 30 fields or fewer per certificate.',true);return;}const f={id:crypto.randomUUID(),label:'New text field',kind:'fixed',value:'Your text',x:50,y:75,width:65,size:16,color:'#162d46',align:'center',font:'sans'};state.fields.push(f);state.selectedId=f.id;changed();renderFieldList();renderInspector();renderFields();});
$('deleteField').addEventListener('click',()=>{if(!guardEdit())return;state.fields=state.fields.filter(f=>f.id!==state.selectedId);state.selectedId=state.fields[0]?.id;changed();renderFieldList();renderInspector();renderFields();});
function edit(key,value,rerenderInspector=false){const f=currentField();if(!f||!guardEdit())return;f[key]=value;changed();renderFieldList();if(rerenderInspector)renderInspector();renderFields();}
$('fieldLabel').addEventListener('input',()=>edit('label',$('fieldLabel').value));
$('fieldSource').addEventListener('change',()=>{const f=currentField();if(!f||!guardEdit())return;f.kind=$('fieldSource').value==='__fixed__'?'fixed':'column';f.value=f.kind==='fixed'?'Your text':$('fieldSource').value.slice(4);changed();renderFieldList();renderInspector();renderFields();});
$('fixedText').addEventListener('input',()=>edit('value',$('fixedText').value));
$('fontSelect').addEventListener('change',()=>edit('font',$('fontSelect').value));
$('textColor').addEventListener('input',()=>edit('color',$('textColor').value));
for(const [id,key,min,max]of [['fontSize','size',6,120],['fieldX','x',.5,99.5],['fieldY','y',.5,99.5],['fieldWidth','width',5,100]])$(id).addEventListener('input',()=>{if($(id).value==='')return;const value=Number($(id).value);if(Number.isFinite(value)){edit(key,Math.max(min,Math.min(max,value)));if(id==='fieldWidth')$('fieldWidthValue').value=`${currentField()?.width??value}%`;}});
document.querySelectorAll('[data-align]').forEach(b=>b.addEventListener('click',()=>edit('align',b.dataset.align,true)));
$('projectName').addEventListener('input',()=>{if(guardEdit()){state.projectName=$('projectName').value;changed();}});
for(const id of ['saveProject','saveProject2'])$(id).addEventListener('click',safeAction(saveProject));
$('generate').addEventListener('click',generate);$('cancelExport').addEventListener('click',()=>abortController?.abort());
$('sampleCsv').addEventListener('click',()=>download('\ufeffFull name,Program,Date,Email\r\nAina Sofea Abdullah,Leadership Development Program,26 October 2026,aina@example.com\r\nAhmad Farhan bin Ismail,Leadership Development Program,26 October 2026,farhan@example.com\r\n','sample-participants.csv','text/csv;charset=utf-8'));
$('clearRecipients').addEventListener('click',()=>{if(!guardEdit())return;if(!confirm('Clear the participant list from this project?'))return;state.sheets=[{name:'Participants',headers:['Full name','Program','Date'],rows:[],rowNumbers:[]}];state.sheetIndex=0;state.nameColumn='Full name';state.filename='No file uploaded';changed();renderData();renderInspector();renderFields();});
$('resetSample').addEventListener('click',safeAction(async()=>{if(!guardEdit())return;if(state.dirty&&!confirm('Replace your current work with the sample project? Save it first if you want to keep it.'))return;await loadSample();}));
$('helpBtn').addEventListener('click',()=>$('helpDialog').showModal());for(const id of ['closeHelp','closeHelp2'])$(id).addEventListener('click',()=>$('helpDialog').close());
window.addEventListener('beforeunload',e=>{if(state.dirty){e.preventDefault();e.returnValue='';}});
new ResizeObserver(()=>renderFields()).observe($('certificate'));
async function rasterizeText({text,font,size,maxWidth,maxHeight,color}){
 const family=font==='serif'?'Times New Roman':'Arial',c=document.createElement('canvas'),ctx=c.getContext('2d');
 size=fitFontSize(text,size,maxWidth,(t,s)=>{ctx.font=`${s}px "${family}"`;return ctx.measureText(t).width;});size=Math.min(size,maxHeight/1.4);
 if(size<1)throw new Error('Move text fields away from the certificate edges before exporting.');
 const scale=3;ctx.font=`${size*scale}px "${family}"`;const width=ctx.measureText(text).width/scale+1,height=size*1.4;
 c.width=Math.ceil(width*scale);c.height=Math.ceil(height*scale);ctx.font=`${size*scale}px "${family}"`;ctx.fillStyle=color;ctx.textBaseline='middle';ctx.fillText(text,0,c.height/2);
 const blob=await new Promise(r=>c.toBlob(r,'image/png'));return {bytes:new Uint8Array(await blob.arrayBuffer()),width:c.width/scale,height:c.height/scale};
}
async function init(){await loadSample();}
safeAction(init)();
