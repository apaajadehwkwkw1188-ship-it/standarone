const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();

// =======================
const BOT_IP_WHITELIST = ["127.0.0.1", "::1"];

// ⚠️ Vercel: pakai memory (bukan file)
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
// SIMPLE RATE LIMIT
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
// STATIC (Vercel Safe)
// =======================
const publicDir = path.join(process.cwd(), 'public');

app.use('/', express.static(publicDir, {
    index: 'welcome.html'
}));

app.get('/docs', (req, res) => {
    const filePath = path.join(publicDir, 'docs.html');

    if (!fs.existsSync(filePath)) {
        return res.status(404).send("docs.html not found");
    }

    res.sendFile(filePath);
});

// =======================
// 🔥 AUTO LOAD PLUGINS (SAFE)
// =======================
const plugins = [];
const plugDir = path.join(process.cwd(), "plug");

if (fs.existsSync(plugDir)) {
    fs.readdirSync(plugDir).forEach(file => {
        if (!file.endsWith(".js")) return;

        try {
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
                    res.status(500).json({
                        status: false,
                        error: err.message
                    });
                }
            });

            console.log("✔ Loaded:", file);

        } catch (err) {
            console.log("❌ Plugin error:", file, err.message);
        }
    });
} else {
    console.log("❌ Folder /plug tidak ditemukan");
}

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
