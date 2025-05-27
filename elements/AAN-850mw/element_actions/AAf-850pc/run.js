function(instance, properties, context) {
    // 1. Obter o PDF em base64 do campo de entrada "action_pdf_data"
    let base64PDF = properties.action_pdf_data;
    let qualidade = properties.quality;
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
  
    // 4. Usar PDF.js e jsPDF para renderizar todas as páginas e gerar um novo PDF
    compressWithPDFJS(byteArray)
      .then(newPdfBytes => {
          // 5. Criar um Blob e um objeto File a partir dos bytes do novo PDF
          const blob = new Blob([newPdfBytes], { type: "application/pdf" });
          const file = new File([blob], "compressed.pdf", { type: "application/pdf" });
  
          // 6. Verificar se instance.uploadFile está disponível e fazer o upload
          if (typeof instance.uploadFile !== "function") {
              console.error("instance.uploadFile não está disponível. Certifique-se de que o elemento do plugin esteja inserido na página e que ele implemente a funcionalidade de upload.");
              return;
          }
  
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
  
    // Função auxiliar para renderizar todas as páginas com PDF.js e gerar um novo PDF com jsPDF
    function compressWithPDFJS(byteArray) {
        return new Promise(async (resolve, reject) => {
            try {
                // Carregar o PDF com PDF.js
                const pdf = await pdfjsLib.getDocument({ data: byteArray }).promise;
                const numPages = pdf.numPages;
  
                // Obter a classe jsPDF a partir do objeto global (certifique-se de incluir jsPDF no header)
                const { jsPDF } = window.jspdf;
  
                // Renderizar a primeira página para definir as dimensões do PDF
                const firstPage = await pdf.getPage(1);
                let viewport = firstPage.getViewport({ scale: 1 });
  
                // Criar um novo jsPDF com base nas dimensões da primeira página
                const doc = new jsPDF({
                    orientation: viewport.width > viewport.height ? "l" : "p",
                    unit: "pt",
                    format: [viewport.width, viewport.height]
                });
  
                // Iterar por todas as páginas
                for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                    const page = await pdf.getPage(pageNum);
                    viewport = page.getViewport({ scale: 1 });
  
                    // Criar um canvas para renderizar a página
                    const canvas = document.createElement("canvas");
                    canvas.width = viewport.width;
                    canvas.height = viewport.height;
                    const ctx = canvas.getContext("2d");
  
                    // Renderizar a página no canvas
                    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
  
                    // Converter o canvas para uma imagem JPEG comprimida (qualidade 0.7)
                    const imgData = canvas.toDataURL("image/jpeg", qualidade);
  
                    if (pageNum === 1) {
                        // Para a primeira página, usar a página já criada
                        doc.addImage(imgData, "JPEG", 0, 0, viewport.width, viewport.height);
                    } else {
                        // Para páginas subsequentes, adicionar nova página e a imagem
                        doc.addPage([viewport.width, viewport.height], viewport.width > viewport.height ? "l" : "p");
                        doc.addImage(imgData, "JPEG", 0, 0, viewport.width, viewport.height);
                    }
                }
  
                // Gerar o PDF final como ArrayBuffer
                const pdfArrayBuffer = doc.output("arraybuffer");
                resolve(new Uint8Array(pdfArrayBuffer));
            } catch (e) {
                reject(e);
            }
        });
    }
}