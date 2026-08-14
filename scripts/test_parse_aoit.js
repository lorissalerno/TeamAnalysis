const fs = require('fs');
const vm = require('vm');
const path = require('path');

try {
    const parserPath = path.join(__dirname, '../js/csv-parser.js');
    const parserSrc = fs.readFileSync(parserPath, 'utf8');

    const context = { console, window: {} };
    vm.createContext(context);
    vm.runInContext(parserSrc, context);
    const CSVParser = context.window.CSVParser;
    if (!CSVParser) throw new Error('CSVParser not loaded');

    const samplePath = path.join(__dirname, '../Esempi_csv/AOIT.csv');
    const buf = fs.readFileSync(samplePath);
    let text = buf.toString('utf16le');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);

    const parsed = CSVParser.parseSalesAOIT(lines);
    console.log('Parsed records:', parsed.length);
    const products = parsed.slice(0, 200).map(r => r.data && r.data.Product).filter(Boolean);
    console.log('Unique Product values (sample):', [...new Set(products)].slice(0,20));
    console.log('First 5 entries preview:', parsed.slice(0,5));
} catch (err) {
    console.error('ERROR', err);
    process.exitCode = 2;
}
