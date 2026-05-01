const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

// =======================
const BOT_IP_WHITELIST = ["127.0.0.1", "::1"];

// ⚠️ di vercel kita gak bisa simpan file → pakai memory doang
let blockedIPs = new Set();

// =======================
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

// =======================
// BLOCK CHECK
// =======================
app.use((req, res, next) => {
    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
        .replace("::ffff:", "");

    if (BOT_IP_WHITELIST.includes(ip)) return next();

    if (blockedIPs.has(ip)) {
        return res.status(403).json({
            status: false,
            error: "IP Blocked"
        });
    }

    next();
});

// =======================
// SIMPLE LIMIT (tanpa file)
// =======================
const requestMap = new Map();

app.use((req, res, next) => {
    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
        .replace("::ffff:", "");

    if (BOT_IP_WHITELIST.includes(ip)) return next();

    const now = Date.now();
    const windowMs = 10 * 1000;

    if (!requestMap.has(ip)) {
        requestMap.set(ip, []);
    }

    const requests = requestMap.get(ip).filter(t => now - t < windowMs);
    requests.push(now);
    requestMap.set(ip, requests);

    if (requests.length > 30) {
        blockedIPs.add(ip);

        return res.status(429).json({
            status: false,
            error: "Too Many Requests"
        });
    }

    next();
});

// =======================
// STATIC (optional)
// =======================
app.use('/', express.static(path.join(process.cwd(), 'public'), {
    index: 'welcome.html'
}));

app.get('/docs', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'docs.html'));
});

// =======================
// 🔥 AUTO LOAD PLUGINS
// =======================
const plugins = [];
const plugDir = path.join(__dirname, "../plug");

fs.readdirSync(plugDir).forEach(file => {
    if (!file.endsWith(".js")) return;

    const plugin = require(path.join(plugDir, file));

    if (!plugin.path || !plugin.execute) return;

    plugins.push({
        name: plugin.name || file,
        path: plugin.path,
        category: plugin.category || "Other",
        param: plugin.param || null,
        example: plugin.example || ""
    });

    app.get(plugin.path, async (req, res) => {
        try {
            const result = await plugin.execute(req, res);

            if (res.headersSent) return;

            res.json({
                status: true,
                creator: "IkyyOfficial",
                result
            });

        } catch (err) {
            if (!res.headersSent) {
                res.status(500).json({
                    status: false,
                    error: err.message
                });
            }
        }
    });

    console.log("✔ Loaded:", file);
});

// =======================
// API LIST
// =======================
app.get("/api/list", (req, res) => {
    res.json(plugins);
});

// =======================
// EXPORT (WAJIB VERCEL)
// =======================
module.exports = app;
