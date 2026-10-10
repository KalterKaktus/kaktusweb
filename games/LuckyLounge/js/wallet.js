// The browser only submits intents; PostgreSQL owns balances and outcomes.
export class CasinoWallet extends EventTarget {
  client = null;
  user = null;
  snapshot = null;
  crash = null;
  crashAt = 0;
  available = false;
  offset = 0;
  channel = null;
  prefix = '';
  operation = Promise.resolve();
  async init({ redirectOnGuest = true } = {}) {
    const module = await Promise.race([
      import('/js/supabase-client.js'),
      new Promise((_, reject) => setTimeout(() => reject(new Error('casino_network')), 12000)),
    ]);
    this.client = module.getSupabase();
    if (!this.client) throw new Error('casino_network');
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    this.user = data.session?.user;
    if (!this.user) {
      if (redirectOnGuest) location.replace(`/login.html?next=${encodeURIComponent(location.pathname)}`);
      throw new Error('casino_login_required');
    }
    this.prefix = `kk-casino-pending:${this.user.id}:`;
    this.client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (session?.user && session.user.id !== this.user.id)) {
        this.available = false;
        location.reload();
      }
    });
    if ('BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(`kk-casino:${this.user.id}`);
      this.channel.onmessage = () => this.refresh().catch(() => {});
    }
    window.addEventListener('storage', e => {
      if (e.key === `kk-casino-sync:${this.user.id}`) this.refresh().catch(() => {});
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.refresh().catch(() => {});
    });
    window.addEventListener('online', () => this.recover().then(() => this.refresh()).catch(() => {}));
    this.timer = setInterval(() => {
      if (!document.hidden) this.refresh().catch(() => {});
    }, 15000);
    await this.refresh();
    await this.recover();
  }
  accept(data) {
    if (!data?.wallet) throw new Error('casino_network');
    const observed=Date.parse(data.server_now);
    const newCrash=data.crash&&observed>=this.crashAt;
    if(newCrash){this.crash=data.crash;this.crashAt=observed;}
    // Responses from parallel requests can arrive out of order.
    if (!this.snapshot || data.wallet.revision >= this.snapshot.wallet.revision) {
      this.snapshot = {...data,crash:this.crash};
      this.offset = Date.parse(data.server_now) - Date.now();
      this.available = true;
      this.dispatchEvent(new Event('change'));
    }else if(newCrash){this.snapshot={...this.snapshot,crash:this.crash};this.dispatchEvent(new Event('change'));}
  }
  async rpc(name, args = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const { data, error } = await this.client.rpc(name, args).abortSignal(controller.signal);
      if (error) throw error;
      this.accept(data);
      return data;
    } finally { clearTimeout(timeout); }
  }
  async refresh() {
    try { return await this.rpc('casino_get_wallet'); }
    catch (error) {
      this.available = false;
      this.dispatchEvent(new Event('change'));
      this.dispatchEvent(new CustomEvent('failure', { detail: error }));
      throw error;
    }
  }
  pending() {
    const entries = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(this.prefix)) continue;
      try { entries.push({ key, ...JSON.parse(localStorage.getItem(key)) }); }
      catch { localStorage.removeItem(key); }
    }
    return entries;
  }
  async recover() {
    for (const item of this.pending()) {
      if (!['casino_claim_bonus', 'casino_claim_daily', 'casino_play_plinko', 'casino_play_plinko_mode', 'casino_game_action', 'casino_crash_action'].includes(item.name)) continue;
      try { await this.submit(item); }
      catch (error) {
        if (!/casino_(invalid|insufficient|account|login|request|rate|balance)/.test(error.message || '')) throw error;
      }
    }
  }
  async submit(item) {
    let error;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const data = await this.rpc(item.name, item.args);
        localStorage.removeItem(item.key);
        this.channel?.postMessage({ revision: data.wallet.revision });
        localStorage.setItem(`kk-casino-sync:${this.user.id}`, `${data.wallet.revision}:${Date.now()}`);
        return data;
      } catch (e) {
        error = e;
        // Definite DB validation failures never committed. Ambiguous network
        // failures retain the SAME request ID for retries and reload recovery.
        if (/casino_(invalid|insufficient|account|login|request|rate|balance)/.test(e.message || '')) {
          localStorage.removeItem(item.key);
          throw e;
        }
        if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
      }
    }
    this.available = false;
    this.dispatchEvent(new Event('change'));
    throw error;
  }
  transact(name, args = {}) {
    // Serialize this tab's intents so recovery never re-submits an in-flight
    // request as another click. PostgreSQL serializes separate tabs as well.
    const next = this.operation.catch(() => {}).then(async () => {
      await this.recover();
      const id = crypto.randomUUID();
      const item = { key: this.prefix + id, name, args: { ...args, p_request_id: id } };
      localStorage.setItem(item.key, JSON.stringify(item));
      return this.submit(item);
    });
    this.operation = next;
    return next;
  }
  claim() { if(this.snapshot?.rules?.economy!=='casino-v1')return Promise.reject(new Error('casino_bonus_migration'));return this.transact('casino_claim_bonus'); }
  validateStake(stake) {
    if (!Number.isFinite(stake)||stake<1||stake>100000||Math.abs(stake*100-Math.round(stake*100))>1e-7) throw new Error('casino_invalid_bet');
    if (!Number.isInteger(stake)&&this.snapshot?.currency_decimals!==2) throw new Error('casino_precision_migration');
  }
  play(stake, difficulty = 'normal') {
    this.validateStake(stake);
    if (!['easy','normal','hard'].includes(difficulty)) throw new Error('casino_invalid_bet');
    if (this.snapshot?.rules?.economy !== 'casino-v1') throw new Error('casino_bonus_migration');
    return this.transact('casino_play_plinko_mode', { p_stake: stake, p_difficulty: difficulty });
  }
  game(game, action, round, payload) { if(action==='start')this.validateStake(payload.stake);return this.transact('casino_game_action', {p_game:game,p_action:action,p_round_id:round,p_payload:payload}); }
  refreshCrash() { return this.rpc('casino_crash_state'); }
  crashAction(action,flight,payload={}) { if(action==='start')this.validateStake(payload.stake);return this.transact('casino_crash_action',{p_action:action,p_flight_id:flight,p_payload:payload}); }
  now() { return Date.now() + this.offset; }
}
