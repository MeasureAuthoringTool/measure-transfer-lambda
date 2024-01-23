interface ErrorMessage {
  timestamp: Date;
  status: string;
  message: string | undefined;
  validationErrors: any;
}

export const parseError = (message: string): string => {
  try {
    const err: ErrorMessage = JSON.parse(message);
    //If the error message isn't parsed into the expected format, the message won't be defined (most likely).
    if (err.message) {
      return err.message;
    }
    return message;
  } catch (error) {
    return message;
  }
};
