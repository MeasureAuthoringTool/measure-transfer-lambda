import MailService from "../../../src/utils/mailservice";
import SMTPTransport from "nodemailer/lib/smtp-transport";

jest.mock("nodemailer");

const nodemailer = require("nodemailer"); //doesn't work with import. idk why

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

  it("Calls SMTPClient and throws and error", async () => {
    const sendMailMock = jest.fn().mockRejectedValue(new Error("Error Message"));

    nodemailer.createTransport.mockReturnValue({ sendMail: sendMailMock, verify: () => {} });
    const mailService: MailService = new MailService();
    try {
      await mailService.sendMail("dev@example.com", "Error Message");
      fail("Shouldn't have made it here");
    } catch (error) {
      expect(error).not.toBeUndefined();
      if (error instanceof Error) {
        expect(error.message).toEqual("Error Message");
      } else {
        fail("Error isn't the right type");
      }
    }
  });
});
