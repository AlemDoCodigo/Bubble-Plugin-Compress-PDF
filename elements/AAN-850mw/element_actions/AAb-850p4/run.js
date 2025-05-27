function(instance, properties, context) {
    // 1. Obter o PDF em base64 do campo de entrada "action_pdf_data"
    let base64PDF = properties.action_pdf_data;
    if (!base64PDF) {
        console.error("Nenhum PDF em base64 fornecido no campo 'action_pdf_data'.");
        return;
    }
  
    // 2. Remover o prefixo data URI, se presente (assumindo "data:application/pdf;base64,")
    const prefix = "data:application/pdf;base64,";
    let cleanBase64 = base64PDF.indexOf(prefix) === 0 
                      ? base64PDF.substring(prefix.length) 
                      : base64PDF;
  
    // 3. Converter a string base64 para binário
    let binaryString;
    try {
        binaryString = atob(cleanBase64);
    } catch (e) {
        console.error("Erro ao decodificar base64:", e);
        return;
    }
  
    const byteArray = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        byteArray[i] = binaryString.charCodeAt(i);
    }
  
    // 4. Carregar o PDF com pdf-lib e remover metadados
    PDFLib.PDFDocument.load(byteArray)
      .then(pdfDoc => {
          // Limpar metadados para reduzir o tamanho
          pdfDoc.setTitle("");
          pdfDoc.setAuthor("");
          pdfDoc.setSubject("");
          pdfDoc.setKeywords([]);
          pdfDoc.setProducer("");
          pdfDoc.setCreator("");
          // Outras otimizações podem ser feitas aqui
          return pdfDoc.save();
      })
      .then(newPdfBytes => {
          // 5. Criar um Blob e um objeto File a partir dos bytes do PDF comprimido
          const blob = new Blob([newPdfBytes], { type: "application/pdf" });
          const file = new File([blob], "compressed.pdf", { type: "application/pdf" });
  
          // 6. Enviar o arquivo usando a função auxiliar sendToServer (que utiliza instance.uploadFile)
          return sendToServer(file);
      })
      .then(uploadedURL => {
          instance.publishState("compressed_pdf", uploadedURL);
          instance.triggerEvent("upload_complete");
      })
      .catch(error => {
          console.error("Erro ao processar e fazer upload do PDF:", error);
      });
  
    // Função auxiliar para realizar o upload usando instance.uploadFile
    function sendToServer(file) {
        return new Promise((resolve, reject) => {
            instance.uploadFile(file, (err, url) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(url);
                }
            });
        });
    }
}