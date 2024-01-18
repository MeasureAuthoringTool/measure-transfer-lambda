import NodeMailer from "nodemailer";
import { FROM_EMAIL, SMTP_HOSTNAME, SMTP_PASSWORD, SMTP_PORT, SMTP_TLS, SMTP_USERNAME } from "../configs/configs";
import SMTPTransport from "nodemailer/lib/smtp-transport";

export class MailService {
  constructor() {}

  async sendMail(emailId: string, message: string): Promise<SMTPTransport.SentMessageInfo> {
    var transporter = NodeMailer.createTransport({
      host: SMTP_HOSTNAME,
      port: Number(SMTP_PORT) || 0, // SMTP PORT
      secure: Boolean(SMTP_TLS) || false, // true for 465, false for other ports
      auth: {
        user: SMTP_USERNAME,
        pass: SMTP_PASSWORD,
      },
    });
    console.log("######## Transport Created");
    console.log(`######## Sending email from "${FROM_EMAIL}" with message "${message}"`);
    try {
      const info:SMTPTransport.SentMessageInfo = await transporter.sendMail({
        from: FROM_EMAIL, // sender address
        to: "gregory.akins@icf.com", // list of receivers
        subject: "A problem occurred importing a Measure to MADiE", // Subject line
        text: message, // plain text body
      });
      console.log("######## Message Sent", info);
      return info ;
    } catch (error) {
      if (error instanceof Error) {
        console.log("######## Send Email failed", error.message);      
      }
      throw error ;
    }    
  }
}

export default MailService;
