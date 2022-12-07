import axios from "axios";
import { Measure } from "@madie/madie-models";

export class MeasureServiceApi {
  constructor(private madieMeasureServiceUrl: string, private apiKey: string) {}

  async transferMeasureToMadie(measure: Measure, harpId: string): Promise<Measure> {
    try {
      const response = await axios.post<Measure>(
        `${this.madieMeasureServiceUrl}/measure-transfer/mat-measures`,
        measure,
        {
          headers: {
            "api-key": this.apiKey,
            "harp-id": harpId,
          },
        },
      );
      console.log("Measure transferred successfully.");
      return response.data;
    } catch (error: any) {
      console.log("Failed to transfer the measure over to MADiE: ", JSON.stringify(error.response?.data));
      throw error;
    }
  }
}
