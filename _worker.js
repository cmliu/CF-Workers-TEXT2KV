let mytoken = 'passwd';

export default {
    async fetch(request, env) {
        try {
            // 如果环境变量中有 TOKEN，则将其赋值给 mytoken，否则保持默认值
            mytoken = env.TOKEN || mytoken;

            let KV;
            // 检查 KV (键值存储) 是否已经被设置
            if (env.KV) {
                KV = env.KV;
            } else {
                throw new Error('KV 命名空间未绑定');
            }

            const url = new URL(request.url);
            const token = url.pathname === `/${mytoken}` ? mytoken : (url.searchParams.get('token') || "null");

            if (token !== mytoken) {
                return createResponse('token 有误', 403);
            }

            const fileName = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;

            switch(fileName) {
                case "config":
                case mytoken:
                    return createResponse(configHTML(url.hostname, token), 200, {'Content-Type': 'text/html; charset=UTF-8'});
                case "config/update.bat":
                    return createResponse(下载bat(url.hostname, token), 200, {"Content-Disposition": 'attachment; filename=update.bat', "Content-Type": "text/plain; charset=utf-8"});
                case "config/update.sh":
                    return createResponse(下载sh(url.hostname, token), 200, {"Content-Disposition": 'attachment; filename=update.sh', "Content-Type": "text/plain; charset=utf-8"});
                default:
                    return await handleFileOperation(KV, fileName, url, token);
            }
        } catch (error) {
            console.error("Error:", error);
            return createResponse(`Error: ${error.message}`, 500);
        }
    }
};

async function handleFileOperation(KV, fileName, url, token) {
    const text = url.searchParams.get('text') || null;
    const b64 = url.searchParams.get('b64') || null;

    if (!text && !b64) {
        const value = await KV.get(fileName);
        if (value === null) {
            return createResponse('File not found', 404);
        }
        return createResponse(value);
    }

    let content = text || base64Decode(空格替换加号(b64));
    await KV.put(fileName, content);
    const verifiedContent = await KV.get(fileName);

    if (verifiedContent !== content) {
        throw new Error('Content verification failed after write operation');
    }

    return createResponse(verifiedContent);
}

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

function base64Decode(str) {
    try {
        const bytes = new Uint8Array(atob(str).split('').map(c => c.charCodeAt(0)));
        return new TextDecoder('utf-8').decode(bytes);
    } catch (error) {
        throw new Error('Invalid base64 string');
    }
}

function 空格替换加号(str) {
    return str.replace(/ /g, '+');
}

function 下载bat(域名, token) {
    return [
        '@echo off',
        'chcp 65001',
        'setlocal',
        '',
        `set "DOMAIN=${域名}"`,
        `set "TOKEN=${token}"`,
        '',
        'rem %~nx1表示第一个参数的文件名和扩展名',
        'set "FILENAME=%~nx1"',
        '',
        'rem PowerShell命令读取文件的前65行内容，将内容转换为UTF8并进行base64编码',
        'for /f "delims=" %%i in (\'powershell -command "$content = ((Get-Content -Path \'%cd%/%FILENAME%\' -Encoding UTF8) | Select-Object -First 65) -join [Environment]::NewLine; [convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($content))"\') do set "BASE64_TEXT=%%i"',
        '',
        'rem 将内容保存到response.txt',
        'rem echo %BASE64_TEXT% > response.txt',
        '',
        'rem 构造带有文件名和内容作为参数的URL',
        'set "URL=https://%DOMAIN%/%FILENAME%?token=%TOKEN%^&b64=%BASE64_TEXT%"',
        '',
        'rem 显示请求的响应 ',
        'rem powershell -Command "(Invoke-WebRequest -Uri \'%URL%\').Content"',
        'start %URL%',
        'endlocal',
        '',
        'echo 更新数据完成,倒数5秒后自动关闭窗口...',
        'timeout /t 5 >nul',
        'exit'
    ].join('\r\n');
}

function 下载sh(域名, token) {
    return `#!/bin/bash
export LANG=zh_CN.UTF-8
DOMAIN="${域名}"
TOKEN="${token}"
if [ -n "$1" ]; then 
  FILENAME="$1"
else
  echo "无文件名"
  exit 1
fi
BASE64_TEXT=$(head -n 65 $FILENAME | base64 -w 0)
curl -k "https://${域名}/${FILENAME}?token=${token}&b64=${BASE64_TEXT}"
echo "更新数据完成"
`
}

function configHTML(域名, token) {
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CF-Workers-TEXT2KV 配置信息</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; max-width: 800px; margin: 0 auto; }
        h1 { text-align: center; color: #333; }
        pre { background-color: #f4f4f4; padding: 10px; border-radius: 5px; }
        button { cursor: pointer; padding: 5px 10px; }
        input[type="text"] { width: 200px; padding: 5px; }
    </style>
</head>
<body>
    <h1>CF-Workers-TEXT2KV 配置信息</h1>
    <p>
        服务域名: ${域名}<br>
        token: ${token}<br>
    </p>
    <p><strong>注意!</strong> 因URL长度内容所限，脚本更新方式一次最多更新65行内容</p>
    <h2>Windows 脚本:</h2>
    <button onclick="window.open('https://${域名}/config/update.bat?token=${token}&t=' + Date.now(), '_blank')">点击下载</button>
    <pre><code>update.bat ip.txt</code></pre>
    <h2>Linux 脚本:</h2>
    <pre><code>curl "https://${域名}/config/update.sh?token=${token}&t=$(date +%s%N)" -o update.sh && chmod +x update.sh</code></pre>
    <pre><code>./update.sh ip.txt</code></pre>
    <h2>在线文档查询:</h2>
    <input type="text" id="keyword" placeholder="请输入要查询的文档">
    <button onclick="viewDocument()">查看文档内容</button>
    <button onclick="copyDocumentURL()">复制文档地址</button>

    <script>
        function viewDocument() {
            const keyword = document.getElementById('keyword').value;
            window.open('https://${域名}/' + keyword + '?token=${token}&t=' + Date.now(), '_blank');
        }

        function copyDocumentURL() {
            const keyword = document.getElementById('keyword').value;
            const url = 'https://${域名}/' + keyword + '?token=${token}&t=' + Date.now();
            navigator.clipboard.writeText(url).then(() => alert('文档地址已复制到剪贴板'));
        }
    </script>
</body>
</html>
    `;
}
