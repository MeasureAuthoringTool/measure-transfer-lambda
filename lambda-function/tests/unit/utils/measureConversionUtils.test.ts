import measure from "../fixtures/measure.json";
import measureDefault from "../fixtures/measure_default.json";
import { convertMeasureMetadata } from "../../../src/utils/measureConversionUtils";
import MatMeasure from "../../../src/models/MatMeasure";
import { MeasureMetadata } from "@madie/madie-models";
describe("Test convertMeasureMetadata", () => {
  it("Should return measure definition for given mat measure definitions", () => {
    const matMeasure: MatMeasure = measure as unknown as MatMeasure;
    const madieMeasureMetadata: MeasureMetadata = convertMeasureMetadata(matMeasure.manageMeasureDetailModel);
    expect(madieMeasureMetadata.definition).toEqual(matMeasure.manageMeasureDetailModel.definitions);
  });

  it("Should return null for measure definition when matMeasure doesn't contain any definition", () => {
    const matMeasureDefault: MatMeasure = measureDefault as unknown as MatMeasure;
    const madieMeasureMetadata: MeasureMetadata = convertMeasureMetadata(matMeasureDefault.manageMeasureDetailModel);
    expect(madieMeasureMetadata.definition).toBeNull();
  });
});
