import { ensureCurrentKaktusSeason } from "./lib/kaktusSeason.mjs";

export default async () => {
    await ensureCurrentKaktusSeason();
};

export const config = {
    schedule: "5 * * * *",
};
