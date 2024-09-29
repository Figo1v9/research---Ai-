const fs = require('fs');
const axios = require('axios');
const { Telegraf } = require('telegraf');
const PDFDocument = require('pdfkit');
const arabicReshaper = require('arabic-reshaper');
const bidi = require('bidi-js');
const docx = require('docx');

// API Keys and Tokens
const GEMINI_API_KEY = 'AIzaSyA0mYC_EoL3bVMhVRc0CF70uoeGZzVf59g';
const TELEGRAM_TOKEN = '7392459074:AAG9sixtiU91cl_qv8sqrw363ilh5PZftYo';

const bot = new Telegraf(TELEGRAM_TOKEN);

async function generateResearch(topic) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
  const headers = { 'Content-Type': 'application/json' };
  const prompt = `اكتب بحثًا منظمًا وموجزًا من صفحة واحدة باللغة العربية عن ${topic}، بما في ذلك المراجع في النهاية. يجب أن يكون المحتوى حوالي 600 كلمة.`;
  const data = {
    contents: [{ parts: [{ text: prompt }] }]
  };

  try {
    const response = await axios.post(url, data, { headers });
    return response.data.candidates[0].content.parts[0].text.trim();
  } catch (error) {
    console.error(`Error generating research: ${error}`);
    return "حدث خطأ أثناء إنشاء البحث. يرجى المحاولة مرة أخرى لاحقًا.";
  }
}

function cleanText(text) {
  return text.replace(/<[^>]+>/g, '').replace(/[&^%$#@!_()*&\-]/g, ' ');
}

function reshapeArabicText(text) {
  const reshaped = arabicReshaper.reshape(text);
  return bidi.bidi(reshaped, { direction: 'RTL' });
}

function createPdf(researchText, filename, topic) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.pipe(fs.createWriteStream(filename));

  doc.font('fonts/Amiri-Regular.ttf');
  doc.fontSize(18).text(reshapeArabicText(`بحث عن: ${topic}`), { align: 'center' });
  doc.moveDown();

  const cleanedText = cleanText(researchText);
  doc.fontSize(12);
  cleanedText.split('\n\n').forEach(paragraph => {
    doc.text(reshapeArabicText(paragraph), { align: 'right' });
    doc.moveDown();
  });

  doc.fontSize(6).text(reshapeArabicText('تم برمجة بواسطة الطالب / محمد خضر'), { align: 'center' });

  doc.end();
}

function createDoc(researchText, filename, topic) {
  const doc = new docx.Document({
    sections: [{
      properties: {},
      children: [
        new docx.Paragraph({
          text: reshapeArabicText(`بحث عن: ${topic}`),
          heading: docx.HeadingLevel.HEADING_1,
          alignment: docx.AlignmentType.CENTER,
        }),
        ...cleanText(researchText).split('\n\n').map(paragraph =>
          new docx.Paragraph({
            text: reshapeArabicText(paragraph),
            alignment: docx.AlignmentType.RIGHT,
          })
        ),
        new docx.Paragraph({
          text: reshapeArabicText('تم برمجة بواسطة الطالب / محمد خضر'),
          alignment: docx.AlignmentType.CENTER,
          style: 'footnote',
        }),
      ],
    }],
  });

  docx.Packer.toBuffer(doc).then((buffer) => {
    fs.writeFileSync(filename, buffer);
  });
}

bot.start((ctx) => {
  const welcomeMessage = "🚀مرحبًا بك في بوت البحث العلمي! 📚✨\n" +
    "البوت من برمجة الطالب / محمد خضر (بالفرقة الاولي) للتواصل معه @FigoMK\n\n" +
    "للبدء، ما عليك سوى إرسال موضوع ترغب في عمل بحث عنه. " +
    "سيقوم بإنشاء ورقة موجزة من صفحة واحدة لك باستخدام تقنية الذكاء الاصطناعي عالية المستوى.\n\n" +
    "مثال: 'المحاسبة المالية وتطبيقها في الواقع'";
  ctx.reply(welcomeMessage);
});

bot.on('text', async (ctx) => {
  const topic = ctx.message.text;

  const generatingMessage = `📝 جارٍ إنشاء بحث عن: '${topic}'...\nقد يستغرق هذا بضع لحظات، يرجى الانتظار.`;
  await ctx.reply(generatingMessage);

  try {
    const researchText = await generateResearch(topic);

    const safeTopic = topic.replace(/[^a-z0-9]/gi, '_');
    const pdfFilename = `${safeTopic}_بحث.pdf`;
    const docFilename = `${safeTopic}_بحث.docx`;

    createPdf(researchText, pdfFilename, topic);
    createDoc(researchText, docFilename, topic);

    await ctx.replyWithDocument({ source: pdfFilename });
    await ctx.replyWithDocument({ source: docFilename });

    const successMessage = "🎉 تم إنشاء البحث بنجاح!\n\n" +
      "لقد أرسلت لك نسختين من الورقة بصيغتي PDF وDOCX. " +
      "😊 لا تتردد في طلب موضوع آخر في أي وقت.";
    await ctx.reply(successMessage);

    fs.unlinkSync(pdfFilename);
    fs.unlinkSync(docFilename);
  } catch (error) {
    const errorMessage = `عذرًا، حدث خطأ أثناء إنشاء البحث. يرجى المحاولة مرة أخرى لاحقًا.\nالخطأ: ${error.message}`;
    await ctx.reply(errorMessage);
  }
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
