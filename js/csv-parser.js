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
                    if (cLine.startsWith('"') && cLine.endsWith('"') && cLine.length >= 2) {
                        // Check if it's the wrapped format. If it has "" inside, it's highly likely
                        if (cLine.includes('""')) {
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
        const row1 = this.parseLine(lines[0]); // Metrics
        const row3 = this.parseLine(lines[2]); // Product names (?) actually row3 is "Additional Sales Basket", row2 is "KPI"
        const row4 = this.parseLine(lines[3]); // Dates (e.g. 202626)
        
        const results = [];
        // Data starts at row 5
        for (let i = 4; i < lines.length; i++) {
            const cols = this.parseLine(lines[i]);
            if (cols.length < 4) continue;
            
            const employee = cols[0];
            const product = cols[1];
            if (!employee || !product || product.toLowerCase() === 'total') continue;
            
            // Iterate over date columns
            for (let c = 2; c < cols.length; c += 2) {
                const dateStr = row4[c];
                if (!dateStr || dateStr.toLowerCase() === 'total') continue;
                
                const year = parseInt(dateStr.substring(0, 4));
                const week = parseInt(dateStr.substring(4, 6));
                const date = this.getDateFromWeek(year, week);
                
                const nbEvents = parseFloat(cols[c].replace(/\./g, '').replace(',', '.'));
                const aoitGew = parseFloat(cols[c+1].replace(/\./g, '').replace(',', '.'));
                
                if (isNaN(nbEvents) && isNaN(aoitGew)) continue;
                
                const dataObj = {
                    "Product": product,
                    "Nb Events": isNaN(nbEvents) ? 0 : nbEvents,
                    "AOIT gew": isNaN(aoitGew) ? 0 : aoitGew
                };
                
                results.push({ year: year.toString(), date, employee, data: dataObj, category: 'sales' });
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
            
            // Since this is a different structure from AOIT but still 'sales', 
            // we give it "Product: Nuovi Abo" so it can be distinguished, or just group them.
            dataObj["Product"] = "Nuovi Abo";
            
            results.push({ year: year.toString(), date, employee, data: dataObj, category: 'sales' });
        }
        return results;
    }
}

window.CSVParser = CSVParser;
