"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericSecretDetector = void 0;
const vscode = __importStar(require("vscode"));
// Best-effort implementation of the provided Generic High Entropy Secret rules,
// focused on assignments and common code patterns.
class GenericSecretDetector {
    findInDocument(document) {
        // PreValidators: Filename banlist
        const filePath = (document.fileName || '').toLowerCase();
        const isEnvDoc = this.isEnvFilename(filePath);
        const filenameBanlist = [
            /(^|[\/\\])hash([\/\\]|$)/,
            /(^|[\/\\])list[\/\\]k\.txt$/,
            /(^|[\/\\])list[\/\\]plex\.txt$/,
            /\.csproj$/,
            /(^|[\/\\])tg[\/\\]mtproto\.json$/,
        ];
        for (const r of filenameBanlist) {
            if (r.test(filePath))
                return [];
        }
        const findings = [];
        for (let lineIndex = 0; lineIndex < document.lineCount; lineIndex++) {
            const line = document.lineAt(lineIndex).text;
            // Always check for standalone high-entropy secrets
            // For .env-like files, skip standalone scan to avoid masking keys (left of '=')
            if (!isEnvDoc) {
                this.matchStandaloneAnywhere(document, lineIndex, line, findings);
            }
            // If line contains a sensitive key, also try assignment-based rules
            if (GenericSecretDetector.sensitiveKey.test(line)) {
                this.matchIdentifierAssignment(document, lineIndex, line, findings);
                this.matchJsonPropertyAssignment(document, lineIndex, line, findings);
                this.matchBracketPropertyAssignment(document, lineIndex, line, findings);
                this.matchFunctionFirstArgKey(document, lineIndex, line, findings);
                this.matchFunctionNameContainsKey(document, lineIndex, line, findings);
            }
        }
        return findings;
    }
    isEnvFilename(filePath) {
        return filePath.endsWith('.env') ||
            filePath.endsWith('.env.local') ||
            filePath.endsWith('.env.development') ||
            filePath.endsWith('.env.production') ||
            filePath.endsWith('.env.test') ||
            filePath.includes('.env.');
    }
    // Standalone detector: find high-entropy secrets anywhere in the line
    matchStandaloneAnywhere(document, lineIndex, line, findings) {
        const re = new RegExp(String.raw `[A-Za-z0-9_.+\/~$-](?:[A-Za-z0-9_.+\/=~$-]|\\(?![ntr"])){14,1022}[A-Za-z0-9_.+\/=~$-]`, 'g');
        let m;
        while ((m = re.exec(line)) !== null) {
            const value = m[0];
            const startCol = m.index;
            const endCol = startCol + value.length;
            const leftCtx = line.slice(Math.max(0, startCol - 30), startCol);
            const rightCtx = line.slice(endCol, Math.min(line.length, endCol + 30));
            if (this.isValidSecret(value, leftCtx, rightCtx, '')) {
                findings.push({
                    range: new vscode.Range(new vscode.Position(lineIndex, startCol), new vscode.Position(lineIndex, endCol)),
                    value,
                    assignedIdentifier: '',
                    source: 'standalone'
                });
            }
        }
    }
    matchIdentifierAssignment(document, lineIndex, line, findings) {
        // e.g. my_secret := value, api_key = value, token: value, secret <- value, LAVDA_KEY = value
        const idRegex = new RegExp('([A-Za-z_][A-Za-z0-9_.-]*?' + GenericSecretDetector.sensitiveKeyPattern + '[A-Za-z0-9_.-]*)', 'gi');
        let m;
        while ((m = idRegex.exec(line)) !== null) {
            const varName = m[1];
            // find next assignment token after varName
            const after = line.slice(m.index + m[0].length);
            const tokenMatch = this.findNextAssignmentToken(after);
            if (!tokenMatch)
                continue;
            const valueStartCol = m.index + m[0].length + tokenMatch.offset + tokenMatch.token.length + this.consumeWhitespace(after, tokenMatch.offset + tokenMatch.token.length);
            const parsed = this.parseValueFrom(line, valueStartCol);
            if (!parsed)
                continue;
            const leftCtx = line.slice(Math.max(0, parsed.startCol - 30), parsed.startCol);
            const rightCtx = line.slice(parsed.endCol, Math.min(line.length, parsed.endCol + 30));
            if (this.isValidSecret(parsed.value, leftCtx, rightCtx, varName)) {
                findings.push({
                    range: new vscode.Range(new vscode.Position(lineIndex, parsed.startCol), new vscode.Position(lineIndex, parsed.endCol)),
                    value: parsed.value,
                    assignedIdentifier: varName,
                    source: 'identifier-assignment'
                });
            }
        }
    }
    matchJsonPropertyAssignment(document, lineIndex, line, findings) {
        // e.g. "token": value, 'api_key': value
        const re = new RegExp("([\\\"'`])([^\\\"'`]*?" + GenericSecretDetector.sensitiveKeyPattern + "[^\\\"'`]*)\\1\\s*:\\s*", 'gi');
        let m;
        while ((m = re.exec(line)) !== null) {
            const key = m[2];
            const valueStartCol = m.index + m[0].length;
            const parsed = this.parseValueFrom(line, valueStartCol);
            if (!parsed)
                continue;
            const leftCtx = line.slice(Math.max(0, parsed.startCol - 30), parsed.startCol);
            const rightCtx = line.slice(parsed.endCol, Math.min(line.length, parsed.endCol + 30));
            if (this.isValidSecret(parsed.value, leftCtx, rightCtx, key)) {
                findings.push({
                    range: new vscode.Range(new vscode.Position(lineIndex, parsed.startCol), new vscode.Position(lineIndex, parsed.endCol)),
                    value: parsed.value,
                    assignedIdentifier: key,
                    source: 'json-prop'
                });
            }
        }
    }
    matchBracketPropertyAssignment(document, lineIndex, line, findings) {
        // e.g. obj['token'] = value, obj["api_key"] := value
        const re = new RegExp("\\[\\s*([\\\"'`])([^\\\"'`]*?" + GenericSecretDetector.sensitiveKeyPattern + "[^\\\"'`]*)\\1\\s*\\]\\s*(?::=|=>|=|:|<-)?\\s*", 'gi');
        let m;
        while ((m = re.exec(line)) !== null) {
            const key = m[2];
            const valueStartCol = m.index + m[0].length;
            const parsed = this.parseValueFrom(line, valueStartCol);
            if (!parsed)
                continue;
            const leftCtx = line.slice(Math.max(0, parsed.startCol - 30), parsed.startCol);
            const rightCtx = line.slice(parsed.endCol, Math.min(line.length, parsed.endCol + 30));
            if (this.isValidSecret(parsed.value, leftCtx, rightCtx, key)) {
                findings.push({
                    range: new vscode.Range(new vscode.Position(lineIndex, parsed.startCol), new vscode.Position(lineIndex, parsed.endCol)),
                    value: parsed.value,
                    assignedIdentifier: key,
                    source: 'bracket-prop'
                });
            }
        }
    }
    matchFunctionFirstArgKey(document, lineIndex, line, findings) {
        // e.g. obj.set("auth", "value") or set("api_key", value)
        const re = new RegExp("\\(\\s*([\\\"'`])([^\\\"'`]*?" + GenericSecretDetector.sensitiveKeyPattern + "[^\\\"'`]*)\\1\\s*,\\s*", 'gi');
        let m;
        while ((m = re.exec(line)) !== null) {
            const key = m[2];
            const valueStartCol = m.index + m[0].length;
            const parsed = this.parseValueFrom(line, valueStartCol);
            if (!parsed)
                continue;
            const leftCtx = line.slice(Math.max(0, parsed.startCol - 30), parsed.startCol);
            const rightCtx = line.slice(parsed.endCol, Math.min(line.length, parsed.endCol + 30));
            if (this.isValidSecret(parsed.value, leftCtx, rightCtx, key)) {
                findings.push({
                    range: new vscode.Range(new vscode.Position(lineIndex, parsed.startCol), new vscode.Position(lineIndex, parsed.endCol)),
                    value: parsed.value,
                    assignedIdentifier: key,
                    source: 'func-first-arg-key'
                });
            }
        }
    }
    matchFunctionNameContainsKey(document, lineIndex, line, findings) {
        // e.g. set_apikey(value)
        const re = new RegExp("\\b([A-Za-z_][A-Za-z0-9_]*" + GenericSecretDetector.sensitiveKeyPattern + "[A-Za-z0-9_]*)\\s*\\(\\s*", 'gi');
        let m;
        while ((m = re.exec(line)) !== null) {
            const key = m[1];
            const valueStartCol = m.index + m[0].length;
            const parsed = this.parseValueFrom(line, valueStartCol);
            if (!parsed)
                continue;
            const leftCtx = line.slice(Math.max(0, parsed.startCol - 30), parsed.startCol);
            const rightCtx = line.slice(parsed.endCol, Math.min(line.length, parsed.endCol + 30));
            if (this.isValidSecret(parsed.value, leftCtx, rightCtx, key)) {
                findings.push({
                    range: new vscode.Range(new vscode.Position(lineIndex, parsed.startCol), new vscode.Position(lineIndex, parsed.endCol)),
                    value: parsed.value,
                    assignedIdentifier: key,
                    source: 'func-name-key'
                });
            }
        }
    }
    findNextAssignmentToken(after) {
        let best = null;
        for (const token of GenericSecretDetector.assignmentTokens) {
            const idx = this.indexOfToken(after, token);
            if (idx >= 0 && (best === null || idx < best.offset)) {
                best = { token, offset: idx };
            }
        }
        return best;
    }
    indexOfToken(haystack, token) {
        // Allow whitespace before token
        const re = new RegExp(String.raw `^\s*` + this.escapeRegex(token));
        const m = haystack.match(re);
        if (!m)
            return -1;
        // return index of first non-whitespace char relative to haystack start
        const ws = (m[0].length - token.length);
        return ws;
    }
    escapeRegex(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    consumeWhitespace(s, from) {
        let i = from;
        while (i < s.length && /\s/.test(s[i]))
            i++;
        return i - from;
    }
    parseValueFrom(line, startCol) {
        if (startCol >= line.length)
            return null;
        const first = line[startCol];
        if (first === '"' || first === '\'' || first === '`') {
            const quote = first;
            let i = startCol + 1;
            let val = '';
            while (i < line.length) {
                const ch = line[i];
                if (ch === '\\' && i + 1 < line.length) {
                    val += ch + line[i + 1];
                    i += 2;
                    continue;
                }
                if (ch === quote) {
                    // reached end quote
                    return { value: val, startCol: startCol + 1, endCol: i };
                }
                val += ch;
                i++;
            }
            return null;
        }
        // Unquoted: attempt to match the allowed value pattern starting here
        const slice = line.slice(startCol, Math.min(line.length, startCol + 1100));
        const m = slice.match(/^[A-Za-z0-9_.+\/=~$\\-]+/);
        if (!m)
            return null;
        const candidate = m[0];
        // Try to find the longest prefix matching valueRegex
        for (let end = candidate.length; end >= 16; end--) {
            const prefix = candidate.slice(0, end);
            if (GenericSecretDetector.valueRegex.test(prefix)) {
                return { value: prefix, startCol, endCol: startCol + prefix.length };
            }
        }
        return null;
    }
    isValidSecret(value, leftCtx, rightCtx, assigned) {
        // Length/charset/backslash constraints
        if (!GenericSecretDetector.valueRegex.test(value))
            return false;
        // Backslash cannot be first or last char
        if (value.startsWith('\\') || value.endsWith('\\'))
            return false;
        // Shannon entropy >= 3
        if (this.shannonEntropy(value) < 3)
            return false;
        // At least N digits
        const digitCount = (value.match(/\d/g) || []).length;
        if (digitCount < GenericSecretDetector.minDigits)
            return false;
        // Value banlist (skip if value clearly matches a known API key format)
        const matchesKnownKey = GenericSecretDetector.knownKeyPatterns.some(r => r.test(value));
        if (!matchesKnownKey) {
            for (const r of GenericSecretDetector.valueBanlist) {
                if (r.test(value))
                    return false;
            }
        }
        // Context banlists
        for (const r of GenericSecretDetector.contextBanlistLeft) {
            if (r.test(leftCtx))
                return false;
        }
        for (const r of GenericSecretDetector.contextBanlistBoth) {
            if (r.test(leftCtx) || r.test(rightCtx))
                return false;
        }
        // Assignment banlist on the identifier
        for (const r of GenericSecretDetector.assignmentBanlist) {
            if (r.test(assigned))
                return false;
        }
        // Heuristic filters (url, date, file_name, number, heuristic_path)
        // url
        if (/https?:\/\//i.test(value) || /[a-z]+:\/\//i.test(value))
            return false;
        // date-like
        if (/^\d{4}-\d{2}-\d{2}(?:[T\s]\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:?\d{2})?)?$/.test(value))
            return false;
        if (/^\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}$/.test(value))
            return false;
        // file_name
        if (/\.[a-z0-9]{2,5}$/i.test(value))
            return false;
        // number
        if (/^-?\d+(?:\.\d+)?$/.test(value))
            return false;
        // heuristic_path (absolute or relative paths)
        if (/^\//.test(value) || /^[a-z]:\\/i.test(value) || /(^|\b)\.\.?\//.test(value) || /\\/.test(value))
            return false;
        return true;
    }
    shannonEntropy(s) {
        if (!s.length)
            return 0;
        const freq = new Map();
        for (const ch of s)
            freq.set(ch, (freq.get(ch) || 0) + 1);
        let h = 0;
        for (const [, c] of freq) {
            const p = c / s.length;
            h += -p * Math.log2(p);
        }
        return h;
    }
}
exports.GenericSecretDetector = GenericSecretDetector;
// Sensitive identifier keywords as a reusable string pattern
// Spec keywords plus common suffix-delimited KEY (e.g., SOME_KEY), avoiding 'monkey' via boundary
GenericSecretDetector.sensitiveKeyPattern = '(?:secret|token|api[_.-]?key|credential|auth|[_.-]key\\b)';
GenericSecretDetector.sensitiveKey = new RegExp(GenericSecretDetector.sensitiveKeyPattern, 'i');
// Assignment tokens to consider (order matters for multi-char tokens)
GenericSecretDetector.assignmentTokens = [":=", "=>", "<-", ":", "="];
// Value must match this charset/length pattern (with backslash rules)
// [a-zA-Z0-9_.+/~$-]([a-zA-Z0-9_.+/=~$-]|\\(?![ntr"])){14,1022}[a-zA-Z0-9_.+/=~$-]
GenericSecretDetector.valueRegex = new RegExp(String.raw `^[A-Za-z0-9_.+\/~$-](?:[A-Za-z0-9_.+\/=~$-]|\\(?![ntr"])){14,1022}[A-Za-z0-9_.+\/=~$-]$`);
// Post validators
GenericSecretDetector.minDigits = 2;
// Known API key/token patterns to override conservative banlists (e.g., 'fake', 'example')
GenericSecretDetector.knownKeyPatterns = [
    /^sk-[A-Za-z0-9_-]{16,}$/,
    /^gsk_[A-Za-z0-9_-]{16,}$/, // Groq-style keys
];
GenericSecretDetector.valueBanlist = [
    /^id[_.-]/i,
    /^mid[_.-]/i,
    /^mnp[_.-]/i,
    /^auth[_.-]/i,
    /^trnsl[_.-]/i,
    /^oqs_kem[_.-]/i,
    /^pos[_.-]/i,
    /^new[_.-]/i,
    /^aes[_.-]/i,
    /^wpa[_.-]/i,
    /^ec[_.-]/i,
    /^sec[_.-]/i,
    /^zte[_.-]/i,
    /^com\./i,
    /parentkey/i,
    /\bauto\b/i,
    /enrich/i,
    /frontend/i,
    /options/i,
    /layout/i,
    /group/i,
    /field/i,
    /gatsby/i,
    /transform/i,
    /\brandom\b/i,
    /^tls[_.-]/i,
    /\b12345\b/,
    /\b4321\b/,
    /\babcd\b/i,
    /[_.-]length$/i,
    /^pub/i,
    /\btest\b/i,
    /\bcountry\b/i,
    /template/i,
    /\.get\b/i,
    /\bget[_.-]/i,
    /preview/i,
    /\balpha\b/i,
    /\bbeta\b/i,
    /\bfake\b/i,
    /^-/,
    /keyring/i,
    /web[_.-]?app/i,
    /example/i,
    /^0x[0-9a-fA-F]+$/,
    /(^|\b)dev[\/\\_\-]/i,
    /[\/\\_\-]dev(\b|$)/i,
    /([^a-z0-9]|^)v?\d\.\d{1,3}\.\d{1,3}[_.-]/i,
    /^[0-9]{1,2}\.[0-9]{1,2}\.[0-9]{1,2}[=+]/,
    /^\/tmp\//,
    /^\$2[abxy]\$/,
    /\\u[a-f0-9]{4}/i,
    /\\x[a-f0-9]{2}/i,
    /\.(?:jpe?g|png)\b/i,
    /localhost|127\.0\.0\.1/i,
    /\b(xsrf|csrf)\b/i,
];
GenericSecretDetector.contextBanlistLeft = [
    /token_?address/i,
    /publishable_?key/i,
    /author/i,
    /sha/i,
    /propert(?:y|ies)/i,
    /foreign/i,
    /pubkey/i,
    /secret_key_base/i,
    /authenticity_token/i,
    /credentials\(['"][a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
    /(?:^|[^A-Za-z])(?:Id|ID|id)[^0-9@&\n]{0,15}[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,
];
GenericSecretDetector.contextBanlistBoth = [
    /public[_.-]?key/i,
    /key[_.-]?user/i,
    /key[_.-]?id/i,
    /token[_.-]?id/i,
    /credential[_.-]?id/i,
    /document_?key/i,
    /client[_.-]?id\b/i,
    /secret[_.-]?id\b/i,
    /licensekey/i,
    /hash|sha/i,
    /\btest\b/i,
];
GenericSecretDetector.assignmentBanlist = [
    /\bid_token\b/i,
    /(credentials|session|secrets)id/i,
    /encrypted/i,
    /postman[_-]token/i,
    /^credentialsjson$/i,
    /tokenizer/i,
    /^next[_-]?page[_-]?token$/i,
    /^previous[_-]?page[_-]?token$/i,
    /^ahoy_visit(or)?_token$/i,
    /uuid/i,
    /authorid/i,
    /algolia_search_(only_)?api_key/i,
];
//# sourceMappingURL=secretDetector.js.map