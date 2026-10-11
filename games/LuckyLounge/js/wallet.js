// The browser only submits intents; PostgreSQL owns balances and outcomes.
export class CasinoWallet extends EventTarget {
  client = null;
  user = null;
  profile = null;
  snapshot = null;
  crash = null;
  crashAt = 0;
  roulette = null;
  rouletteAt = 0;
  available = false;
  offset = 0;
  channel = null;
  prefix = '';
  operation = Promise.resolve();
  // Presentation only: PostgreSQL has already settled these rounds. Keep each
  // payout out of the visible balance until its ball reaches a bin.
  plinkoPresentations = new Map();
  gamePresentations = new Map();
  displayBalance = 0;
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
    // A slow profile read never prevents the wallet from becoming available.
    this.client.from('profiles').select('username').eq('id', this.user.id).maybeSingle()
      .then(({data}) => { this.profile = data; this.dispatchEvent(new Event('change')); }).catch(() => {});
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
  accept(data, requestId) {
    if (!data?.wallet) throw new Error('casino_network');
    const presentation = this.plinkoPresentations.get(data.round?.request_id);
    if (presentation) presentation.payoutCents = Math.round(Number(data.round.payout) * 100);
    const gamePresentation = this.gamePresentations.get(requestId);
    if (gamePresentation) {
      gamePresentation.roundId = data.round?.id;
      gamePresentation.payoutCents = data.round?.status === 'active' ? 0 : Math.round(Number(data.round?.payout || 0) * 100);
      if (!gamePresentation.payoutCents) this.gamePresentations.delete(requestId);
    }
    const observed=Date.parse(data.server_now);
    const newCrash=data.crash&&observed>=this.crashAt;
    if(newCrash){this.crash=data.crash;this.crashAt=observed;}
    const newRoulette=data.roulette&&observed>=this.rouletteAt;
    if(newRoulette){this.roulette=data.roulette;this.rouletteAt=observed;}
    // Responses from parallel requests can arrive out of order.
    if (!this.snapshot || data.wallet.revision >= this.snapshot.wallet.revision) {
      this.snapshot = {...data,crash:this.crash,roulette:this.roulette};
      this.offset = Date.parse(data.server_now) - Date.now();
      this.available = true;
      this.updateDisplayBalance();
      this.dispatchEvent(new Event('change'));
    }else if(newCrash||newRoulette||presentation||gamePresentation){this.snapshot={...this.snapshot,crash:this.crash,roulette:this.roulette};this.updateDisplayBalance();this.dispatchEvent(new Event('change'));}
  }
  updateDisplayBalance() {
    let heldCents = 0;
    for (const presentation of [...this.plinkoPresentations.values(), ...this.gamePresentations.values()]) {
      // A parallel refresh can include a booked win before the play response
      // arrives. Retain the prior display until that response identifies it.
      if (presentation.payoutCents === null) return;
      heldCents += presentation.payoutCents;
    }
    this.displayBalance = Math.max(0, Math.round(Number(this.snapshot?.wallet.chips || 0) * 100) - heldCents) / 100;
  }
  revealPlinko(requestId) {
    if (requestId === undefined) this.plinkoPresentations.clear();
    else {
      const presentation = this.plinkoPresentations.get(requestId);
      if (!presentation) return;
      this.plinkoPresentations.delete(requestId);
      // Landing still reveals this win while another play response is pending.
      if (presentation.payoutCents !== null) this.displayBalance = (Math.round(this.displayBalance * 100) + presentation.payoutCents) / 100;
    }
    this.updateDisplayBalance();
    this.dispatchEvent(new Event('change'));
  }
  releasePayout(roundId) {
    for (const [id, presentation] of this.gamePresentations) {
      if (roundId === undefined || presentation.roundId === roundId || id === roundId) {
        this.gamePresentations.delete(id);
        if (presentation.payoutCents !== null) this.displayBalance += presentation.payoutCents / 100;
      }
    }
    this.updateDisplayBalance();
    this.dispatchEvent(new Event('change'));
  }
  async rpc(name, args = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const { data, error } = await this.client.rpc(name, args).abortSignal(controller.signal);
      if (error) throw error;
      this.accept(data, args.p_request_id);
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
      if (!['casino_claim_bonus', 'casino_claim_daily', 'casino_play_plinko', 'casino_play_plinko_mode', 'casino_game_action', 'casino_crash_action', 'casino_roulette_action', 'casino_blackjack_action'].includes(item.name)) continue;
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
  transact(name, args = {}, { deferPlinkoPayout = false, deferPayout = false } = {}) {
    // Serialize this tab's intents so recovery never re-submits an in-flight
    // request as another click. PostgreSQL serializes separate tabs as well.
    const next = this.operation.catch(() => {}).then(async () => {
      await this.recover();
      const id = crypto.randomUUID();
      const item = { key: this.prefix + id, name, args: { ...args, p_request_id: id } };
      if (deferPlinkoPayout) this.plinkoPresentations.set(id, { payoutCents: null });
      if (deferPayout) this.gamePresentations.set(id, { payoutCents: null, roundId: null });
      try {
        localStorage.setItem(item.key, JSON.stringify(item));
        return await this.submit(item);
      } catch (error) {
        // No animation can be shown after a failed request. The usual outbox
        // still recovers ambiguous bookings without a second credit.
        if (deferPlinkoPayout) this.revealPlinko(id);
        if (deferPayout) this.releasePayout(id);
        throw error;
      }
    });
    this.operation = next;
    return next;
  }
  claim() { if(this.snapshot?.rules?.economy!=='casino-v1')return Promise.reject(new Error('casino_bonus_migration'));return this.transact('casino_claim_bonus'); }
  validateStake(stake) {
    if (!Number.isFinite(stake)||stake<1||stake>100000||Math.abs(stake*100-Math.round(stake*100))>1e-7) throw new Error('casino_invalid_bet');
    if (!Number.isInteger(stake)&&this.snapshot?.currency_decimals!==2) throw new Error('casino_precision_migration');
  }
  play(stake, difficulty = 'normal', { deferPayout = false } = {}) {
    this.validateStake(stake);
    if (!['easy','normal','hard'].includes(difficulty)) throw new Error('casino_invalid_bet');
    if (this.snapshot?.rules?.economy !== 'casino-v1') throw new Error('casino_bonus_migration');
    return this.transact('casino_play_plinko_mode', { p_stake: stake, p_difficulty: difficulty }, { deferPlinkoPayout: deferPayout });
  }
  game(game, action, round, payload) { if(action==='start')this.validateStake(payload.stake);return this.transact('casino_game_action', {p_game:game,p_action:action,p_round_id:round,p_payload:payload}); }
  refreshCrash() { return this.rpc('casino_crash_state'); }
  crashAction(action,flight,payload={}) { if(action==='start')this.validateStake(payload.stake);return this.transact('casino_crash_action',{p_action:action,p_flight_id:flight,p_payload:payload}); }
  refreshRoulette() { return this.rpc('casino_roulette_state'); }
  rouletteAction(round,color,stake) {
    this.validateStake(stake);
    if (!['red','black','green'].includes(color)) throw new Error('casino_invalid_bet');
    return this.transact('casino_roulette_action',{p_round_id:round,p_color:color,p_stake:stake});
  }
  blackjackAction(action,round,payload={},options={}) {
    if (action === 'start') this.validateStake(payload.stake);
    return this.transact('casino_blackjack_action',{p_action:action,p_round_id:round,p_payload:payload},options);
  }
  async blackjackFeed() {
    if (!this.client || !this.user) return [];
    const {data,error} = await this.client.rpc('casino_blackjack_feed');
    if (error) throw error;
    return data || [];
  }
  subscribeTable(table, callback) {
    if (!this.client || !this.user) return () => {};
    const channel=this.client.channel(`${table}:${crypto.randomUUID()}`)
      .on('postgres_changes',{event:'*',schema:'public',table},payload=>callback(payload.new))
      .subscribe();
    return () => { this.client.removeChannel(channel); };
  }
  subscribeRoulette(callback) {
    const closeRound=this.subscribeTable('casino_roulette_live',callback);
    const closeBets=this.subscribeTable('casino_roulette_bets_live',callback);
    return () => { closeRound(); closeBets(); };
  }
  subscribeBlackjackFeed(callback) { return this.subscribeTable('casino_blackjack_results',callback); }
  now() { return Date.now() + this.offset; }
}
