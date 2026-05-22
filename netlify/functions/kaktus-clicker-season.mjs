import { ensureCurrentKaktusSeason } from "./lib/kaktusSeason.mjs";

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8" },
    });
}

export default async () => {
    try {
        return json(await ensureCurrentKaktusSeason());
    } catch (error) {
        return json({ error: error.message || "Saisonprüfung fehlgeschlagen." }, 500);
    }
};

export const config = {
    path: "/api/kaktus-clicker-season",
};
