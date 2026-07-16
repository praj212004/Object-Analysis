require("dotenv").config();
const exp = require("express");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const fsPromises = fs.promises;
const path = require("path");
const {GoogleGenerativeAI} = require("@google/generative-ai")

const app = exp();

app.use(exp.urlencoded({extended:true}));

app.use(exp.static("public"));

const port = process.env.PORT || 2004;

const upload = multer({dest:"uploads/"});

app.use(exp.json({limit:"10mb"}));

const genai = new GoogleGenerativeAI(process.env.API_KEY);

app.post("/analyze",upload.single("image"),async(req,res)=>{
    try{
        if(!req.file){
    return res.status(400).json({
        error:"Please upload an image"
            });
        }
        const imagePath = req.file.path;
        const imageData = await fsPromises.readFile(imagePath,{
            encoding:"base64"
        });
        const model = genai.getGenerativeModel({
    model: "gemini-2.5-flash"
});
        const result = await model.generateContent([
            "Analyze this image of the object and provide a detailed analysis of its identity, material or composition, current condition, and its historical or functional significance",
            {inlineData:{
                mimeType: req.file.mimetype,
                data:imageData
            }
            }
        ])
        const objInfo = result.response.text();

        await fsPromises.unlink(imagePath);

        res.json({
            success: true,
            result: objInfo
        });
    }
    catch(err){
        console.log("Error analyzing the image",err)
        res.status(500).json({
            error:"An error occured while analyzing the image"
        })
    }
})

app.post("/download",exp.json(),async (req,res)=>{
 const {result,image} =  req.body;
  try{
    const reportDir = path.join(__dirname,"reports");
    await fsPromises.mkdir(reportDir, {recursive:true});
    
    const filename = `Obj_Analysis_Report_${Date.now()}.pdf`;
    const filePath = path.join(reportDir,filename);
    const writeStream = fs.createWriteStream(filePath);
    const doc = new PDFDocument();
    doc.pipe(writeStream);

    doc.fontSize(24).text("Object Analysis Report",{
        align:"center"
    });
    doc.moveDown();
    doc.fontSize(24).text(`Date:  ${new Date().toLocaleDateString()}`);
    doc.moveDown();
    doc.fontSize(14).text(result,{align:"center"});
    
    if(image){
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        doc.moveDown();
        try {
    doc.image(buffer, {
        fit: [500, 300],
        align: "center"
    });
    } catch (err) {
        console.log("Image could not be added to PDF");
    }
    }
        doc.end();

        await new Promise((resolve,reject)=>{
            writeStream.on("finish",resolve);
            writeStream.on("error",reject);
        })
        res.download(filePath,(err) =>{
            if (err) {
                res.status(500).json({error:"error downloading the pdf report"})
            }
            fsPromises.unlink(filePath).catch(console.error);
        })
    }catch (error){
        console.error("error generating PDF report");
        res.status(500).json({
            error:"An error occured while generating pdf report"
        })
    }
})

app.listen(port,() => {
    console.log(`Server running at : http://localhost:${port}`);
});