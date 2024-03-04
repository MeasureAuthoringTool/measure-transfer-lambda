export const parseError = (errorMessage: string) => {
  try {
    const parsedError = JSON.parse(errorMessage);
    if (parsedError?.validationErrors && Object.keys(parsedError.validationErrors).length > 0) {
      const errorValues = Object.values(parsedError.validationErrors);
      if (Object.keys(parsedError.validationErrors).length === 1) {
        return errorValues[0];
      } else {
        return errorValues?.map((error, index) => `${index + 1}. ${error}`).join("\n");
      }
    }
    return errorMessage;
  } catch (error) {
    return errorMessage;
  }
};
