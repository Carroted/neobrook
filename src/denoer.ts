import { writeFile, unlink } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const PREAMBLE = `
(function() {
  const MAX_BYTES = 10 * 1024; // Limit: 10KB

  function validate(size) {
    if (size > MAX_BYTES) {
      throw new RangeError("SANDBOX: Blocked allocation of " + size + " bytes.");
    }
  }

  // List of constructors to intercept
  const ctors = [
    "ArrayBuffer", 
    "SharedArrayBuffer",
    "Int8Array", "Uint8Array", "Uint8ClampedArray",
    "Int16Array", "Uint16Array",
    "Int32Array", "Uint32Array",
    "Float32Array", "Float64Array",
    "BigInt64Array", "BigUint64Array"
  ];

  for (const name of ctors) {
    const Original = globalThis[name];
    if (!Original) continue;

    // 1. Create the Proxy
    const Proxied = new Proxy(Original, {
      construct(target, args) {
        const arg0 = args[0];
        let size = 0;

        // Calculate size based on type
        if (name.includes("ArrayBuffer")) {
           // new ArrayBuffer(size)
           size = Number(arg0) || 0;
        } else {
           // new TypedArray(size | buffer | array)
           const bpe = target.BYTES_PER_ELEMENT || 1;
           if (typeof arg0 === "number") {
             size = arg0 * bpe;
           } else if (typeof arg0 === "object" && arg0 !== null && typeof arg0.length === "number") {
             // Array-like (e.g. [1,2,3])
             size = arg0.length * bpe;
           }
           // Note: If arg0 is an existing ArrayBuffer, size is 0 (no new memory), so it passes.
        }

        validate(size);
        return Reflect.construct(target, args);
      }
    });

    // 2. CLOSING THE LOOPHOLE:
    // If a user creates a small valid array, 'arr.constructor' usually gives the Original.
    // We overwrite this so they get the Proxy back instead.
    try {
      Original.prototype.constructor = Proxied;
    } catch(e) {}

    // 3. Overwrite the Global Variable
    Object.defineProperty(globalThis, name, {
      value: Proxied,
      configurable: false,
      writable: false
    });
  }
// ===== MEM OBJECT WITH DEEP PROXYING =====
  function createDeepProxy(target) {
    return new Proxy(target, {
      get(obj, prop) {
        const value = obj[prop];
        // Recursively proxy nested objects/arrays
        if (value && typeof value === 'object' && !value.__isProxied) {
          return createDeepProxy(value);
        }
        return value;
      },
      set(obj, prop, value) {
        // If setting an object/array, mark it so we don't double-proxy
        if (value && typeof value === 'object') {
          value.__isProxied = true;
        }
        obj[prop] = value;
        return true;
      }
    });
  }

  globalThis.mem = createDeepProxy({});
})();
`;

function createPostamble(secret: string): string {
    return `;;
    
(function() {
  try {
    const serialized = JSON.stringify(mem, (key, value) => {
      // Filter out our __isProxied markers
      if (key === '__isProxied') return undefined;
      return value;
    });
    console.log('brooksandbox_result${secret}capture_start' + serialized + 'capture_end');
  } catch (e) {
    console.log('brooksandbox_result${secret}capture_start' + JSON.stringify({ __error: String(e) }) + 'capture_end');
  }
})();
`;
}

interface SandboxResult {
    output: string;
    mem: Record<string, any>;
    error?: string;
}

export async function runSandboxedCode(
    userCode: string,
    initialMem: Record<string, any> = {}
): Promise<SandboxResult> {
    const fileName = `sandbox_${randomUUID()}.ts`;
    const filePath = join(tmpdir(), fileName);
    const secret = randomUUID(); // ADD THIS
    let combinedOutput = "";

    try {
        // REPLACE the fullContent line with:
        const memInit = Object.keys(initialMem).length > 0
            ? `Object.assign(mem, ${JSON.stringify(initialMem)});\n`
            : '';

        const fullContent = `${PREAMBLE}\n${memInit}\n// USER CODE\n${userCode}\n\n${createPostamble(secret)}`;
        await writeFile(filePath, fullContent, { encoding: "utf8" });

        // Using V8 flags as a backup, but the Proxy does the heavy lifting
        const child = spawn("deno", [
            "run",
            "--no-prompt",
            "--no-remote",
            "--no-npm",
            "--v8-flags=--max-old-space-size=64,--jitless",
            filePath
        ]);

        const timer = setTimeout(() => child.kill("SIGKILL"), 5000);

        if (child.stdout) child.stdout.on("data", d => combinedOutput += d);
        if (child.stderr) child.stderr.on("data", d => combinedOutput += d);

        await new Promise<void>(r => child.on("close", () => { clearTimeout(timer); r(); }));

        // Extract memory state
        const marker = `brooksandbox_result${secret}capture_start`;
        const startIdx = combinedOutput.indexOf(marker);

        if (startIdx === -1) {
            return {
                output: combinedOutput,
                mem: {},
                error: "Memory capture failed - marker not found"
            };
        }

        const afterMarker = combinedOutput.slice(startIdx + marker.length);
        const endIdx = afterMarker.indexOf('capture_end');

        if (endIdx === -1) {
            return {
                output: combinedOutput,
                mem: {},
                error: "Memory capture incomplete"
            };
        }

        const captured = afterMarker.slice(0, endIdx);
        const mem = JSON.parse(captured);

        // Remove the capture line from output
        const cleanOutput = combinedOutput.slice(0, startIdx) +
            combinedOutput.slice(startIdx + marker.length + endIdx + 'capture_end'.length);

        return {
            output: cleanOutput.trim(),
            mem: mem.__error ? {} : mem,
            error: mem.__error
        };
    } catch (error) {
        return { 
            output: combinedOutput + `\nHost Error: ${error}`, 
            mem: {},
            error: String(error)
        };
    } finally {
        try { await unlink(filePath); } catch { }
    }
}
console.log(await runSandboxedCode(`throw new Error("Test error");`));