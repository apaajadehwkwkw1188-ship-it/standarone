const axios = require("axios");

module.exports = {
    name: "TikTok Downloader",
    path: "/api/download/tiktok",
    param: "url",
    category: "Downloader",
    example: "https://vt.tiktok.com/xxxxx",

    execute: async (req) => {
        const { url } = req.query;
        if (!url) throw new Error("URL required");

        const { data } = await axios.get(
            `https://tikwm.com/api/?url=${encodeURIComponent(url)}`
        );

        return {
            title: data.data.title,
            nowm: data.data.play,
            wm: data.data.wmplay,
            mp3: data.data.music
        };
    }
};
