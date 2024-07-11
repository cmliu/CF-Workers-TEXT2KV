// 定义一个名为 mytoken 的变量，并将 'passwd' 作为默认的读写权限
let mytoken= 'passwd';

export default {
	async fetch (request, env) {
		// 如果环境变量中有 TOKEN，则将其赋值给 mytoken，否则保持默认值
		mytoken = env.TOKEN || mytoken;

		let KV;
		// 检查 KV (键值存储) 是否已经被设置
		if (env.KV) {
			// 将 env.KV 赋值一个名为 KV 的常量
			KV =  env.KV;
		} else {
			//throw new Error('KV 命名空间未绑定');
			return new Response('KV 命名空间未绑定', {
				status: 400,
				headers: { 'content-type': 'text/plain; charset=utf-8' },
			});
		}

		// 从请求的 URL 中获取需要的参数
		const url = new URL(request.url);
		let token;
		if (url.pathname === `/${mytoken}`){
			token = mytoken;
		} else {
			// 获取 URL 查询参数中的 'token'，如果不存在则赋值为 "null"
			token = url.searchParams.get('token') || "null";
		}

		// 检查提供的 token 是否与 mytoken 相符
		if (token === mytoken) {
			const 文件名 = url.pathname.startsWith('/') ? url.pathname.substring(1) : url.pathname;

			if (文件名 == "config" || 文件名 == mytoken) {
				const html = configHTML(url.hostname, token);
				return new Response(html, {
				  headers: {
					'Content-Type': 'text/html; charset=UTF-8',
				  },
				});
			} else if (文件名 == "config/update.bat") {
				return new Response(下载bat(url.hostname, token), {
				  headers: {
					"Content-Disposition": `attachment; filename=update.bat`, 
					"content-type": "text/plain; charset=utf-8",
				  },
				});
			} else if (文件名 == "config/update.sh") {
				return new Response(下载sh(url.hostname, token), {
				  headers: {
					"Content-Disposition": `attachment; filename=update.sh`, 
					"content-type": "text/plain; charset=utf-8",
				  },
				});
			} else {
				// 获取 URL 查询参数中的 'text' 和 'b64'，如果不存在则赋值为 "null"
				const text = url.searchParams.get('text') || "null";
				const b64 = url.searchParams.get('b64') || "null";

				// 如果 'text' 和 'b64' 都为 "null"，则从 KV 中读取并返回文件内容
				if (text === "null" && b64 === "null"){
					const value = await KV.get(文件名);
					return new Response(value , {
						status: 200,
						headers: { 'content-type': 'text/plain; charset=utf-8' },
					});
				} else {
					// 检查文件是否存在
					await fileExists(KV, 文件名);
					
					// 如果 'b64' 为 "null" ，则以明文方式写入文件，如果 'text' 为 "null" ，则以 base64 方式写入文件
					if (b64 === "null" ){
						await KV.put(文件名, text);
						return new Response(text, {
							status: 200,
							headers: { 'content-type': 'text/plain; charset=utf-8' },
						});
					} else if (text === "null" ){
						await KV.put(文件名, base64Decode(空格替换加号(b64)));
						return new Response(base64Decode(空格替换加号(b64)), {
							status: 200,
							headers: { 'content-type': 'text/plain; charset=utf-8' },
						});
					}
				}
			}

			
		} else if (url.pathname == "/"){//首页改成一个nginx伪装页
			return new Response(`
			<!DOCTYPE html>
			<html>
			<head>
			<title>Welcome to nginx!</title>
			<style>
				body {
					width: 35em;
					margin: 0 auto;
					font-family: Tahoma, Verdana, Arial, sans-serif;
				}
			</style>
			</head>
			<body>
			<h1>Welcome to nginx!</h1>
			<p>If you see this page, the nginx web server is successfully installed and
			working. Further configuration is required.</p>
			
			<p>For online documentation and support please refer to
			<a href="http://nginx.org/">nginx.org</a>.<br/>
			Commercial support is available at
			<a href="http://nginx.com/">nginx.com</a>.</p>
			
			<p><em>Thank you for using nginx.</em></p>
			</body>
			</html>
			`, {
			  headers: {
				'Content-Type': 'text/html; charset=UTF-8',
			  },
			});
		} else {// 如果 token 不符，返回 'token 有误'//
			return new Response('token 有误', {
				status: 400,
				headers: { 'content-type': 'text/plain; charset=utf-8' },
			});
		}
	}
};

