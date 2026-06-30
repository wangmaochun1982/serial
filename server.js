const fs = require('fs');
const path = require('path');
const https = require('https');
const { SerialPort } = require('serialport');
const WebSocket = require('ws');

// pkg 打包后用 exe 同级目录，开发时用 __dirname
const baseDir = process.pkg ? path.dirname(process.execPath) : __dirname;

// ==========================================
// ⚙️ 读取配置文件 config.json
// ==========================================
const configPath = path.join(baseDir, 'config.json');
let config;
try {
    const configData = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(configData);
    console.log("⚙️ 成功加载配置文件，当前串口:", config.serial.path);
} catch (err) {
    console.error("❌ 读取 config.json 失败！请确保它和程序在同一目录。");
    console.error("💥 错误:", err.message);
    process.exit(1);
}

// =================================
// 2. 载入你提供的 cert.pem 和 cert.key 证书
// =================================
let serverOptions;
try {
    serverOptions = {
        key: fs.readFileSync(path.join(baseDir, config.websocket.ssl_key)),
        cert: fs.readFileSync(path.join(baseDir, config.websocket.ssl_crt))
    };
    console.log("🔒 SSL 安全证书与私钥加载成功！已整装待发。");
} catch (err) {
    console.error("❌ 读取证书文件失败！请检查 config.json 中的 ssl_key 和 ssl_crt 路径以及文件名是否正确。");
    console.error(`💥 错误信息: ${err.message}`);
    process.exit(1);
}

// =================================
// 3. 创建加密的 HTTPS 服务器并挂载 WSS
// =================================
const httpsServer = https.createServer(serverOptions, (req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("WSS 安全网关运行中，证书已成功载入！\n");
});

// 将 WebSocket 升级为安全的加密网关 (WSS)
const wss = new WebSocket.Server({ server: httpsServer });

httpsServer.listen(config.websocket.port, () => {
    console.log(`🚀 WSS 安全网关已在本地成功启动！端口: ${config.websocket.port}`);
    console.log(`💡 前端 JSP 页面现在可以通过 wss://local.keentech-xm.com:${config.websocket.port} 安全连接了。`);
});

// =================================
// 4. 处理来自远程 JSP 网页的安全握手连接
// =================================
wss.on("connection", (ws) => {
    console.log("📱 远程 JSP 称重页面已通过 WSS 成功建立安全连接！");
    
    // 如果网页想给串口发送指令（比如去皮、置零），这里负责转发给串口
    ws.on("message", (msg) => {
        const text = msg.toString().trim();
        console.log("网页 -> 本地网关指令：", text);
        if (port.isOpen) {
            port.write(text + "\r\n");
        }
    });

    ws.on("close", () => {
        console.log("❌ 远程称重页面已断开连接");
    });
});

// =================================
// 5. 核心：初始化串口并直接监听原始流广播
// =================================
const port = new SerialPort({
    path: config.serial.path,
    baudRate: parseInt(config.serial.baudRate, 10),
    dataBits: parseInt(config.serial.dataBits, 10) || 8,
    stopBits: parseInt(config.serial.stopBits, 10) || 1,
    parity: config.serial.parity || "none",
    autoOpen: true
});

port.on("open", () => {
    console.log(`🔌 串口 [${config.serial.path}] 成功打开！正在全力监听电子秤的重量信号...`);
});

// 移除 ReadlineParser 限制，采用最稳妥的直接数据流捕捉
port.on("data", (data) => {
    const text = data.toString().trim();
    if (!text) return; // 过滤掉串口瞬间发来的空字符

    console.log(`📡 串口硬件收到 -> [${text}]`);

    // 强力广播给所有正在打开的 JSP 网页客户端
    let successCount = 0;
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(text); // 把原始重量数据塞给网页
            successCount++;
        }
    });

    if (successCount > 0) {
        console.log(`   └─ 已成功同步给 ${successCount} 个网页端`);
    }
});

// 串口异常拦截
port.on("error", (err) => {
    console.error(`💥 串口 [${config.serial.path}] 发生硬件级别错误:`, err.message);
    console.error("💡 提示：请确保电子秤数据线没有松动，且端口没有被其他软件误占用。");
});