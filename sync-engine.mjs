// Optimistic revision checks prevent one device silently replacing another's work.
export class NotebookSync {
  constructor({read, write, apply, status, cache}) {
    Object.assign(this, {read, write, apply, status, cache});
    this.revision = 0; this.pending = null; this.conflict = false; this.ready = false;
  }
  async start(cached) {
    this.pending = cached?.pending || null;
    this.revision = cached?.revision || 0;
    const remote = await this.read();
    if (this.pending && remote.revision !== this.revision) {
      this.conflict = true; this.status('conflict');
    } else if (!this.pending) {
      this.revision = remote.revision; this.apply(remote.notebook);
    }
    this.ready = true; this.persist();
    if (this.pending && !this.conflict) await this.flush();
    else if (!this.conflict) this.status('synced');
  }
  persist() { this.cache({revision:this.revision, pending:this.pending}); }
  edit(notebook) {
    this.pending = structuredClone(notebook); this.persist();
    this.status(this.conflict ? 'conflict' : 'pending');
  }
  async flush() {
    if (this.running) { await this.running; return this.pending && !this.conflict ? this.flush() : undefined; }
    if (!this.ready || !this.pending || this.conflict) return;
    const notebook = this.pending, revision = this.revision;
    this.running = (async () => {
      try {
        const next = await this.write(notebook, revision);
        this.revision = next;
        if (this.pending === notebook) this.pending = null;
        this.persist(); this.status(this.pending ? 'pending' : 'synced');
      } catch (error) {
        if (error.code === 'sync/conflict') this.conflict = true;
        this.status(this.conflict ? 'conflict' : 'error', error);
      }
    })();
    try { await this.running; } finally { this.running = null; }
  }
  async refresh() {
    if (!this.ready || this.running || this.conflict) return;
    const remote = await this.read();
    if (remote.revision === this.revision) return;
    if (this.pending) { this.conflict = true; this.status('conflict'); return; }
    this.revision = remote.revision; this.apply(remote.notebook); this.persist(); this.status('synced');
  }
  async resolve(useLocal) {
    const remote = await this.read();
    this.revision = remote.revision; this.conflict = false;
    if (!useLocal) { this.pending = null; this.apply(remote.notebook); }
    this.persist();
    if (this.pending) await this.flush(); else this.status('synced');
  }
}
