import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import os from "node:os";
function sanitizeToken(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}
export function ensureInstallIdentity(config) {
    const installId = config.installId.trim() || randomUUID();
    const hostname = sanitizeToken(os.hostname()) || "openclaw-device";
    const deviceId = config.deviceId.trim() || `${hostname}-${randomUUID().slice(0, 8)}`;
    return { installId, deviceId };
}
function openViaCommand(command, args) {
    return new Promise((resolve, reject) => {
        execFile(command, args, (error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}
export async function openBrowser(url) {
    const target = String(url || "").trim();
    if (!target) {
        throw new Error("Browser authorization URL is empty.");
    }
    if (process.platform === "darwin") {
        await openViaCommand("open", [target]);
        return;
    }
    if (process.platform === "win32") {
        await openViaCommand("cmd", ["/c", "start", "", target]);
        return;
    }
    await openViaCommand("xdg-open", [target]);
}
