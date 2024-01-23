interface ErrorMessage {
  timestamp: Date;
  status: string;
  message: string | undefined;
  validationErrors: any;
}

export const parseError = (message: string): string => {
  try {
    const err: ErrorMessage = JSON.parse(message);
    if (err.message) {
      console.log("########## undefined", err.message);
      return err.message;
    }
    return message;
  } catch (error) {
    return message;
  }
};
