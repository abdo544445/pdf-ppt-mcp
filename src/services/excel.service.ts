import * as xlsx from 'xlsx';

export class ExcelService {
    static getSheets(filePath: string): string[] {
        const workbook = xlsx.readFile(filePath);
        return workbook.SheetNames;
    }

    static getSheetData(filePath: string, sheetName: string): string {
        const workbook = xlsx.readFile(filePath);
        if (!workbook.SheetNames.includes(sheetName)) {
            throw new Error(`Sheet "${sheetName}" not found. Available sheets: ${workbook.SheetNames.join(', ')}`);
        }

        const sheet = workbook.Sheets[sheetName];
        // Convert to CSV for clean LLM readability
        return xlsx.utils.sheet_to_csv(sheet, { blankrows: false });
    }

    /**
     * Returns a JSON representation of the sheet rows for richer queries.
     */
    static getSheetAsJson(filePath: string, sheetName: string): Record<string, any>[] {
        const workbook = xlsx.readFile(filePath);
        if (!workbook.SheetNames.includes(sheetName)) {
            throw new Error(`Sheet "${sheetName}" not found.`);
        }
        const sheet = workbook.Sheets[sheetName];
        return xlsx.utils.sheet_to_json(sheet);
    }
}
