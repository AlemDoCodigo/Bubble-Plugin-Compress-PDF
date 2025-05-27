function(properties, context) {
  const fileBase64 = properties.filebase64; // Entrada: data:application/pdf;base64,...

  // Separa o header do base64 (se houver)
  let header = "";
  let base64Data = fileBase64;
  const commaIndex = fileBase64.indexOf(',');
  if (commaIndex !== -1) {
    header = fileBase64.substring(0, commaIndex + 1);
    base64Data = fileBase64.substring(commaIndex + 1);
  } else {
    // Se não tiver header, define o padrão para PDF
    header = "data:application/pdf;base64,";
  }

  // Converte base64 para buffer
  const inputBuffer = Buffer.from(base64Data, 'base64');

  // Usa pdf-lib para tentar comprimir o PDF
  const { PDFDocument } = require('pdf-lib');
  return PDFDocument.load(inputBuffer)
    .then(pdfDoc => {
      // Salva o PDF otimizando com useObjectStreams
      return pdfDoc.save({ useObjectStreams: true });
    })
    .then(compressedBytes => {
      const outputBase64 = Buffer.from(compressedBytes).toString('base64');
      return { compressed_file: header + outputBase64 };
    })
    .catch(err => { 
      throw new Error("Erro ao processar PDF: " + err); 
    });
}