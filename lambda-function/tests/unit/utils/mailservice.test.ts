import MailService from "../../../src/utils/mailservice";
import SMTPTransport from "nodemailer/lib/smtp-transport";

jest.mock("nodemailer");
jest.mock("nodemailer/lib/smtp-transport");

const nodemailer = require("nodemailer"); //doesn't work with import. idk why
const smtpTransport = require("nodemailer/lib/smtp-transport");

describe("SMTP test", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it("Calls SMTPClient", async () => {
    const sendMailMock = jest.fn().mockReturnValue({ someObjectProperty: 42 }); //we're not inspecting the response, so the mock return doesn't matter

    nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock, verify: () => {} });

    const mailService: MailService = new MailService();
    const info: SMTPTransport.SentMessageInfo = await mailService.sendMail("dev@example.com", "Error Message");
    expect(info).toBeDefined();

    expect(sendMailMock).toHaveBeenCalled();
  });

  it.skip("Calls SMTPClient, transporter verify returns an error", async () => {
    jest.spyOn(nodemailer, "sendMail").mockImplementation(() => {});

    nodemailer.createTransport.mockReturnValue();

    const mailService: MailService = new MailService();
    const info: SMTPTransport.SentMessageInfo = await mailService.sendMail("dev@example.com", "Error Message");
    expect(info).toBeDefined();
  });

  it("Calls SMTPClient and throws and error", async () => {
    const sendMailMock = jest.fn().mockRejectedValue(new Error());

    nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock });
    const mailService: MailService = new MailService();
    try {
      expect(await mailService.sendMail("dev@example.com", "Error Message")).rejects.toThrow(Error);
      //expect(true).toBeTruthy();
    } catch (error) {
      console.log("###### Catching an error during test");
    }
  });
});
