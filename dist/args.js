function tokenize(input) {
    const tokens = [];
    let current = "";
    let quote = null;
    for (let index = 0; index < input.length; index += 1) {
        const char = input[index];
        if (quote) {
            if (char === quote) {
                quote = null;
            }
            else {
                current += char;
            }
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        if (/\s/.test(char)) {
            if (current) {
                tokens.push(current);
                current = "";
            }
            continue;
        }
        current += char;
    }
    if (current) {
        tokens.push(current);
    }
    return tokens;
}
export function parseSetupArgs(raw) {
    const tokens = tokenize(raw.trim());
    const result = {};
    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];
        const next = tokens[index + 1];
        const assign = token.includes("=") ? token.split(/=(.*)/s) : null;
        const key = assign ? assign[0] : token;
        const value = assign ? assign[1] : next;
        switch (key) {
            case "token":
            case "--token":
                if (value) {
                    result.token = value;
                    if (!assign)
                        index += 1;
                }
                break;
            case "backend":
            case "--backend":
                if (value) {
                    result.backend = value;
                    if (!assign)
                        index += 1;
                }
                break;
            case "session":
            case "--session":
                if (value) {
                    result.session = value;
                    if (!assign)
                        index += 1;
                }
                break;
            case "interval":
            case "--interval":
                if (value) {
                    const parsed = Number(value);
                    if (Number.isFinite(parsed)) {
                        result.interval = Math.round(parsed);
                    }
                    if (!assign)
                        index += 1;
                }
                break;
            case "enable":
            case "--enable":
                result.enable = true;
                break;
            case "disable":
            case "--disable":
                result.enable = false;
                break;
            default:
                break;
        }
    }
    return result;
}
