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

                // Clean the lines (remove full-line wrapping quotes and unescape)
                const cleanedLines = lines.map(line => {
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

                // Auto-detect type from first few rows
                let type = 'unknown';
                if (cleanedLines[0].includes("Voice Inbound")) {
                    type = 'performance';
                } else if (cleanedLines[0].includes("AOIT gew")) {
                    type = 'sales_aoit';
                } else if (cleanedLines[0].includes("Open Year Sales Event")) {
                    type = 'sales_nuovi';
                }

                try {
                    let parsedData = [];
                    if (type === 'performance') {
                        parsedData = this.parsePerformance(cleanedLines);
                    } else if (type === 'sales_aoit') {
                        parsedData = this.parseSalesAOIT(cleanedLines);
                    } else if (type === 'sales_nuovi') {
                        parsedData = this.parseSalesNuovi(cleanedLines);
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
                    const dataObj = {
                        "Product": product,
                        "Nb Events": 1,
                        "AOIT gew": Math.round(unitGew * 100) / 100
                    };
                    results.push({ year: year.toString(), date, employee, skill: 'AOIT', data: dataObj, category: 'sales' });
                }
            }
        }
        return results;
    }

    static parseSalesNuovi(lines) {
        const headers = this.parseLine(lines[2]); // Metrics like "W- Value ACQ"
        
        const results = [];
        // Data starts at row 4
        for (let i = 3; i < lines.length; i++) {
            const cols = this.parseLine(lines[i]);
            if (cols.length < 4) continue;
            
            const yearStr = cols[0];
            const employee = cols[1];
            const dateStr = cols[2];
            
            if (!employee || !dateStr || dateStr.toLowerCase() === 'total') continue;
            
            const year = parseInt(yearStr);
            let date = null;
            if (dateStr.length >= 6) {
                const y = parseInt(dateStr.substring(0, 4));
                const m = parseInt(dateStr.substring(4, 6));
                date = this.getDateFromMonth(y, m);
            } else {
                continue;
            }
            
            const dataObj = {};
            for (let c = 3; c < cols.length; c++) {
                if (headers[c]) {
                    const val = parseFloat(cols[c].replace(/\./g, '').replace(',', '.'));
                    dataObj[headers[c]] = isNaN(val) ? 0 : val;
                }
            }
            
            dataObj["Product"] = "Nuovi Abo";
            
            results.push({ year: year.toString(), date, employee, skill: 'Nuovi Abo', data: dataObj, category: 'sales' });
        }
        return results;
    }
}

window.CSVParser = CSVParser;
