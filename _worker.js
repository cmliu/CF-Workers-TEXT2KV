let mytoken = 'passwd';

export default {
    async fetch(request, env) {
        try {
            mytoken = env.TOKEN || mytoken;

            if (!env.KV) {
                throw new Error('KV 命名空间未绑定');
            }

            const url = new URL(request.url);
            const token = url.pathname === `/${mytoken}` ? mytoken : (url.searchParams.get('token') || "null");

            if (token !== mytoken) {
                return createResponse('token 有误', 403);
            }

            let fileName = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;
            fileName = fileName.toLowerCase(); // 将文件名转换为小写

            switch (fileName) {
                case "config":
                case mytoken:
                    return createResponse(configHTML(url.hostname, token), 200, { 'Content-Type': 'text/html; charset=UTF-8' });
                case "config/update.bat":
                    return createResponse(generateBatScript(url.hostname, token), 200, { "Content-Disposition": 'attachment; filename=update.bat', "Content-Type": "text/plain; charset=utf-8" });
                case "config/update.sh":
                    return createResponse(generateShScript(url.hostname, token), 200, { "Content-Disposition": 'attachment; filename=update.sh', "Content-Type": "text/plain; charset=utf-8" });
                default:
                    return await handleFileOperation(env.KV, fileName, url, token);
            }
        } catch (error) {
            console.error("Error:", error);
            return createResponse(`Error: ${error.message}`, 500);
        }
    }
};

/**
 * 处理文件操作
 * @param {Object} KV - KV 命名空间实例
 * @param {String} fileName - 文件名
 * @param {Object} url - URL 实例
 * @param {String} token - 认证 token
 */
async function handleFileOperation(KV, fileName, url, token) {
    const text = url.searchParams.get('text') || null;
    const b64 = url.searchParams.get('b64') || null;

    // 如果没有传递 text 或 b64 参数，尝试从 KV 存储中获取文件内容
    if (!text && !b64) {
        const value = await KV.get(fileName, { cacheTtl: 60 });
        if (value === null) {
            return createResponse('File not found', 404);
        }
        return createResponse(value);
    }

    // 如果传递了 text 或 b64 参数，将内容写入 KV 存储
    let content = text || base64Decode(replaceSpacesWithPlus(b64));
    await KV.put(fileName, content);
    const verifiedContent = await KV.get(fileName, { cacheTtl: 60 });

    if (verifiedContent !== content) {
        throw new Error('Content verification failed after write operation');
    }

    return createResponse(verifiedContent);
}

/**
 * 创建 HTTP 响应
 * @param {String} body - 响应内容
 * @param {Number} status - HTTP 状态码
 * @param {Object} additionalHeaders - 额外的响应头部信息
 */
function createResponse(body, status = 200, additionalHeaders = {}) {
    const headers = {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'ETag': Math.random().toString(36).substring(2, 15),
        'Last-Modified': new Date().toUTCString(),
        'cf-cache-status': 'DYNAMIC',
        ...additionalHeaders
    };
    return new Response(body, { status, headers });
}

/**
 * 解码 base64 字符串
 * @param {String} str - base64 字符串
 */
function base64Decode(str) {
    try {
        const bytes = new Uint8Array(atob(str).split('').map(c => c.charCodeAt(0)));
        return new TextDecoder('utf-8').decode(bytes);
    } catch (error) {
        throw new Error('Invalid base64 string');
    }
}

/**
 * 将字符串中的空格替换为加号
 * @param {String} str - 输入字符串
 */
function replaceSpacesWithPlus(str) {
    return str.replace(/ /g, '+');
}

/**
 * 生成 Windows bat 脚本
 * @param {String} domain - 域名
 * @param {String} token - 认证 token
 */
function generateBatScript(domain, token) {
    return [
        '@echo off',
        'chcp 65001',
        'setlocal',
        '',
        `set "DOMAIN=${domain}"`,
        `set "TOKEN=${token}"`,
        '',
        'set "FILENAME=%~nx1"',
        '',
        'for /f "delims=" %%i in (\'powershell -command "$content = ((Get-Content -Path \'%cd%/%FILENAME%\' -Encoding UTF8) | Select-Object -First 65) -join [Environment]::NewLine; [convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($content))"\') do set "BASE64_TEXT=%%i"',
        '',
        'set "URL=https://%DOMAIN%/%FILENAME%?token=%TOKEN%^&b64=%BASE64_TEXT%"',
        '',
        'start %URL%',
        'endlocal',
        '',
        'echo 更新数据完成,倒数5秒后自动关闭窗口...',
        'timeout /t 5 >nul',
        'exit'
    ].join('\r\n');
}

/**
 * 生成 Linux sh 脚本
 * @param {String} domain - 域名
 * @param {String} token - 认证 token
 */
function generateShScript(domain, token) {
    return `#!/bin/bash
export LANG=zh_CN.UTF-8
DOMAIN="${domain}"
TOKEN="${token}"
if [ -n "$1" ]; then 
  FILENAME="$1"
else
  echo "无文件名"
  exit 1
fi
BASE64_TEXT=$(head -n 65 $FILENAME | base64 -w 0)
curl -k "https://${domain}/${FILENAME}?token=${token}&b64=${BASE64_TEXT}"
echo "更新数据完成"
`;
}

