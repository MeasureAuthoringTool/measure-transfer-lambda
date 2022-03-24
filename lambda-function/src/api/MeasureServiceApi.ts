import axios from "axios";
import Measure from "../models/Measure";

export class MeasureServiceApi {
  constructor(private madieMeasureServiceUrl: string, private apiKey: string) {}

  async transferMeasureToMadie(measure: Measure, harpId: string): Promise<Measure> {
    try {
      const response = await axios.post<Measure>(
        `${this.madieMeasureServiceUrl}/measure-transfer/mat-measures`,
        measure,
        {
          headers: {
            "api-key": "1234",
          },
        },
      );
      return response.data;
    } catch (err) {
      const message = `Failed to transfer the measure over to MADiE.`;
      console.log(message, err);
      throw new Error(message);
    }
  }
}
