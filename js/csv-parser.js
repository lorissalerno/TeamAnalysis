/**
 * TeamAnalysis
 * © Copyright 2026 Loris Salerno (TAASALO3) - loris.salerno@swisscom.com
 * Tutti i diritti riservati.
 */
class CSVParser {
    static async parse(file, startDate) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            // Read as UTF-16LE as per our tests
            reader.readAsText(file, "UTF-16LE");
            reader.onload = (e) => {
                let text = e.target.result;
                // Remove BOM if present
                if (text.charCodeAt(0) === 0xFEFF) {
                    text = text.slice(1);
                }
                
                const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
                if (lines.length === 0) return reject("File vuoto");

                // Auto-detect type from first row (raw, prima di ogni pulizia)
                let type = 'unknown';
                const headerLower = (lines[0] || '').toLowerCase();
                if (headerLower.includes("voice inbound")) {
                    type = 'performance';
                } else if (headerLower.includes("aoit")) {
                    type = 'sales_aoit';
                } else if (headerLower.includes("open year sales event")) {
                    type = 'sales_nuovi';
                } else if (headerLower.includes("login duration") || headerLower.includes("state rcode") || headerLower.includes("state duration")) {
                    type = 'stati';
                }

                // Per gli stati ogni riga è una singola cella incapsulata: cleanLine
                // de-escaperebbe le virgolette e romperebbe il campo nome (con virgola interna).
                // Quindi per 'stati' NON applichiamo cleanLine e processiamo le righe raw.
                let cleanedLines;
                if (type === 'stati') {
                    cleanedLines = lines;
                } else {
                    cleanedLines = lines.map(line => {
                        let cLine = line.trim();
                        if (cLine.startsWith('"') && cLine.endsWith('"')) {
                            let hasUnquotedComma = false;
                            let inQuotes = false;
                            for(let i=0; i<cLine.length; i++) {
                                if(cLine[i] === '"') {
                                    if(i+1 < cLine.length && cLine[i+1] === '"') {
                                        i++; // skip escaped quote
                                    } else {
                                        inQuotes = !inQuotes;
                                    }
                                } else if(cLine[i] === ',' && !inQuotes) {
                                    hasUnquotedComma = true;
                                    break;
                                }
                            }
                            if (!hasUnquotedComma) {
                                cLine = cLine.substring(1, cLine.length - 1).replace(/""/g, '"');
                            }
                        }
                        return cLine;
                    });
                }

                try {
                    let parsedData = [];
                    if (type === 'performance') {
                        parsedData = this.parsePerformance(cleanedLines);
                    } else if (type === 'sales_aoit') {
                        parsedData = this.parseSalesAOIT(cleanedLines);
                    } else if (type === 'sales_nuovi') {
                        parsedData = this.parseSalesNuovi(cleanedLines);
                    } else if (type === 'stati') {
                        parsedData = this.parseStati(cleanedLines);
                    } else {
                        throw new Error(`Formato CSV non riconosciuto. Intestazione trovata: "${cleanedLines[0].substring(0, 50)}..."`);
                    }

                    // Filter by startDate if provided
                    if (startDate) {
                        parsedData = parsedData.filter(d => d.date >= startDate);
                    }
                    
                    resolve({ type, data: parsedData });
                } catch (err) {
                    reject(err.message);
                }
            };
            reader.onerror = () => reject("Errore lettura file");
        });
    }

    // Helper to parse a standard CSV line honoring quotes
    static parseLine(line) {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (inQuotes) {
                if (char === '"') {
                    if (i + 1 < line.length && line[i+1] === '"') {
                        cur += '"';
                        i++; // skip escaped quote
                    } else {
                        inQuotes = false;
                    }
                } else {
                    cur += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === ',') {
                    result.push(cur);
                    cur = '';
                } else {
                    cur += char;
                }
            }
        }
        result.push(cur);
        return result.map(s => s.trim());
    }

    // Converts formats like 202601 (month 1) or 202626 (week 26) to YYYY-MM-DD
    static normalizeDate(dateStr) {
        if (!dateStr || dateStr.toLowerCase() === 'total') return null;
        dateStr = dateStr.trim();
        if (dateStr.length === 6) {
            const year = parseInt(dateStr.substring(0, 4));
            const part = parseInt(dateStr.substring(4, 6));
            
            // Guess if it's month or week based on value (month 1-12, week can be > 12)
            // But wait, what if it's week 02? Usually Nuovi Abo is monthly, AOIT is weekly.
            // Let's assume if we call this from Nuovi, it's monthly. From AOIT, it's weekly.
            return null; // Will handle specifically in parsers
        }
        return null;
    }
    
    static getDateFromWeek(year, week) {
        // Simple approximation: first week starts roughly Jan 1st.
        const d = new Date(year, 0, 1);
        const days = (week - 1) * 7;
        d.setDate(d.getDate() + days);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    static getDateFromMonth(year, month) {
        const m = String(month).padStart(2, '0');
        return `${year}-${m}-01`;
    }

    static parsePerformance(lines) {
        const headers = this.parseLine(lines[0]);
        const employeeIdx = headers.findIndex(h => h.includes("Employee") && !h.includes("Org"));
        const monthIdx = headers.findIndex(h => h.includes("Month"));
        
        if (employeeIdx === -1 || monthIdx === -1) throw new Error("Header Performance non validi");
        
        const results = [];
        for (let i = 1; i < lines.length; i++) {
            const cols = this.parseLine(lines[i]);
            if (cols.length < headers.length) continue;
            
            const employee = cols[employeeIdx];
            const dateStr = cols[monthIdx];
            
            if (!employee || !dateStr || dateStr.toLowerCase() === 'total' || employee.trim() === '') continue;
            
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6));
            const date = this.getDateFromMonth(year, month);
            
            const dataObj = {};
            for (let j = 0; j < cols.length; j++) {
                if (j !== employeeIdx && j !== monthIdx && headers[j] && !headers[j].includes("Org")) {
                    const val = parseFloat(cols[j].replace(/\./g, '').replace(',', '.'));
                    dataObj[headers[j]] = isNaN(val) ? 0 : val;
                }
            }
            
            results.push({ year: year.toString(), date, employee, data: dataObj, category: 'performance' });
        }
        return results;
    }

    static parseStati(lines) {
        const headers = this.parseStatiHeader(lines[0]);
        const employeeIdx = headers.findIndex(h => h.includes("Employee") && !h.includes("Org"));
        const monthIdx = headers.findIndex(h => h.includes("Month"));
        if (employeeIdx === -1 || monthIdx === -1) throw new Error("Header Stati non validi");

        const results = [];
        for (let i = 1; i < lines.length; i++) {
            // Ogni riga dati è una singola cella incapsulata: "Nome""202601"",""110"",...
            // Togliamo il wrapper e de-escapiamo, ottenendo: Nome"202601","110","85,1%",...
            let line = lines[i].trim();
            if (line.startsWith('"') && line.endsWith('"')) {
                line = line.substring(1, line.length - 1).replace(/""/g, '"');
            }

            let employee = '';
            let dateStr = '';
            let valueCols;
            let headerOffset = 0;

            // Nel formato incapsulato il primo "campo" contiene nome e mese uniti:
            // Nome"202601" seguito dai valori "110","85,1%",...
            const firstSep = line.indexOf('","');
            if (firstSep !== -1) {
                const empMonthField = line.slice(0, firstSep + 1);
                const inner = empMonthField.split('"');
                employee = (inner[0] || '').trim();
                dateStr = (inner[1] || '').trim();
                const rest = line.slice(firstSep + 1);
                valueCols = this.parseLine(rest);
                headerOffset = 1;
                // valueCols[0] è vuoto (virgola iniziale): i valori partono da idx 1
            } else {
                const cols = this.parseLine(line);
                employee = (cols[employeeIdx] || '').trim();
                dateStr = (cols[monthIdx] || '').trim();
                valueCols = cols;
            }

            if (!employee || !dateStr || dateStr.toLowerCase() === 'total') continue;

            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6));
            if (isNaN(year) || isNaN(month)) continue;
            const date = this.getDateFromMonth(year, month);

            const dataObj = {};
            const startIdx = headerOffset === 1 ? 1 : (monthIdx + 1);
            for (let j = startIdx; j < valueCols.length && (j + headerOffset) < headers.length; j++) {
                const hKey = headers[j + headerOffset];
                if (!hKey || hKey.includes("Org")) continue;
                const key = hKey.replace(/^State Duration /, '').replace(/^State Rcode - /, '');
                const val = parseFloat((valueCols[j] || '').replace(/\./g, '').replace(',', '.'));
                dataObj[key] = isNaN(val) ? 0 : val;
            }

            results.push({ year: year.toString(), date, employee, data: dataObj, category: 'stati' });
        }
        return results;
    }

    // Estrae gli header degli stati gestendo la riga header incapsulata
    static parseStatiHeader(line) {
        let headerLine = line;
        if (headerLine.startsWith('"') && headerLine.endsWith('"')) {
            headerLine = headerLine.substring(1, headerLine.length - 1).replace(/""/g, '"');
        }
        return this.parseLine(headerLine);
    }

    static parseSalesAOIT(lines) {
        // Individua la riga contenente le intestazioni di data (stringhe da 6 cifre come 202626 o 202601)
        let dateRowIdx = -1;
        let dateRow = [];
        
        for (let i = 0; i < Math.min(10, lines.length); i++) {
            const cols = this.parseLine(lines[i]);
            const hasDateCols = cols.some(c => /^\d{6}$/.test(c.trim()));
            if (hasDateCols) {
                dateRowIdx = i;
                dateRow = cols;
                break;
            }
        }
        
        if (dateRowIdx === -1) {
            dateRowIdx = 3;
            dateRow = this.parseLine(lines[3] || '');
        }

        // Rileva se il file contiene dati mensili o settimanali
        const fullHeaderStr = lines.slice(0, dateRowIdx + 1).join(' ').toLowerCase();
        const hasMonthKeyword = fullHeaderStr.includes('month') || fullHeaderStr.includes('monat') || fullHeaderStr.includes('mese');
        
        let hasWeekNumGreaterThan12 = false;
        for (let c = 2; c < dateRow.length; c++) {
            const dateStr = dateRow[c] ? dateRow[c].trim() : '';
            if (/^\d{6}$/.test(dateStr)) {
                const part = parseInt(dateStr.substring(4, 6));
                if (part > 12) {
                    hasWeekNumGreaterThan12 = true;
                    break;
                }
            }
        }

        const isWeekly = hasWeekNumGreaterThan12 || (!hasMonthKeyword);

        const results = [];
        for (let i = dateRowIdx + 1; i < lines.length; i++) {
            const cols = this.parseLine(lines[i]);
            if (cols.length < 3) continue;
            
            const employee = cols[0] ? cols[0].trim() : '';
            const product = cols[1] ? cols[1].trim() : '';
            
            if (!employee || !product || product.toLowerCase() === 'total' || employee.toLowerCase() === 'total') continue;
            
            for (let c = 2; c < cols.length; c += 2) {
                const dateStr = dateRow[c] ? dateRow[c].trim() : '';
                if (!dateStr || dateStr.toLowerCase() === 'total' || !/^\d{6}$/.test(dateStr)) continue;
                
                const year = parseInt(dateStr.substring(0, 4));
                const part = parseInt(dateStr.substring(4, 6));
                
                const date = isWeekly
                    ? this.getDateFromWeek(year, part)
                    : this.getDateFromMonth(year, part);
                
                const rawNbStr = cols[c] ? cols[c].replace(/\./g, '').replace(',', '.').trim() : '';
                const rawGewStr = (c + 1 < cols.length && cols[c + 1]) ? cols[c + 1].replace(/\./g, '').replace(',', '.').trim() : '';
                
                const rawNbEvents = parseFloat(rawNbStr);
                const rawAoitGew = parseFloat(rawGewStr);
                
                if (isNaN(rawNbEvents) || rawNbEvents <= 0) continue;
                
                const count = Math.round(rawNbEvents);
                const totalGew = isNaN(rawAoitGew) ? 0 : rawAoitGew;
                const unitGew = count > 0 ? (totalGew / count) : 0;
                
                // Dividi in N record singoli di vendita
                for (let k = 0; k < count; k++) {
                    // Normalize product name: hide variants like 'AOIT gew'
                    let productNormalized = product;
                    if (productNormalized && productNormalized.toLowerCase().includes('aoit')) {
                        productNormalized = 'AOIT';
                    }

                    const dataObj = {
                        "Product": productNormalized,
                        "Nb Events": 1,
                        "AOIT": Math.round(unitGew)
                    };
                    results.push({ year: year.toString(), date, employee, skill: 'AOIT', data: dataObj, category: 'sales' });
                }
            }
        }
        return results;
    }

    static parseSalesNuovi(lines) {
        let headerRowIdx = 2;
        for (let i = 0; i < Math.min(5, lines.length); i++) {
            const parsed = this.parseLine(lines[i]);
            if (parsed.some(c => c.includes("ACQ") || c.includes("RET"))) {
                headerRowIdx = i;
                break;
            }
        }
        const headers = this.parseLine(lines[headerRowIdx]);
        
        const getProductName = (header) => {
            const h = header.trim();
            if (h === "W- Value ACQ") return "Nuovo Mobile";
            if (h === "W+ BB ACQ") return "Nuovo Internet";
            if (h === "W+ TV with STB ACQ") return "Nuovo TV";
            if (h === "W- Value RET & W+ RET") return "Retention";
            
            if (h.includes("W- Value ACQ") || h.includes("Mobile")) return "Nuovo Mobile";
            if (h.includes("BB ACQ")) return "Nuovo Internet";
            if (h.includes("TV")) return "Nuovo TV";
            if (h.includes("RET")) return "Retention";
            
            return h;
        };

        const results = [];
        for (let i = headerRowIdx + 1; i < lines.length; i++) {
            const cols = this.parseLine(lines[i]);
            if (cols.length < 3) continue;
            
            const yearStr = cols[0] ? cols[0].trim() : '';
            const employee = cols[1] ? cols[1].trim() : '';
            const dateStr = cols[2] ? cols[2].trim() : '';
            
            if (!employee || !dateStr || dateStr.toLowerCase() === 'total' || employee.toLowerCase() === 'total') continue;
            
            let date = null;
            let year = parseInt(yearStr);
            if (isNaN(year)) year = new Date().getFullYear();

            if (/^\d{6}$/.test(dateStr)) {
                const y = parseInt(dateStr.substring(0, 4));
                const m = parseInt(dateStr.substring(4, 6));
                date = this.getDateFromMonth(y, m);
                year = y;
            } else {
                continue;
            }

            for (let c = 3; c < cols.length; c++) {
                const rawHeader = headers[c];
                if (!rawHeader) continue;

                const rawVal = cols[c] ? cols[c].replace(/\./g, '').replace(',', '.').trim() : '';
                const val = parseFloat(rawVal);
                if (isNaN(val) || val <= 0) continue;

                const productName = getProductName(rawHeader);
                const dataObj = {
                    "Product": productName,
                    [rawHeader.trim()]: val,
                    "Nb Events": val
                };

                results.push({
                    year: year.toString(),
                    date,
                    employee,
                    skill: productName,
                    data: dataObj,
                    category: 'sales'
                });
            }
        }
        return results;
    }
}

window.CSVParser = CSVParser;
