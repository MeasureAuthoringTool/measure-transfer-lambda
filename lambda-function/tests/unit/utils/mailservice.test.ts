import MailService from "../../../src/utils/mailservice";
import SMTPTransport from "nodemailer/lib/smtp-transport";
import NodeMailer from "nodemailer";

jest.mock("nodemailer");

const sendMailMock = jest.fn().mockReturnValue({ someObjectProperty: 42 }); // this will return undefined if .sendMail() is called

// In order to return a specific value you can use this instead
// const sendMailMock = jest.fn().mockReturnValue(/* Whatever you would expect as return value */);

const nodemailer = require("nodemailer"); //doesn't work with import. idk why
nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });

describe("SMTP test", () => {
  it("Calls SMTPClient", async () => {
    const mailService: MailService = new MailService();
    const info: SMTPTransport.SentMessageInfo = await mailService.sendMail("dev@example.com", "Error Message");
    expect(info).toBeDefined();

    expect(sendMailMock).toHaveBeenCalled();
  });
});
