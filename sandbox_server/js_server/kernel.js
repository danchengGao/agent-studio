// kernel.js - 支持自定义 timeout 的 JS 沙箱
const http = require("http");
const { spawn } = require("child_process");

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.method === "POST" && req.url === "/run") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", () => {
      runUserCode(body, res);
    });
  } else {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        return: null,
        error: "Not Found",
      })
    );
  }
});

/**
 * 执行用户代码
 */
async function runUserCode(body, res) {
  try {
    const {
      code = "",
      inputs = {},
      timeout: timeoutSec = 10,
    } = JSON.parse(body);

    // 验证 timeout：必须是数字，且在合理范围内
    if (typeof timeoutSec !== "number" || timeoutSec <= 0) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          return: null,
          error: "'timeout' must be a number and > 0 seconds.",
        })
      );
      return;
    }

    // 转换为毫秒（spawn 的 timeout 单位是毫秒）
    const timeoutMs = Math.floor(timeoutSec * 1000);

    const fullCode = `
// 用户代码
${code}

// 沙箱包装代码
(async () => {
  const safeStringify = (obj) => {
    return JSON.stringify(obj, (key, value) =>
      typeof value === 'bigint' ? value.toString() + 'n' : value
    );
  };

  try {
    const args = new Args(${JSON.stringify(inputs)});
    let result = main(args);
    if (result && typeof result.then === 'function') {
      result = await result;
    }
    process.stdout.write(safeStringify({ 
      return: result === undefined ? null : result, 
      error: null 
    }) + '\\n');
    process.exit(0);
  } catch (e) {
    process.stdout.write(safeStringify({ 
      return: null, 
      error: e.message || String(e) 
    }) + '\\n');
    process.exit(0);
  }
})();
`;

    // 创建子进程执行代码
    const child = spawn("node", ["--eval", fullCode], {
      timeout: timeoutMs,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    child.stdout.on("data", (data) => {
      output += data;
    });

    child.stderr.on("data", (data) => {
      output += data;
    });

    child.on("close", (code, signal) => {
      // 如果是超时 kill（signal === 'SIGTERM'），返回超时错误
      if (signal === "SIGTERM") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            return: null,
            error: `Execution timed out (> ${timeoutSec} seconds).`,
          })
        );
        return;
      }

      try {
        const trimmed = output.trim();
        if (!trimmed) {
          throw new Error("Empty output from sandbox");
        }
        const result = JSON.parse(trimmed);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (parseErr) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            return: null,
            error:
              "Sandbox internal error: " +
              (parseErr.message || "unknown") +
              " Output: " +
              output,
          })
        );
      }
    });

    child.on("error", (err) => {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          return: null,
          error: "Failed to spawn sandbox process: " + err.message,
        })
      );
    });
  } catch (e) {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        return: null,
        error: "Invalid request: " + (e.message || "malformed JSON"),
      })
    );
  }
}

// 启动服务器
const PORT = process.env.PORT || 5002;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ JS sandbox listening on http://0.0.0.0:${PORT}`);
});

process.on("SIGTERM", () => {
  server.close(() => {
    console.log("Process terminated");
  });
});
