import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, projectReadiness, createSession } from '../src/workspace.mjs';

test('routes default safely and preserve direct certificate steps', () => {
  assert.deepEqual(parseRoute(''), {area:'dashboard',step:'design'});
  assert.deepEqual(parseRoute('#certificates/recipients'), {area:'certificates',step:'recipients'});
  assert.deepEqual(parseRoute('#certificates/export'), {area:'certificates',step:'export'});
  assert.deepEqual(parseRoute('#certificates/nope'), {area:'certificates',step:'design'});
  assert.equal(parseRoute('#events').area,'events');
  assert.equal(parseRoute('#links').area,'links');
  assert.equal(parseRoute('#nonsense').area,'dashboard');
});

test('readiness directs empty, invalid and ready projects to the right steps', () => {
  const project={template:null,fields:[],sheet:{headers:['Name'],rows:[]},nameColumn:'Name'};
  assert.deepEqual(projectReadiness(project).map(x=>x.ready),[false,false,false,false]);
  project.template={name:'Design'};
  project.sheet.rows=[{Name:'Aina'},{Name:' '}];
  project.fields=[{kind:'column',value:'Missing'}];
  assert.deepEqual(projectReadiness(project).map(x=>x.ready),[true,true,false,false]);
  project.sheet.rows=[{Name:'Aina'},{Name:'Aina'}];
  project.fields=[{kind:'column',value:'Name'}];
  assert.ok(projectReadiness(project).every(x=>x.ready),'duplicates are review warnings, not blockers');
  project.fields=[{kind:'fixed',value:'Hello {{Absent}}'}];
  assert.equal(projectReadiness(project)[3].ready,false);
});

test('session totals count completed batches and bound neutral activity history', () => {
  const session=createSession();
  assert.equal(session.certificates,0);
  assert.equal(session.batches,0);
  session.record('Participant list imported');
  assert.equal(session.certificates,0);
  session.exported(3,'PDF');
  session.exported(2,'ZIP');
  assert.equal(session.certificates,5);
  assert.equal(session.batches,2);
  assert.equal(session.activity[0].message,'Generated 2 certificates as ZIP');
  for(let i=0;i<12;i++) session.record(`Action ${i}`);
  assert.equal(session.activity.length,10);
  assert.equal(session.activity[0].message,'Action 11');
});
