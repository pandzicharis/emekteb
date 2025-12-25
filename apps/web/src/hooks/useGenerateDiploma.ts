import { useState } from 'react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

interface DiplomaData {
  imePrezime: string;
  nivo: string;
  datum: string;
  godina: string;
}

/**
 * COORDINATES FOR PDF TEMPLATE FIELDS
 * 
 * IMPORTANT: These coordinates must be determined by inspecting the ILMIHAL.pdf file.
 * 
 * To find the correct coordinates:
 * 1. Open ILMIHAL.pdf in a PDF editor or use pdf-lib to inspect page dimensions
 * 2. Identify where each field should be placed
 * 3. Note that PDF coordinates start from bottom-left (0,0) to top-right
 * 4. Update the coordinates below accordingly
 * 
 * Current placeholder coordinates (A4 page is typically 595 x 842 points):
 * - These are example values and MUST be adjusted
 */
const COORDINATES = {
  imePrezime: { x: 200, y: 400 }, // TODO: Adjust based on actual PDF template inspection
  nivo: { x: 200, y: 350 }, // TODO: Adjust based on actual PDF template inspection
  datum: { x: 200, y: 300 }, // TODO: Adjust based on actual PDF template inspection
  godina: { x: 200, y: 250 }, // TODO: Adjust based on actual PDF template inspection
};

