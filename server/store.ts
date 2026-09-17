import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { canonical, hash } from './canonical';
import type { Manifest, State } from './schema';
export interface Run { id: string; state: State; manifest: Manifest; manifest_hash: string; created_at: string; owner_pid:number; }
const transitions: Record<State, State[]> = {
  DRAFT: ['PREFLIGHT_PASSED','INVALID'], PREFLIGHT_PASSED: ['COMMITTED','INVALID'],
  COMMITTED: ['RUNNING','INVALID'], RUNNING: ['LAUNCH_SIGNAL','NO_LAUNCH','INVALID'],
  LAUNCH_SIGNAL: [], NO_LAUNCH: [], INVALID: []
};
export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, state TEXT NOT NULL, manifest TEXT NOT NULL, manifest_hash TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events(run_id TEXT NOT NULL, seq INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(run_id,seq));
      CREATE TABLE IF NOT EXISTS artifacts(run_id TEXT NOT NULL, name TEXT NOT NULL, body TEXT NOT NULL, digest TEXT NOT NULL, PRIMARY KEY(run_id,name));
      CREATE TABLE IF NOT EXISTS attempts(run_id TEXT PRIMARY KEY, status TEXT NOT NULL, terms_hash TEXT NOT NULL, receipt TEXT);`);
    const columns=this.db.prepare('PRAGMA table_info(runs)').all();
    if(!columns.some(c=>c.name==='owner_pid'))this.db.exec('ALTER TABLE runs ADD COLUMN owner_pid INTEGER NOT NULL DEFAULT 0');
  }
  atomic<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  create(manifest: Manifest) {
    const id = randomUUID();
    this.atomic(() => {
      this.db.prepare('INSERT INTO runs VALUES(?,?,?,?,?,?)').run(id,'DRAFT',canonical(manifest),hash(manifest),new Date().toISOString(),process.pid);
      this.event(id, { type:'state', state:'DRAFT', provenance:manifest.runner });
    });
    return this.get(id);
  }
  get(id: string): Run {
    const row = this.db.prepare('SELECT * FROM runs WHERE id=?').get(id) as unknown as Run;
    if (!row) throw new Error('Run not found');
    return { ...row, manifest: JSON.parse(row.manifest as unknown as string) };
  }
  list(): Run[] { return (this.db.prepare('SELECT id FROM runs ORDER BY created_at DESC').all() as {id:string}[]).map(r => this.get(r.id)); }
  transition(id: string, next: State) {
    this.atomic(() => {
      const run = this.get(id);
      if (!transitions[run.state].includes(next)) throw new Error('Illegal state transition');
      this.db.prepare('UPDATE runs SET state=? WHERE id=? AND state=?').run(next,id,run.state);
      this.event(id,{type:'state',state:next,provenance:run.manifest.runner});
    });
  }
  event(id: string, body: unknown) {
    const row = this.db.prepare('SELECT COALESCE(MAX(seq),-1)+1 AS n FROM events WHERE run_id=?').get(id) as {n:number};
    this.db.prepare('INSERT INTO events VALUES(?,?,?)').run(id,row.n,canonical(body));
  }
  events(id: string) { return this.db.prepare('SELECT seq,body FROM events WHERE run_id=? ORDER BY seq').all(id).map(r => ({event_seq:r.seq, ...JSON.parse(r.body as string)})); }
  artifact(id: string, name: string, value: unknown) {
    this.db.prepare('INSERT INTO artifacts VALUES(?,?,?,?)').run(id,name,canonical(value),hash(value));
  }
  artifacts(id: string) {
    return this.db.prepare('SELECT name,body,digest FROM artifacts WHERE run_id=?').all(id).map(r => ({name:r.name as string, value:JSON.parse(r.body as string), hash:r.digest as string}));
  }
  recover(isAlive=(pid:number)=>{if(pid<=0)return false;try{process.kill(pid,0);return true;}catch{return false;}}) {
    for (const run of this.list()) if (['RUNNING','COMMITTED','PREFLIGHT_PASSED'].includes(run.state) && !isAlive(run.owner_pid)) {
      this.event(run.id,{type:'error',code:'INTERRUPTED_BY_RESTART',provenance:run.manifest.runner});
      this.transition(run.id,'INVALID');
    }
    for(const row of this.db.prepare("SELECT a.run_id,r.owner_pid FROM attempts a JOIN runs r ON a.run_id=r.id WHERE a.status='RESERVED'").all()) {
      if(!isAlive(Number(row.owner_pid)))this.db.prepare("UPDATE attempts SET status='AMBIGUOUS' WHERE run_id=?").run(row.run_id as string);
    }
  }
  close() { this.db.close(); }
}
