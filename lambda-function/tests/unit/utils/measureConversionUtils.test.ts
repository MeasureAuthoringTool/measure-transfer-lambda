import measure from "../fixtures/measure.json";
import measureDefault from "../fixtures/measure_default.json";
import { convertMeasureMetadata } from "../../../src/utils/measureConversionUtils";
import MatMeasure from "../../../src/models/MatMeasure";
import { MeasureMetadata } from "@madie/madie-models";
describe("Test convertMeasureMetadata", () => {
  it("Should return madie.measureMetaData.measureDefinitions from matMeasure.MeasureDetails.definition", () => {
    const matMeasure: MatMeasure = measure as unknown as MatMeasure;
    const madieMeasureMetadata: MeasureMetadata = convertMeasureMetadata(matMeasure.manageMeasureDetailModel);
    expect(madieMeasureMetadata.measureDefinitions?.length).toBe(1);
    expect(madieMeasureMetadata.measureDefinitions?.[0].definition).toEqual(
      matMeasure.manageMeasureDetailModel.definitions,
    );
    expect(madieMeasureMetadata.measureDefinitions?.[0].term).toBe("");
    expect(madieMeasureMetadata.measureDefinitions?.[0].id).not.toBeNull();
  });

  it("Should return empty array for measureDefinitions when matMeasure doesn't contain any definition", () => {
    const matMeasureDefault: MatMeasure = measureDefault as unknown as MatMeasure;
    const madieMeasureMetadata: MeasureMetadata = convertMeasureMetadata(matMeasureDefault.manageMeasureDetailModel);
    expect(madieMeasureMetadata.measureDefinitions?.length).toBe(0);
  });
});
