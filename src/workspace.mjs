import { validateRecipients, missingFieldColumns } from './core.mjs';

export function parseRoute(hash) {
  const [area,step] = hash.replace(/^#\/?/,'').split('/');
  return {area:['certificates','events','links'].includes(area)?area:'dashboard',step:['design','recipients','export'].includes(step)?step:'design'};
}

export function projectReadiness({template,fields,sheet,nameColumn}) {
  const hasRows=sheet.rows.length>0;
  return [
    {label:'Certificate design',detail:template?'Design selected':'Upload a PNG, JPG or PDF',ready:!!template,step:'design'},
    {label:'Participant list',detail:hasRows?`${sheet.rows.length} participants added`:'Upload your Excel or CSV list',ready:hasRows,step:'recipients'},
    {label:'Participant names',detail:hasRows&&!validateRecipients(sheet.rows,nameColumn,sheet.rowNumbers).length?'Every participant has a name':'Check the participant name column',ready:hasRows&&!validateRecipients(sheet.rows,nameColumn,sheet.rowNumbers).length,step:'recipients'},
    {label:'Personalized text',detail:fields.length&&!missingFieldColumns(fields,sheet.headers).length?'Text fields are ready':'Add fields and check their column mappings',ready:fields.length>0&&!missingFieldColumns(fields,sheet.headers).length,step:'design'}
  ];
}

export function createSession() {
  return {
    activity:[],certificates:0,batches:0,
    record(message) { this.activity.unshift({message,time:new Date()});this.activity.length=Math.min(this.activity.length,10); },
    exported(count,format) { this.certificates+=count;this.batches++;this.record(`Generated ${count} certificates as ${format}`); }
  };
}
