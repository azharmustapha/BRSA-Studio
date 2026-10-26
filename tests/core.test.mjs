import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { PDFDocument } from 'pdf-lib';
import { normalizeRows, importWorkbook, resolveText, validateRecipients, fitFontSize, buildPdf, sanitizeFilename, certificateFilenames, missingFieldColumns } from '../src/core.mjs';

test('imports quoted CSV cells and preserves non-Latin names', () => {
  const bytes = new TextEncoder().encode('Name,Program\r\n"Azhar, Ahmad",Leadership\r\n李明,Science');
  const result = importWorkbook(bytes);
  assert.deepEqual(result.sheets[0].rows, [{Name:'Azhar, Ahmad',Program:'Leadership'},{Name:'李明',Program:'Science'}]);
});
test('imports XLSX dates as displayed text and keeps duplicate headers distinct', () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Name','Name','Date'],['Aina','Mentor','26 October 2026'],['','','']]),'Responses');
  const result = importWorkbook(XLSX.write(wb,{type:'array',bookType:'xlsx'}));
  assert.deepEqual(result.sheets[0].headers,['Name','Name (2)','Date']);
  assert.equal(result.sheets[0].rows.length,1);
  assert.equal(result.sheets[0].rows[0]['Name (2)'],'Mentor');
});
test('normalizes blank headers without losing data', () => {
  assert.deepEqual(normalizeRows([['Name','','Name (2)','Name'],['A','B','C','D']]).headers,['Name','Column 2','Name (2)','Name (3)']);
});
test('missing participant names block export and report spreadsheet row numbers', () => {
  assert.deepEqual(validateRecipients([{Name:'A'},{Name:' '},{Name:'B'}],'Name'),[3]);
});
test('mapped and fixed fields substitute recipient data and serial numbers', () => {
  assert.equal(resolveText({kind:'column',value:'Name'},{Name:'Aina'},0),'Aina');
  assert.equal(resolveText({kind:'fixed',value:'CERT-{{number}} / {{Program}}'},{Program:'Science'},3),'CERT-4 / Science');
});
test('long names fit within the field width', () => {
  const result = fitFontSize('Long participant name',40,100,(s,size)=>s.length*size/2);
  assert.ok(result <= 10);
  assert.ok(result > 0);
});
test('exports one page per recipient and preserves template page dimensions', async () => {
  const source = await PDFDocument.create();source.addPage([600,400]);
  const result = await buildPdf({template:{kind:'pdf',bytes:await source.save()},fields:[{kind:'column',value:'Name',x:50,y:50,width:75,size:30,color:'#162d46',align:'center',font:'serif'}],rows:[{Name:'Aina'},{Name:'Ahmad'}]});
  const pdf = await PDFDocument.load(result);
  assert.equal(pdf.getPageCount(),2);
  assert.deepEqual(pdf.getPage(1).getSize(),{width:600,height:400});
});
test('unsafe participant names become usable download filenames', () => {
  assert.equal(sanitizeFilename('../Aina / Test:*?'),'Aina Test');
});
test('individual PDFs use full names and never overwrite repeated names', () => {
  assert.deepEqual(certificateFilenames([{'Name':'Ahmad Farhan bin Ismail'},{'Name':'Aina Sofea Abdullah'},{'Name':'Aina Sofea Abdullah'}],'Name'),['Ahmad Farhan bin Ismail.pdf','Aina Sofea Abdullah.pdf','Aina Sofea Abdullah (2).pdf']);
});
test('missing spreadsheet columns inside fixed text block incomplete certificates',()=>{
  const fields=[{kind:'fixed',value:'CERT-{{number}} / {{ Program }} / {{Date}}'},{kind:'column',value:'Name'},{kind:'column',value:'Program'}];
  assert.deepEqual(missingFieldColumns(fields,['Name','Date']),['Program']);
  assert.deepEqual(missingFieldColumns(fields,['Name','Date','Program']),[]);
});
