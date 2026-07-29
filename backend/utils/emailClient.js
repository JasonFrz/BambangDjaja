require('dotenv').config();
const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: parseInt(process.env.SMTP_PORT || '465') === 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const sendEmailMessage = async (toEmail, subject, text) => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS || process.env.SMTP_USER === 'your_email@gmail.com') {
    throw new Error('SMTP credentials are not configured properly in .env');
  }

  const transporter = createTransporter();

  const mailOptions = {
    from: `"PT. Bambang Djaja - TMU System" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: subject,
    text: text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Berhasil mengirim notifikasi Email ke ${toEmail} [${info.messageId}]`);
    return true;
  } catch (error) {
    console.error(`❌ Gagal mengirim notifikasi Email ke ${toEmail}:`, error.message);
    throw error;
  }
};

module.exports = {
  sendEmailMessage,
};
