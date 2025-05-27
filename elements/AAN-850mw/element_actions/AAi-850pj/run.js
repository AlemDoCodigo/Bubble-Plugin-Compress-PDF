function(instance, properties, context) {
    // 1. Obter a(s) imagem(s) em base64 do campo de entrada "action_image_data"
    let imageInput = properties.action_image_data;
    if (!imageInput) {
        console.error("Nenhuma imagem em base64 fornecida no campo 'action_image_data'.");
        instance.triggerEvent("erro");
        return;
    }
    // Se não for array, transforma em array para uniformidade
    let images = Array.isArray(imageInput) ? imageInput : [imageInput];
    
    // Função auxiliar para carregar uma imagem a partir de um data URI
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = err => reject(err);
            img.src = src;
        });
    }
    
    // Função auxiliar para comprimir a imagem usando um canvas.
    // Detecta o tipo original (.jpg, .jpeg, .png, .webp) e converte:
    // - Se PNG, mantém o formato;
    // - Se JPEG, JPG ou WEBP, converte para JPEG.
    function compressImage(img, quality) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            
            // Detectar o tipo original da imagem
            const mimeMatch = img.src.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,/i);
            let outputMime = "image/jpeg"; // padrão para JPEG
            if(mimeMatch) {
                let originalMime = mimeMatch[1].toLowerCase();
                // Se for PNG, mantemos o formato; para os demais, convertemos para JPEG
                if(originalMime === "image/png") {
                    outputMime = "image/png";
                } else {
                    outputMime = "image/jpeg";
                }
            }
            
            let compressedDataURL;
            try {
                if (outputMime === "image/png") {
                    // Para PNG, a qualidade não é utilizada
                    compressedDataURL = canvas.toDataURL("image/png");
                } else {
                    compressedDataURL = canvas.toDataURL("image/jpeg", quality);
                }
                resolve({ dataURL: compressedDataURL, width: canvas.width, height: canvas.height, format: outputMime });
            } catch (err) {
                reject(err);
            }
        });
    }
    
    // Função auxiliar para converter as imagens comprimidas em um PDF usando jsPDF.
    // O formato passado para doc.addImage é definido de acordo com o tipo de cada imagem.
    function convertImagesToPDF(imageDataArray) {
        return new Promise((resolve, reject) => {
            try {
                const { jsPDF } = window.jspdf;
                // Dimensões A4 em pontos (aproximadamente 595.28 x 841.89)
                const pageWidth = 595.28;
                const pageHeight = 841.89;
  
                // Cria um novo PDF com formato A4 em portrait
                const doc = new jsPDF({
                    orientation: "p",
                    unit: "pt",
                    format: "a4"
                });
  
                // Iterar por todas as imagens e adicioná-las como páginas do PDF A4
                imageDataArray.forEach((imgData, index) => {
                    // Calcular escala para ajustar a imagem dentro da página A4
                    const scale = Math.min(pageWidth / imgData.width, pageHeight / imgData.height);
                    const displayWidth = imgData.width * scale;
                    const displayHeight = imgData.height * scale;
                    // Calcular margens para centralizar a imagem
                    const marginX = (pageWidth - displayWidth) / 2;
                    const marginY = (pageHeight - displayHeight) / 2;
  
                    // Define o formato para o jsPDF ("PNG" ou "JPEG")
                    const imgFormat = (imgData.format === "image/png") ? "PNG" : "JPEG";
  
                    if (index === 0) {
                        doc.addImage(imgData.dataURL, imgFormat, marginX, marginY, displayWidth, displayHeight);
                    } else {
                        doc.addPage("a4", "p");
                        doc.addImage(imgData.dataURL, imgFormat, marginX, marginY, displayWidth, displayHeight);
                    }
                });
  
                // Gerar o PDF como ArrayBuffer
                const pdfArrayBuffer = doc.output("arraybuffer");
                resolve(new Uint8Array(pdfArrayBuffer));
            } catch (err) {
                reject(err);
            }
        });
    }
    
    // Função auxiliar para fazer o upload do arquivo usando instance.uploadFile
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
    
    // Processar todas as imagens: carregar, comprimir e coletar os dados comprimidos
    Promise.all(images.map(src => loadImage(src).then(img => compressImage(img, 0.7))))
      .then(imageDataArray => {
          // Converter as imagens comprimidas para um PDF com tamanho A4
          return convertImagesToPDF(imageDataArray);
      })
      .then(newPdfBytes => {
          // Criar um Blob e um objeto File a partir dos bytes do PDF gerado
          const blob = new Blob([newPdfBytes], { type: "application/pdf" });
          const file = new File([blob], "converted.pdf", { type: "application/pdf" });
          
          // Verificar se instance.uploadFile está disponível e fazer o upload
          if (typeof instance.uploadFile !== "function") {
              console.error("instance.uploadFile não está disponível.");
              instance.triggerEvent("erro");
              return;
          }
          return sendToServer(file);
      })
      .then(uploadedURL => {
          instance.publishState("compressed_pdf", uploadedURL);
          instance.triggerEvent("upload_complete");
      })
      .catch(error => {
        console.error("Erro ao converter para PDF:", error);
        // Expor o erro via estado para que possa ser usado em outros lugares
        instance.publishState("error_message", error.toString());
        // Disparar o evento de erro para fluxos de trabalho reativos
        instance.triggerEvent("erro");
    });
}