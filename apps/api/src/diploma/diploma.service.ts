import { Injectable, Logger } from '@nestjs/common';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

export interface DiplomaData {
  ime_prezime: string;
  nastavna_godina?: string;
  datum: string;
  nivo?: string;
  kategorija?: string;
  godina?: string; // For TAKMICENJE type
}

@Injectable()
export class DiplomaService {
  private readonly logger = new Logger(DiplomaService.name);
  private readonly pdfPath: string;

  constructor() {
    // Find PDF directory - try multiple possible paths (works in Docker and local)
    const basePath = process.cwd();
    const possiblePaths = [
      path.join(basePath, 'assets', 'pdf'), // Docker: /app/apps/api/assets/pdf (when cwd is /app/apps/api)
      path.join(basePath, 'apps', 'api', 'assets', 'pdf'), // Local dev (when cwd is project root)
      path.join(basePath, '..', '..', 'assets', 'pdf'), // From /app/apps/api -> /app/assets/pdf
      path.join(__dirname, '..', '..', '..', 'assets', 'pdf'), // From compiled code
      path.join(__dirname, '..', '..', 'assets', 'pdf'), // Alternative
    ];

    let foundPath: string | null = null;
    for (const possiblePath of possiblePaths) {
      if (fs.existsSync(possiblePath)) {
        foundPath = possiblePath;
        this.logger.log(`✅ PDF directory found: ${foundPath}`);
        break;
      }
    }

    if (!foundPath) {
      this.logger.warn(`⚠️ PDF directory not found. Tried: ${possiblePaths.join(', ')}`);
      // Use first path as default
      this.pdfPath = possiblePaths[0];
    } else {
      this.pdfPath = foundPath;
    }
  }

  private getPdfFileName(type: string): string {
    const mapping: Record<string, string> = {
      'DOBRI_REZULTATI': 'DOBRI REZULTATI.pdf',
      'ILMIHAL': 'ILMIHAL.pdf',
      'NAJREDOVNIJI_UCENIK': 'NAJREDOVNIJI UCENIK.pdf',
      'POSEBAN_DOPRINOS_I_ZALAGANJE': 'POSEBAN DOPRINOS I ZALAGANJE.pdf',
      'SUFARA': 'SUFARA.pdf',
      'TAKMICENJE': 'TAKMICENJE.pdf',
    };
    return mapping[type] || '';
  }