/**
 * 生成 HTML 配置页面
 * @param {String} domain - 域名
 * @param {String} token - 认证 token
 */

function configHTML(domain, token) {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CF-Workers-TEXT2KV 配置信息</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 15px; max-width: 800px; margin: 0 auto; }
        h1 { text-align: center; }
        h2 { text-align: left; font-size:1.3rem}
        pre,code { padding: 0px; border-radius: 8px; overflow-x: auto; white-space: nowrap; }
        pre code { background: none; padding: 0; border: none; }
        button { 
        white-space: nowrap;
        cursor: pointer; 
        padding: 10px 10px; 
        margin-top: 0px; 
        border: none; 
        border-radius: 5px; 
    flex-shrink: 0; /* 防止按钮缩小 */
        }
        button:hover { opacity: 0.9; }
        input[type="text"] { 
            padding: 9px 10px;
            border-radius: 5px;
            flex-grow: 1;
            min-width:0;
        }
        .tips {
            color:grey;
            font-size:0.8em;
            border-left: 1px solid #666;
            padding-left: 10px;
        }
        .container { 
        padding: 5px 15px 15px 15px; 
        border-radius: 10px; 
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.1); }
            /* Flexbox layout for h2 and button */
        .flex-row { 
        display: flex; 
        justify-content: space-between; 
        align-items: center; 
        margin-top:-10px !important;
        margin-bottom:-10px !important;
        }
        .download-button {
            padding: 5px 10px; /* 调整按钮的内边距，改变大小 */
            margin:0 !importan;
            background-color: Indigo !important; /* 设置按钮背景颜色 */
            color: white; /* 设置按钮文本颜色 */
            border: none; /* 去掉边框 */
            border-radius: 5px; /* 设置圆角 */
            cursor: pointer; /* 设置鼠标悬停时的光标样式 */
            transition: background-color 0.3s; /* 添加背景颜色的过渡效果 */
        }
        
        .download-button:hover {
            background-color: #45a049; /* 鼠标悬停时的背景颜色 */
        }
        .input-button-container {
            display: flex;
            align-items: center;
            gap: 5px;
        }

        /* Light theme */
        body.light { background-color: #f0f0f0; color: #333; }
        h1.light { color: #444; }
        pre.light { background-color: #fff; border: 1px solid #ddd; }
        button.light { background-color: DarkViolet; color: #fff; }
        input[type="text"].light { border: 1px solid #ddd; }
        .container.light { background-color: #fff; }

        /* Dark theme */
        body.dark { background-color: #1e1e1e; color: #c9d1d9; }
        h1.dark { color: #c9d1d9; }
        pre.dark { background-color: #2d2d2d; border: 1px solid #444; }
        button.dark { background-color: DarkViolet; color: #c9d1d9; }
        input[type="text"].dark { border: 1px solid #444; }
        .container.dark { background-color: #2d2d2d; }
    </style>
    <!-- 引入 Highlight.js 的 CSS 文件 -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/styles/obsidian.min.css">
    <!-- 引入 Highlight.js 的 JavaScript 文件 -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.10.0/highlight.min.js"></script>
    <script>hljs.highlightAll();</script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            const theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.body.classList.add(theme);
            document.querySelectorAll('h1, pre, button, input[type="text"], .container').forEach(el => el.classList.add(theme));
        });
    </script>
</head>
<body>
        <h1>TEXT2KV 配置信息</h1>
    <div class="container">

        <p>
            <strong>服务域名:</strong> ${domain}<br>
            <strong>TOKEN:</strong> ${token}<br>
        </p>
        <p class="tips"><strong>注意!</strong> 因URL长度内容所限，脚本更新方式一次最多更新65行内容</p>
    <div class="flex-row">
    <h2>Windows 脚本:</h2>
    <button class="download-button" onclick="window.open('https://${domain}/config/update.bat?token=${token}&t=' + Date.now(), '_blank')">点击下载</button>
    </div>
        <pre><code>update.bat ip.txt</code></pre>
        <h2>Linux 脚本:</h2>
        <pre><code class="language-bash">curl "https://${domain}/config/update.sh?token=${token}&t=$(date +%s%N)" -o update.sh && chmod +x update.sh</code></pre>
        <h2>在线文档查询:</h2>
        <div class="input-button-container">
        <input type="text" id="keyword" placeholder="请输入要查询的文档">
        <button onclick="viewDocument()">查看文档内容</button>
        <button onclick="copyDocumentURL()">复制文档地址</button>
        </div>
    </div>
    <script>
        /**
         * 查看文档内容
         */
        function viewDocument() {
            const keyword = document.getElementById('keyword').value;
            window.open('https://${domain}/' + keyword + '?token=${token}&t=' + Date.now(), '_blank');
        }

        /**
         * 复制文档地址到剪贴板
         */
        function copyDocumentURL() {
            const keyword = document.getElementById('keyword').value;
            const url = 'https://${domain}/' + keyword + '?token=${token}&t=' + Date.now();
            navigator.clipboard.writeText(url).then(() => alert('文档地址已复制到剪贴板'));
        }
    </script>
</body>
</html>
    `;
}
  