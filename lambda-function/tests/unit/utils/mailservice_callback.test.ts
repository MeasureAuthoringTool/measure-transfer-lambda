import NodeMailer from "nodemailer";
import SMTPTransport from "nodemailer/lib/smtp-transport";

import MailService from "../../../src/utils/mailservice";

describe("SMTP test", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });
  test("should pass", async () => {
    const sendMailMock = jest.fn().mockReturnValue({ someObjectProperty: 42 }); //we're not inspecting the response, so the mock return doesn't matter

    const nodeMailerSpy = jest.spyOn(NodeMailer, "createTransport").mockImplementation(() => {
      return {
        sendMail: sendMailMock,
        verify: () => {
          console.log("Mock Verify");
        },
      } as unknown as NodeMailer.Transporter<SMTPTransport.SentMessageInfo>;
    });

    const mailService: MailService = new MailService();
    await mailService.sendMail("dev@example.com", "test", "Error Message");
    expect(nodeMailerSpy).toHaveBeenCalled();
  });
});