  async generateDiploma(type: string, data: DiplomaData): Promise<Buffer> {
    try {
      const pdfFileName = this.getPdfFileName(type);
      if (!pdfFileName) {
        throw new Error(`Nepoznat tip diplome: ${type}`);
      }

      const pdfFilePath = path.join(this.pdfPath, pdfFileName);
      
      if (!fs.existsSync(pdfFilePath)) {
        throw new Error(`PDF fajl nije pronađen: ${pdfFilePath}`);
      }

      // Read the PDF template
      const templateBytes = fs.readFileSync(pdfFilePath);
      const pdfDoc = await PDFDocument.load(templateBytes);

      // Register fontkit for custom fonts (Bitter font support)
      try {
        const fontkit = require('@pdf-lib/fontkit');
        pdfDoc.registerFontkit(fontkit);
        this.logger.debug('Fontkit registered successfully');
      } catch (fontkitError) {
        this.logger.warn('Fontkit not available, continuing without it. Install @pdf-lib/fontkit for better font support.');
      }

      // Load Bitter font if needed (for fallback or future use)
      let bitterFont: any = null;
      try {
        const fontPaths = [
          path.join(process.cwd(), 'fonts', 'Bitter', 'static', 'Bitter-Regular.ttf'),
          path.join(process.cwd(), '..', '..', 'fonts', 'Bitter', 'static', 'Bitter-Regular.ttf'),
          path.join(process.cwd(), '..', 'fonts', 'Bitter', 'static', 'Bitter-Regular.ttf'),
          path.join(__dirname, '..', '..', '..', '..', 'fonts', 'Bitter', 'static', 'Bitter-Regular.ttf'),
          path.join(__dirname, '..', '..', '..', '..', '..', 'fonts', 'Bitter', 'static', 'Bitter-Regular.ttf'),
        ];

        for (const fontPath of fontPaths) {
          if (fs.existsSync(fontPath)) {
            const fontBytes = fs.readFileSync(fontPath);
            bitterFont = await pdfDoc.embedFont(fontBytes);
            this.logger.debug(`Bitter font loaded from: ${fontPath}`);
            break;
          }
        }

        if (!bitterFont) {
          this.logger.debug('Bitter font not found, using default fonts');
        }
      } catch (fontError) {
        this.logger.warn(`Could not load Bitter font: ${fontError}`);
        // Continue without custom font
      }

      // Try to fill form fields first
      try {
        const form = pdfDoc.getForm();
        const fields = form.getFields();

        // Format date
        const dateObj = new Date(data.datum);
        const formattedDate = dateObj.toLocaleDateString('bs-BA', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });

        // Map data fields to PDF form fields (try common field names)
        const fieldMapping: Record<string, string> = {
          'ime_prezime': data.ime_prezime,
          'imePrezime': data.ime_prezime,
          'ime': data.ime_prezime,
          'name': data.ime_prezime,
          'datum': formattedDate,
          'date': formattedDate,
        };

        if (data.nastavna_godina) {
          fieldMapping['nastavna_godina'] = data.nastavna_godina;
          fieldMapping['nastavnaGodina'] = data.nastavna_godina;
          fieldMapping['godina'] = data.nastavna_godina;
          fieldMapping['year'] = data.nastavna_godina;
        }

        if (data.nivo) {
          fieldMapping['nivo'] = data.nivo;
          fieldMapping['level'] = data.nivo;
        }

        if (data.kategorija) {
          fieldMapping['kategorija'] = data.kategorija;
          fieldMapping['category'] = data.kategorija;
        }

        if (data.godina && !data.nastavna_godina) {
          // For TAKMICENJE type, godina is separate from nastavna_godina
          fieldMapping['godina'] = data.godina;
          fieldMapping['year'] = data.godina;
        }

        // Try to fill form fields
        let fieldsFilled = 0;
        for (const field of fields) {
          const fieldName = field.getName().toLowerCase();
          
          // Try to find matching field
          for (const [key, value] of Object.entries(fieldMapping)) {
            if (fieldName.includes(key.toLowerCase()) || key.toLowerCase().includes(fieldName)) {
              try {
                const textField = form.getTextField(field.getName());
                textField.setText(value);
                fieldsFilled++;
                this.logger.debug(`Filled field "${field.getName()}" with "${value}"`);
                break;
              } catch (e) {
                // Field might not be a text field, skip
              }
            }
          }
        }

        this.logger.log(`Filled ${fieldsFilled} form fields for type ${type}`);

        // If we filled at least one field, save and return
        if (fieldsFilled > 0) {
          const pdfBytes = await pdfDoc.save();
          return Buffer.from(pdfBytes);
        }
      } catch (formError) {
        this.logger.warn(`PDF does not have form fields or error filling them: ${formError}`);
        // Fall through to drawText method
      }

      // Fallback: Use drawText with coordinates
      // Note: Coordinates will need to be adjusted based on actual PDF layout
      // For now, we'll try to use form fields only
      // If form fields don't exist, this will need coordinate mapping per PDF type

      const pdfBytes = await pdfDoc.save();
      return Buffer.from(pdfBytes);
    } catch (error) {
      this.logger.error(`Error generating diploma for type ${type}:`, error);
      throw error;
    }
  }

  async generateBatchDiplomas(
    requests: Array<{ type: string; data: DiplomaData }>,
  ): Promise<Buffer[]> {
    const results: Buffer[] = [];

    for (const request of requests) {
      try {
        const pdf = await this.generateDiploma(request.type, request.data);
        results.push(pdf);
      } catch (error) {
        this.logger.error(
          `Error generating diploma for type ${request.type}:`,
          error,
        );
        throw error;
      }
    }

    return results;
  }
}

