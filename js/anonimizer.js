/**
 * TeamAnalysis - Anonimizzazione CSV - By Loris Salerno (taasalo3) - Loris.Salerno@swisscom.com
 *
 * Sostituisce i nomi dei collaboratori (colonna Employee) nei file CSV con nomi
 * fittizi predefiniti, mantenendo la stessa mappatura tra tutti i file selezionati.
 */
window.Anonymizer = (function() {
    const ANON_NAMES = [
        "Luigi Bianchi",
        "Marco Rossi",
        "Giulia Esposito",
        "Paolo Colombo",
        "Francesca Ricci",
        "Alessandro Romano",
        "Elena Gallo",
        "Davide Conti",
        "Sara Marino",
        "Andrea Greco",
        "Martina Bruno",
        "Stefano Costa",
        "Chiara Fontana",
        "Matteo Moretti",
        "Valentina Mancini",
        "Simone Rizzo",
        "Alessia Lombardi",
        "Federico Barbieri",
        "Silvia Santoro",
        "Luca Marchetti",
        "Emanuele Rinaldi",
        "Anna Ferrara",
        "Giorgio Caruso",
        "Claudia Leone",
        "Riccardo Longo",
        "Beatrice Gentile",
        "Tommaso Martinelli",
        "Viola Vitale",
        "Gabriele De Luca",
        "Serena Morelli"
    ];

    // Replica il cleaning del parser (rimozione virgolette di wrapping e de-escape)
    function cleanLine(line) {
        let cLine = line.trim();
        if (cLine.startsWith('"') && cLine.endsWith('"')) {
            let hasUnquotedComma = false;
            let inQuotes = false;
            for (let i = 0; i < cLine.length; i++) {
                if (cLine[i] === '"') {
                    if (i + 1 < cLine.length && cLine[i + 1] === '"') {
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (cLine[i] === ',' && !inQuotes) {
                    hasUnquotedComma = true;
                    break;
                }
            }
            if (!hasUnquotedComma) {
                cLine = cLine.substring(1, cLine.length - 1).replace(/""/g, '"');
            }
        }
        return cLine;
    }

    // Individua l'intervallo di ogni campo in una riga CSV standard
    function findFieldRanges(line) {
        const ranges = [];
        let i = 0;
        const n = line.length;
        while (i < n) {
            while (i < n && (line[i] === ',' || line[i] === ' ')) i++;
            if (i >= n) break;
            const start = i;
            let j = i;
            if (line[j] === '"') {
                j++;
                while (j < n) {
                    if (line[j] === '"') {
                        if (j + 1 < n && line[j + 1] === '"') {
                            j += 2;
                            continue;
                        }
                        j++;
                        break;
                    }
                    j++;
                }
            } else {
                while (j < n && line[j] !== ',') j++;
            }
            ranges.push({ start, end: j });
            i = j;
        }
        return ranges;
    }

    function fieldValue(line, range) {
        if (!range) return '';
        const raw = line.slice(range.start, range.end);
        if (raw[0] === '"') {
            return raw.slice(1, raw.length - 1).replace(/""/g, '"');
        }
        return raw.trim();
    }

    function detectType(cleanLines) {
        const headerLower = (cleanLines[0] || '').toLowerCase();
        if (headerLower.includes("voice inbound")) return 'performance';
        if (headerLower.includes("aoit")) return 'sales_aoit';
        if (headerLower.includes("open year sales event")) return 'sales_nuovi';
        return 'unknown';
    }

    function getLayout(cleanLines, type) {
        if (type === 'performance') {
            const headers = window.CSVParser.parseLine(cleanLines[0]);
            const employeeIdx = headers.findIndex(h => h.includes("Employee") && !h.includes("Org"));
            if (employeeIdx === -1) return null;
            return { employeeIdx, dataStartIdx: 1 };
        }
        if (type === 'sales_aoit') {
            let dateRowIdx = -1;
            for (let i = 0; i < Math.min(10, cleanLines.length); i++) {
                const cols = window.CSVParser.parseLine(cleanLines[i]);
                if (cols.some(c => /^\d{6}$/.test(c.trim()))) {
                    dateRowIdx = i;
                    break;
                }
            }
            if (dateRowIdx === -1) dateRowIdx = 3;
            return { employeeIdx: 0, dataStartIdx: dateRowIdx + 1 };
        }
        if (type === 'sales_nuovi') {
            let headerRowIdx = 2;
            for (let i = 0; i < Math.min(5, cleanLines.length); i++) {
                const parsed = window.CSVParser.parseLine(cleanLines[i]);
                if (parsed.some(c => c.includes("ACQ") || c.includes("RET"))) {
                    headerRowIdx = i;
                    break;
                }
            }
            return { employeeIdx: 1, dataStartIdx: headerRowIdx + 1 };
        }
        return null;
    }

    function shuffleArray(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const tmp = a[i];
            a[i] = a[j];
            a[j] = tmp;
        }
        return a;
    }

    async function readFile(file) {
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let encoding;
        if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
            encoding = 'utf-16le';
        } else if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
            encoding = 'utf-16be';
        } else if (bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
            encoding = 'utf-8';
        } else {
            const sample = bytes.slice(0, Math.min(bytes.length, 2048));
            encoding = sample.includes(0) ? 'utf-16le' : 'utf-8';
        }
        let text = new TextDecoder(encoding).decode(buf);
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
        const lines = text.split(/\r?\n/);
        return { text, lines, encoding };
    }

    function encodeText(text, encoding) {
        if (encoding === 'utf-16le' || encoding === 'utf-16be') {
            const be = encoding === 'utf-16be';
            const arr = new Uint8Array(2 + text.length * 2);
            if (be) {
                arr[0] = 0xFE;
                arr[1] = 0xFF;
            } else {
                arr[0] = 0xFF;
                arr[1] = 0xFE;
            }
            let o = 2;
            for (let i = 0; i < text.length; i++) {
                const c = text.charCodeAt(i);
                if (be) {
                    arr[o++] = c >> 8;
                    arr[o++] = c & 0xFF;
                } else {
                    arr[o++] = c & 0xFF;
                    arr[o++] = c >> 8;
                }
            }
            return arr;
        }
        return new TextEncoder().encode(text);
    }

    async function anonymizeFiles(fileList) {
        const files = [];
        const errors = [];

        for (const file of fileList) {
            try {
                const { lines, encoding } = await readFile(file);
                const cleanLines = lines.map(cleanLine);
                const type = detectType(cleanLines);
                const layout = getLayout(cleanLines, type);
                if (type === 'unknown' || !layout) {
                    errors.push(`"${file.name}": Formato CSV non riconosciuto.`);
                    continue;
                }
                files.push({ name: file.name, type, encoding, lines, cleanLines, layout });
            } catch (e) {
                errors.push(`"${file.name}": ${e.message || e}`);
            }
        }

        if (files.length === 0) {
            return { ok: false, errors, files: [], mapping: {} };
        }

        // Raccogli i nomi unici in ordine di prima comparsa (su tutti i file)
        const employeeList = [];
        const seen = new Set();
        for (const f of files) {
            for (let i = f.layout.dataStartIdx; i < f.cleanLines.length; i++) {
                const cols = window.CSVParser.parseLine(f.cleanLines[i]);
                const emp = cols[f.layout.employeeIdx];
                if (!emp) continue;
                const t = emp.trim();
                if (!t || t.toLowerCase() === 'total') continue;
                if (!seen.has(t)) {
                    seen.add(t);
                    employeeList.push(t);
                }
            }
        }

        const shuffled = shuffleArray(ANON_NAMES);
        const mapping = {};
        employeeList.forEach((e, i) => {
            mapping[e] = i < shuffled.length ? shuffled[i] : `Collab ${i + 1}`;
        });

        const outputs = [];
        for (const f of files) {
            const outLines = f.lines.slice();
            for (let i = f.layout.dataStartIdx; i < f.lines.length; i++) {
                const rawLine = f.lines[i];
                if (!rawLine) continue;
                const clean = cleanLine(rawLine);
                const ranges = findFieldRanges(clean);
                const empRange = ranges[f.layout.employeeIdx];
                if (!empRange) continue;
                const emp = fieldValue(clean, empRange).trim();
                if (!emp || emp.toLowerCase() === 'total') continue;
                const anon = mapping[emp];
                if (!anon) continue;
                const newField = `"${anon}"`;
                outLines[i] = clean.slice(0, empRange.start) + newField + clean.slice(empRange.end);
            }
            const outText = outLines.join('\r\n');
            const blob = new Blob([encodeText(outText, f.encoding)], { type: 'text/csv' });
            const base = f.name.replace(/\.csv$/i, '');
            outputs.push({ name: `${base}_anonimizzato.csv`, blob, encoding: f.encoding, original: f.name, type: f.type });
        }

        return { ok: true, errors, files: outputs, mapping };
    }

    return {
        anonymizeFiles,
        ANON_NAMES
    };
})();
