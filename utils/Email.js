//thu vien gui mail
const nodemailer = require('nodemailer'); 

//cấu hình mail
const fs = require('fs');
const transporter = nodemailer.createTransport({
  service: 'Gmail', // Sử dụng Gmail, bạn có thể thay đổi nếu muốn
  auth: {
    user: process.env.AUTH_EMAIL,
    pass: process.env.AUTH_PASS
  }
});

const sendInformationEmail = (orderEmail, detail, content) => {
  const htmlContent = fs.readFileSync('views/mail/index.html', 'utf-8');
  const mailOptions = {
    from: process.env.AUTH_EMAIL,
    to: orderEmail,
    subject: content,
    html: htmlContent
      .replace(/\${greeting}/g, detail.greeting)
      .replace(/\${firstline}/g, detail.firstline)
      .replace(/\${body}/g, detail.body)
      .replace(/\${url}/g, detail.url)
      .replace(/\${lastline}/g, detail.lastline)
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
};

const sendVerificationEmail = (userEmail, verificationToken) => {
  const verificationLink = `http://localhost:3000/verify?token=${verificationToken}`;

  const mailOptions = {
    from: process.env.AUTH_EMAIL,
    to: userEmail,
    subject: 'Account Verification',
    html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h2>Hello ${userEmail}</h2>
              <p>Please click the button below to verify your account:</p>
              <a href="${verificationLink}" style="
                  background-color: #58257b;
                  color: white;
                  padding: 12px 24px;
                  text-decoration: none;
                  display: inline-block;
                  border-radius: 4px;
                  font-weight: bold;">
                  Verify
              </a>
              <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
              <p><a href="${verificationLink}">${verificationLink}</a></p>
          </div>
      `
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.error('Error sending email:', error);
    } else {
      console.log('Verification email sent:', info.response);
    }
  });
};


const sendPasswordResetEmail = (userEmail, token) =>{
    const mailOptions = {
        from: process.env.AUTH_EMAIL,
        to: userEmail,
        subject: 'Reset Password',
        html: `<h1>Hello ${userEmail}<h1>
        <p>You have just requested to retrieve your password. Click the link to reset your password:</p>
        <a href="http://localhost:3000//reset/token=${token}" style="background-color: #58257b; border: none;  color: white;  padding: 15px 32px;  text-align: center;  text-decoration: none;  display: inline-block;  font-size: 16px;">Reset Password</a>`
    };

    transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
}

module.exports = { sendInformationEmail, sendVerificationEmail, sendPasswordResetEmail};