export default function useGenerateDiploma() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfFields, setPdfFields] = useState<string[]>([]);

  // Helper function to inspect PDF form fields
  const inspectPdfFields = async () => {
    try {
      const templatePath = '/ILMIHAL.pdf';
      const templateResponse = await fetch(templatePath);
      const templateBytes = await templateResponse.arrayBuffer();
      const pdfDoc = await PDFDocument.load(templateBytes);

      try {
        const form = pdfDoc.getForm();
        const fields = form.getFields();
        const fieldNames: string[] = [];
        const fieldDetails: Array<{ name: string; type: string; value?: string }> = [];

        console.log('=== PDF FORM FIELDS INSPECTION ===');
        console.log(`Total fields found: ${fields.length}`);
        console.log('');

        fields.forEach((field) => {
          const fieldName = field.getName();
          const fieldType = field.constructor.name;
          fieldNames.push(fieldName);
          
          // Try to get field value if it's a text field
          let fieldValue = '';
          try {
            if (fieldType.includes('TextField')) {
              const textField = field as any;
              fieldValue = textField.getText() || '(empty)';
            }
          } catch (e) {
            fieldValue = '(cannot read)';
          }

          fieldDetails.push({
            name: fieldName,
            type: fieldType,
            value: fieldValue,
          });

          console.log(`Field #${fieldNames.length}:`);
          console.log(`  Name: "${fieldName}"`);
          console.log(`  Type: ${fieldType}`);
          if (fieldValue) {
            console.log(`  Current Value: "${fieldValue}"`);
          }
          console.log('');
        });

        if (fieldNames.length > 0) {
          setPdfFields(fieldNames);
          console.log('=== SUMMARY ===');
          console.log('Field names array:', fieldNames);
          console.log('Field details:', fieldDetails);
          console.log('================');
          return fieldNames;
        } else {
          console.log('PDF does not have form fields');
          console.log('Will use drawText method with coordinates');
          return [];
        }
      } catch (error) {
        console.log('PDF does not have AcroForm fields:', error);
        console.log('Will use drawText method with coordinates');
        return [];
      }
    } catch (error) {
      console.error('Error inspecting PDF:', error);
      return [];
    }
  };

  const generateDiploma = async (data: DiplomaData) => {
    setLoading(true);
    try {
      // Load the template PDF from public folder
      const templatePath = '/ILMIHAL.pdf';
      const templateResponse = await fetch(templatePath);
      const templateBytes = await templateResponse.arrayBuffer();

      // Load the PDF document
      const pdfDoc = await PDFDocument.load(templateBytes);

      // Automatically inspect and log PDF fields
      console.log('=== AUTO-INSPECTING PDF FIELDS ===');
      await inspectPdfFields();

      // Try to get form fields first (if PDF has AcroForm fields)
      try {
        const form = pdfDoc.getForm();
        const fields = form.getFields();
        
        // Check if PDF has form fields and try to fill them
        // Map fields based on actual PDF field names
        const fieldMapping: Record<string, string> = {
          'ime_prezime': data.imePrezime,
          'nivo': data.nivo,
          'datum': (() => {
            const dateObj = new Date(data.datum);
            return dateObj.toLocaleDateString('bs-BA', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            });
          })(),
          'nastavna_godina': data.godina, // Map to nastavna_godina field
        };

        // Also try common variations
        const fieldVariations: Record<string, string[]> = {
          'ime_prezime': ['imePrezime', 'ime_prezime', 'name', 'ime'],
          'nivo': ['nivo', 'level'],
          'datum': ['datum', 'date'],
          'nastavna_godina': ['nastavna_godina', 'godina', 'year', 'nastavnaGodina'],
        };

        // Try to find and fill form fields
        const allFields = form.getFields();
        let fieldsFilled = 0;

        allFields.forEach((field) => {
          const fieldName = field.getName();
          
          // Try exact match first
          if (fieldMapping[fieldName]) {
            try {
              const textField = form.getTextField(fieldName);
              textField.setText(fieldMapping[fieldName]);
              console.log(`✓ Filled field "${fieldName}" with: "${fieldMapping[fieldName]}"`);
              fieldsFilled++;
            } catch (e) {
              console.log(`✗ Could not fill field "${fieldName}":`, e);
            }
            return;
          }

          // Try variations
          for (const [key, variations] of Object.entries(fieldVariations)) {
            if (variations.includes(fieldName)) {
              try {
                const textField = form.getTextField(fieldName);
                textField.setText(fieldMapping[key]);
                console.log(`✓ Filled field "${fieldName}" (mapped from ${key}) with: "${fieldMapping[key]}"`);
                fieldsFilled++;
              } catch (e) {
                console.log(`✗ Could not fill field "${fieldName}":`, e);
              }
              break;
            }
          }
        });

        console.log(`Total fields filled: ${fieldsFilled} out of ${allFields.length}`);
        
        // If we successfully filled form fields, skip drawText
        if (fields.length > 0) {
          // Form fields were found and filled
          const pdfBytes = await pdfDoc.save();
          const blob = new Blob([pdfBytes], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
          setLoading(false);
          return;
        }
      } catch (formError) {
        // PDF doesn't have form fields, fall back to drawText method
        console.log('PDF does not have form fields, using drawText method');
      }

      // Fallback: Draw text on the PDF using coordinates
      // Get the first page
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const { width, height } = firstPage.getSize();

      // Embed a standard font
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Calculate text width for centering
      const textSize = 14;
      const textWidth = boldFont.widthOfTextAtSize(data.imePrezime, textSize);
      const centeredX = (width - textWidth) / 2;

      // Draw text on the PDF
      // NOTE: These coordinates need to be adjusted by inspecting the actual PDF template
      // Ime is centered horizontally
      firstPage.drawText(data.imePrezime, {
        x: centeredX,
        y: COORDINATES.imePrezime.y,
        size: textSize,
        font: boldFont,
        color: rgb(0, 0, 0),
      });

      firstPage.drawText(data.nivo, {
        x: COORDINATES.nivo.x,
        y: COORDINATES.nivo.y,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });

      // Format date
      const dateObj = new Date(data.datum);
      const formattedDate = dateObj.toLocaleDateString('bs-BA', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });

      firstPage.drawText(formattedDate, {
        x: COORDINATES.datum.x,
        y: COORDINATES.datum.y,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });

      firstPage.drawText(data.godina, {
        x: COORDINATES.godina.x,
        y: COORDINATES.godina.y,
        size: 12,
        font: font,
        color: rgb(0, 0, 0),
      });

      // Serialize the PDF
      const pdfBytes = await pdfDoc.save();

      // Create blob URL for preview
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (error) {
      console.error('Error generating diploma:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    generateDiploma,
    previewUrl,
    loading,
    inspectPdfFields,
    pdfFields,
  };
}

