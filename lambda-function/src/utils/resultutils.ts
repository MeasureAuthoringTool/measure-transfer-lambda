export const parseError = (validationErrors: any, message: string) => {
  if (validationErrors && Object.keys(validationErrors).length > 0) {
    const errorValues = Object.values(validationErrors);
    if (Object.keys(validationErrors).length === 1) {
      return errorValues[0];
    } else {
      return errorValues?.map((error, index) => `${index + 1}. ${error}`).join("\n");
    }
  }
  return message;
};
