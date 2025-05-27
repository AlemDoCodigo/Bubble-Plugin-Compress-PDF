function(instance, properties, context) {
    // Obter o PDF em base64 do campo de entrada "action_pdf_data"
    let base64PDF = properties.action_pdf_data;
    if (!base64PDF) {
        console.error("Nenhum PDF em base64 fornecido no campo 'action_pdf_data'.");
        return;
    }
  
    // Remover o prefixo data URI, se presente (assumindo "data:application/pdf;base64,")
    const prefix = "data:application/pdf;base64,";
    let cleanBase64 = base64PDF.indexOf(prefix) === 0 
                      ? base64PDF.substring(prefix.length) 
                      : base64PDF;
  
    // Converter a string base64 para binário
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
  
    // Usar pdf-lib para carregar e re-salvar (compressão básica)
    PDFLib.PDFDocument.load(byteArray)
      .then(pdfDoc => pdfDoc.save())
      .then(newPdfBytes => {
          // Criar um Blob e um objeto File a partir dos bytes do PDF comprimido
          const blob = new Blob([newPdfBytes], { type: "application/pdf" });
          const file = new File([blob], "compressed.pdf", { type: "application/pdf" });
  
          // Verificar se instance.uploadFile está disponível
          if (typeof instance.uploadFile !== "function") {
              console.error("instance.uploadFile não está disponível. Certifique-se de que o elemento do plugin esteja inserido na página e que ele implemente a funcionalidade de upload.");
              return;
          }
  
          // Chamar a função de upload encapsulada (sendToServer)
          sendToServer(file).then(uploadedURL => {
              instance.publishState("compressed_pdf", uploadedURL);
              instance.triggerEvent("upload_complete");
          }).catch(error => {
              console.error("Erro no upload do arquivo:", error);
          });
      })
      .catch(error => {
          console.error("Erro ao processar o PDF:", error);
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