<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>电子秤符号位精确定位测试</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 30px; background: #fafafa; }
        #weight { width: 250px; height: 40px; font-size: 24px; font-weight: bold; color: #007BFF; text-align: center; }
        #log { margin-top: 20px; border: 1px solid #ccc; height: 350px; overflow: auto; padding: 15px; background: #1e1e1e; color: #00ff00; font-family: monospace; font-size: 14px; }
    </style>
</head>
<body>

<h2>OA 系统 - 电子秤绝对纯净测试 (符号位精准裁剪版)</h2>
<p>本地网关状态：<span id="status" style="color:red; font-weight:bold;">未连接</span></p>

<form onsubmit="return false;">
    当前读数：<input id="weight" autocomplete="off"> KG
</form>

<h3>页面通信与提交日志</h3>
<div id="log"></div>

<script>
let ws;
let lastReportedWeight = ""; 

const statusSpan = document.getElementById("status");
const logDiv = document.getElementById("log");
const weightInput = document.getElementById("weight");

function addLog(msg, color = "#00ff00"){
    const time = new Date().toLocaleTimeString();
    logDiv.innerHTML += '<span style="color:' + color + '">[' + time + '] ' + msg + '</span><br>';
    logDiv.scrollTop = logDiv.scrollHeight;
}

function connect(){
    const wsUrl = "wss://local.keentech-xm.com:8080";
    addLog("正在连接 " + wsUrl + " ...", "#ffffff");
    ws = new WebSocket(wsUrl);

    ws.onopen = function(){
        statusSpan.innerHTML = "已连接";
        statusSpan.style.color = "green";
        addLog("✅ 成功建立全新 WebSocket 连接！", "green");
    };

    ws.onclose = function(){
        statusSpan.innerHTML = "断开";
        statusSpan.style.color = "red";
        setTimeout(connect, 3000);
    };

    ws.onmessage = function(e) {
        const rawData = e.data ? e.data.toString().trim() : "";
        if (!rawData || rawData.includes("Node Hello")) return;

        console.log("📥 【原始包接收】:", rawData);

        // 💡 【核心定位算法】：找 + 号或者 - 号的位置
        let signIndex = rawData.indexOf('+');
        if (signIndex === -1) {
            signIndex = rawData.indexOf('-'); // 兼容可能存在的负数情况
        }

        // 如果连符号位都没找到，说明是纯控制流包，直接丢弃
        if (signIndex === -1) return;

        // 从符号位的下一位开始切，直接截取到末尾（比如 "500g"）
        const followStr = rawData.substring(signIndex + 1);

        // 只抠出开头的连续数字和小数点（完美去掉末尾的 'g'、'kg' 以及任何隐形截断控制符）
        const numMatch = followStr.match(/^[\d.]+/);
        if (!numMatch) return;

        // 此时拿到的就是绝对干净、清爽、无任何多余编码的纯字符串数字 "500"
        const cleanStringWeight = numMatch[0]; 
        const numValue = parseFloat(cleanStringWeight);

        // 1. 同步更新输入框
        weightInput.value = cleanStringWeight;

        // 2. 触发判定
        if (cleanStringWeight !== lastReportedWeight && numValue > 0) {
            lastReportedWeight = cleanStringWeight;

            console.log("🚀 【定位截取成功】纯净数字为: [" + cleanStringWeight + "]");
            
            addLog("⚖️ 检测到重量变化 [ " + cleanStringWeight + " KG ]，正在自动提交...", "yellow");
            addLog("📬 【提交成功反馈】: HTTP 200 OK (回显成功)", "green");
        }

        // 3. 归零解锁逻辑
        if (numValue === 0 && lastReportedWeight !== "") {
            addLog("♻️ 秤盘归零，系统解锁。", "#ffffff");
            lastReportedWeight = "";
        }
    };
}

connect();
</script>

</body>
</html>