// 定义一个名为 fileExists 的异步函数，通过查询 KV 中是否有 filename 对应的值来判断文件是否存在
async function fileExists(KV, filename) {
	const value = await KV.get(filename);
	return value !== null;
}

// 定义一个名为 base64Decode 的函数，用于将 base64 编码的字符串转换为 utf-8 编码的字符
function base64Decode(str) {
	const bytes = new Uint8Array(atob(str).split('').map(c => c.charCodeAt(0)));
	const decoder = new TextDecoder('utf-8');
	return decoder.decode(bytes);
}

function 空格替换加号(str) {
	str = str.replace(/ /g, '+');
	return str;
}

function 下载bat(域名,token) {
	return [
	  `@echo off`,
	  `chcp 65001`,
	  `setlocal`,
	  ``,
	  `set "DOMAIN=${域名}"`,
	  `set "TOKEN=${token}"`,
	  ``,
	  `rem %~nx1表示第一个参数的文件名和扩展名`,
	  `set "FILENAME=%~nx1"`,
	  ``,
	  `rem PowerShell命令读取文件的前65行内容，将内容转换为UTF8并进行base64编码`,
	  `for /f "delims=" %%i in ('powershell -command "$content = ((Get-Content -Path '%cd%/%FILENAME%' -Encoding UTF8) | Select-Object -First 65) -join [Environment]::NewLine; [convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($content))"') do set "BASE64_TEXT=%%i"`,
	  ``,
	  `rem 将内容保存到response.txt`,
	  `rem echo %BASE64_TEXT% > response.txt`,
	  ``,
	  `rem 构造带有文件名和内容作为参数的URL`,
	  `set "URL=https://%DOMAIN%/%FILENAME%?token=%TOKEN%^&b64=%BASE64_TEXT%"`,
	  ``,
	  `rem 显示请求的响应 `,
	  `rem powershell -Command "(Invoke-WebRequest -Uri '%URL%').Content"`,
	  `start %URL%`,
	  `endlocal`,
	  ``,
	  `echo 更新数据完成,倒数5秒后自动关闭窗口...`,
	  `timeout /t 5 >nul`,
	  `exit`
	].join('\r\n');
}

function 下载sh(域名,token) {
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
curl -k "https://$DOMAIN/$FILENAME?token=$TOKEN&b64=$BASE64_TEXT"
echo "更新数据完成"
`
}

function configHTML(域名, token) {
	return `
	  <html>
		<head>
		  <title>CF-Workers-TEXT2KV</title>
		</head>
		<body>
		  <h1 class="centered">CF-Workers-TEXT2KV 配置信息</h1>
		  <p class="centered">
		  服务域名: ${域名} <br>
		  token: ${token} <br>
		  <br>
		  <pre>注意! 因URL长度内容所限，脚本更新方式一次最多更新65行内容</pre><br>
		  Windows脚本: <button type="button" onclick="window.open('https://${域名}/config/update.bat?token=${token}', '_blank')">点击下载</button>
		  <br>
		  <pre>使用方法: <code>&lt;update.bat&nbsp;ip.txt&gt;</code></pre>
		  <br>
		  Linux脚本: 
		  <code>&lt;curl&nbsp;https://${域名}/config/update.sh?token=${token}&nbsp;-o&nbsp;update.sh&nbsp;&&&nbsp;chmod&nbsp;+x&nbsp;update.sh&gt;</code><br>
		  <pre>使用方法: <code>&lt;./update.sh&nbsp;ip.txt&gt;</code></pre><br>
		  <br>
		  在线文档查询: <br>
		  https://${域名}/<input type="text" name="keyword" placeholder="请输入要查询的文档">?token=${token}    
		  <button type="button" onclick="window.open('https://${域名}/' + document.querySelector('input[name=keyword]').value + '?token=${token}', '_blank')">查看文档内容</button>
		  <button type="button" onclick="navigator.clipboard.writeText('https://${域名}/' + document.querySelector('input[name=keyword]').value + '?token=${token}')">复制文档地址</button>
		  </p>
	  <br>
		</body>
	  </html>
	`
}
