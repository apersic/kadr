import { claimLabel, isOptional, nextAsk, question } from "../src/lib/helpers/chatbot";

describe("chatbot brief", () => {
  test("walks required answers into the run", () => {
    expect(nextAsk("brand")).toBe("website");
    expect(nextAsk("products")).toBe("audience");
    expect(nextAsk("photos")).toBe("run");
  });

  test("treats audience, goals, references, and photos as optional", () => {
    expect(isOptional("brand")).toBe(false);
    expect(isOptional("products")).toBe(false);
    expect(isOptional("audience")).toBe(true);
    expect(isOptional("photos")).toBe(true);
  });

  test("names the GymBeam trial in the first question", () => {
    expect(question("brand")).toContain("GymBeam");
  });

  test("labels a checked claim", () => {
    expect(claimLabel("checked")).toBe("Provjereno");
    expect(claimLabel("missing")).toBe("Nije dostupno");
  });
});
