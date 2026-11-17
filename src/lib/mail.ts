import nodemailer from "nodemailer";

// Yerelde Mailpit'e gönderir (http://localhost:8025). Canlıda SMTP bilgileri .env'den gelir.
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  secure: process.env.SMTP_SECURE === "true",
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    : undefined,
});

const FROM = process.env.MAIL_FROM ?? "HSDCode+ <noreply@hsdcode.local>";

export async function sendMail(to: string, subject: string, html: string) {
  await transporter.sendMail({ from: FROM, to, subject, html });
}

export function sendPasswordResetEmail(to: string, resetUrl: string) {
  return sendMail(
    to,
    "HSDCode+ şifre sıfırlama",
    `<p>Merhaba,</p>
     <p>Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın. Bağlantı <b>30 dakika</b> geçerlidir ve yalnızca bir kez kullanılabilir.</p>
     <p><a href="${resetUrl}">Şifremi sıfırla</a></p>
     <p>Bu isteği siz yapmadıysanız bu e-postayı dikkate almayın.</p>`
  );
}

// Eren'in üye onay endpoint'i kullanır
export function sendAccountApprovedEmail(to: string, firstName: string) {
  const loginUrl = `${process.env.FRONTEND_URL ?? "http://localhost:3001"}/giris`;
  return sendMail(
    to,
    "HSDCode+ üyeliğiniz onaylandı",
    `<p>Merhaba ${escapeHtml(firstName)},</p>
     <p>HSDCode+ üyeliğiniz onaylandı. Artık <a href="${loginUrl}">giriş yapabilirsiniz</a>.</p>`
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}