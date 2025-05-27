function(properties, context) {
  const fileBase64 = properties.filebase64;  // Entrada no formato data URI (ex.: "data:image/jpeg;base64,...")
  
  // Separa o cabeçalho (ex.: "data:image/jpeg;base64,") dos dados Base64
  let header = "";
  let base64Data = fileBase64;
  const commaIndex = fileBase64.indexOf(',');
  if (commaIndex !== -1) {
    header = fileBase64.substring(0, commaIndex + 1);
    base64Data = fileBase64.substring(commaIndex + 1);
  }
  
  const inputBuffer = Buffer.from(base64Data, 'base64');
  let outputBase64;
  
  // Detecta o tipo do arquivo a partir do cabeçalho
  let fileType = '';
  if (header.includes('image/')) {
    fileType = 'image';
  } else if (header.includes('application/pdf')) {
    fileType = 'pdf';
  } else if (header.includes('text/')) {
    fileType = 'text';
  } else {
    throw new Error("Tipo de arquivo não suportado.");
  }
  
  if (fileType === 'image') {
    // **Imagens:** converte para escala de cinza e otimiza a compressão usando Sharp.
    // Para JPEG, usamos parâmetros extras (trellisQuantisation, overshootDeringing e optimizeScans)
    // para reduzir o tamanho sem perder qualidade perceptível.
    const sharp = require('sharp');
    return sharp(inputBuffer)
      .metadata()
      .then(metadata => {
        if (metadata.format === 'jpeg') {
          return sharp(inputBuffer)
            .grayscale()
            .jpeg({
              quality: 100, 
              mozjpeg: true,
              trellisQuantisation: true,
              overshootDeringing: true,
              optimizeScans: true
            })
            .toBuffer();
        } else if (metadata.format === 'png') {
          return sharp(inputBuffer)
            .grayscale()
            .png({
              compressionLevel: 9, 
              adaptiveFiltering: true
            })
            .toBuffer();
        } else {
          // Para outros formatos, converte para WebP lossless em escala de cinza
          return sharp(inputBuffer)
            .grayscale()
            .webp({ lossless: true })
            .toBuffer();
        }
      })
      .then(buffer => {
        outputBase64 = buffer.toString('base64');
        // Retorna com o mesmo cabeçalho original (atenção: se o formato real foi alterado,
        // o header pode ficar inconsistente)
        return { compressed_file: header + outputBase64 };
      })
      .catch(err => { throw new Error("Erro ao processar imagem: " + err); });
  
  } else if (fileType === 'pdf') {
    // **PDF:** Usa a biblioteca pdf-lib para reestruturar o PDF.
    // A compressão pode ser limitada se o PDF já estiver otimizado.
    const { PDFDocument } = require('pdf-lib');
    return PDFDocument.load(inputBuffer)
      .then(pdfDoc => {
        return pdfDoc.save({ useObjectStreams: true });
      })
      .then(compressedBytes => {
        outputBase64 = Buffer.from(compressedBytes).toString('base64');
        return { compressed_file: header + outputBase64 };
      })
      .catch(err => { throw new Error("Erro ao processar PDF: " + err); });
  
  } else if (fileType === 'text') {
    // **Texto:** Usa zlib com compressão GZIP em nível máximo (9) – compressão lossless.
    const zlib = require('zlib');
    const compressedBuffer = zlib.gzipSync(inputBuffer, { level: 9 });
    outputBase64 = compressedBuffer.toString('base64');
    return { compressed_file: header + outputBase64 };
  }
}