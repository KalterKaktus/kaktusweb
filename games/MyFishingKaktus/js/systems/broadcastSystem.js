import { getSupabase } from "/js/supabase-client.js";

const CHANNEL_NAME = "fishing-epic-feed";
const EVENT = "epic-catch";

export class BroadcastSystem {
    constructor(onReceive) {
        this.onReceive = onReceive;
        this.channel = null;
        this.ready = false;
    }

    connect() {
        if (this.channel) {
            return;
        }

        const supabase = getSupabase();
        if (!supabase) {
            return;
        }

        this.channel = supabase.channel(CHANNEL_NAME, {
            config: { broadcast: { self: false } },
        });
        this.channel.on("broadcast", { event: EVENT }, ({ payload }) => {
            if (payload && typeof this.onReceive === "function") {
                this.onReceive(payload);
            }
        });
        this.channel.subscribe((status) => {
            this.ready = status === "SUBSCRIBED";
        });
    }

    announce(payload) {
        if (!this.channel || !this.ready) {
            return;
        }

        this.channel.send({ type: "broadcast", event: EVENT, payload });
    }
}
