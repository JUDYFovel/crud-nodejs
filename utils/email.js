const nodemailer = require('nodemailer');

// Configuration SMTP pour Gmail - Utiliser les variables d'environnement
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

// Fonction pour envoyer un email de bienvenue lors de l'inscription
const sendWelcomeEmail = async (toEmail, userName) => {
  try {
    const mailOptions = {
      from: `"Mon Application" <${process.env.MAIL_USER}>`,
      to: toEmail,
      subject: 'Bienvenue sur notre plateforme !',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Bienvenue ${userName} !</h2>
          <p>Merci de vous être inscrit sur notre plateforme.</p>
          <p>Votre compte a été créé avec succès.</p>
          <p>Vous pouvez maintenant vous connecter et commencer à utiliser nos services.</p>
          <br>
          <p>Cordialement,<br>L'équipe de Mon Application</p>
        </div>
      `,
      text: `
        Bienvenue ${userName} !

        Merci de vous être inscrit sur notre plateforme.
        Votre compte a été créé avec succès.

        Vous pouvez maintenant vous connecter et commencer à utiliser nos services.

        Cordialement,
        L'équipe de Mon Application
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email de bienvenue envoyé:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Erreur envoi email de bienvenue:', error);
    return { success: false, error: error.message };
  }
};

// Fonction pour envoyer un email de réinitialisation de mot de passe
const sendPasswordResetEmail = async (toEmail, resetToken) => {
  try {
    const resetLink = `${process.env.CLIENT_URL}/reset/${resetToken}`;

    const mailOptions = {
      from: `"Mon Application" <${process.env.MAIL_USER}>`,
      to: toEmail,
      subject: 'Réinitialisation de votre mot de passe',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Réinitialisation de mot de passe</h2>
          <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
          <p>Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :</p>
          <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0;">Réinitialiser le mot de passe</a>
          <p>Ce lien expirera dans 1 heure.</p>
          <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
          <br>
          <p>Cordialement,<br>L'équipe de Mon Application</p>
        </div>
      `,
      text: `
        Réinitialisation de mot de passe

        Vous avez demandé la réinitialisation de votre mot de passe.
        Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :

        ${resetLink}

        Ce lien expirera dans 1 heure.

        Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.

        Cordialement,
        L'équipe de Mon Application
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email de réinitialisation envoyé:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Erreur envoi email de réinitialisation:', error);
    return { success: false, error: error.message };
  }
};

// Fonction générique pour envoyer un email
const sendEmail = async (to, subject, htmlContent, textContent) => {
  try {
    const mailOptions = {
      from: `"Mon Application" <${process.env.MAIL_USER}>`,
      to: to,
      subject: subject,
      html: htmlContent,
      text: textContent
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email envoyé:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Erreur envoi email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendEmail
};
