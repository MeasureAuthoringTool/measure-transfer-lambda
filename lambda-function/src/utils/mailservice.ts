import NodeMailer from "nodemailer";
import { FROM_EMAIL, SMTP_HOSTNAME, SMTP_PASSWORD, SMTP_PORT, SMTP_TLS, SMTP_USERNAME } from "../configs/configs";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import { title } from "process";

export class MailService {
  constructor() {}

  async sendMail(emailId: string, subject: string, message: string): Promise<SMTPTransport.SentMessageInfo> {
    var transporter: NodeMailer.Transporter<SMTPTransport.SentMessageInfo> = await NodeMailer.createTransport({
      host: SMTP_HOSTNAME,
      port: Number(SMTP_PORT) || 0, // SMTP PORT
      secure: Boolean(SMTP_TLS) || false, // true for 465, false for other ports
      auth: {
        user: SMTP_USERNAME,
        pass: SMTP_PASSWORD,
      },
      tls: {
        // do not fail on invalid certs
        rejectUnauthorized: false,
      },
    });

    console.log("######## Transport Created", transporter);
    console.log(`######## Sending email from "${FROM_EMAIL}" with message "${message}"`);
    await transporter.verify(function (error, success) {
      if (error) {
        console.log("Error establishing SMTPTransport", error);
      } else {
        console.log("Mail relay is ready to take our messages");
      }
    });

    try {
      const info: SMTPTransport.SentMessageInfo = await transporter.sendMail({
        from: FROM_EMAIL, // sender address
        to: "gregory.akins@icf.com, brendan.donohue@icf.com", // list of receivers
        subject:title, // Subject line
        text: message, // plain text body
      });
      console.log("######## Message Sent", info);
      return info;
    } catch (error) {
      if (error instanceof Error) {
        console.log("######## Send Email failed", error.message);
      }
      throw error;
    }
  }
}

export default MailService;
