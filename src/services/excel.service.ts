import * as xlsx from 'xlsx';

export class ExcelService {
    static async getSheets(filePath: string): Promise<string[]> {
        const workbook = xlsx.readFile(filePath);
        return workbook.SheetNames;
    }

    static async getSheetData(filePath: string, sheetName: string): Promise<string> {
        const workbook = xlsx.readFile(filePath);
        if (!workbook.SheetNames.includes(sheetName)) {
            throw new Error(`Sheet ${sheetName} not found in document`);
        }

        const sheet = workbook.Sheets[sheetName];
        // Convert to CSV for readability by the LLM
        return xlsx.utils.sheet_to_csv(sheet);
    }
}
