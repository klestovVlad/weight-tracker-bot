import { describe, it, expect } from "vitest";
import {
  bucketForWeight,
  pickMemeObject,
  analogyExamplesForWeight,
  validateGptMeme,
} from "../src/helpers/meme";

describe("bucketForWeight", () => {
  it("picks light objects for small changes", () => {
    const pool = bucketForWeight(0.4);
    expect(pool).toContain("плитка шоколада");
  });
  it("picks heavier objects for big changes", () => {
    const pool = bucketForWeight(25);
    expect(pool).toContain("велосипед");
  });
  it("uses absolute value (gain vs loss is symmetric)", () => {
    expect(bucketForWeight(-3)).toEqual(bucketForWeight(3));
  });
  it("falls back to the heaviest bucket for huge values", () => {
    const heaviest = bucketForWeight(1000);
    expect(heaviest).toContain("холодильник");
  });
});

describe("pickMemeObject", () => {
  it("always returns an object from the matching weight bucket", () => {
    for (const kg of [0.3, 1, 2, 5, 10, 20, 40]) {
      const pool = bucketForWeight(kg);
      // Run several times since selection is randomized within the bucket.
      for (let i = 0; i < 20; i++) {
        expect(pool).toContain(pickMemeObject(kg));
      }
    }
  });
});

describe("analogyExamplesForWeight", () => {
  it("lists the bucket objects as a comma string", () => {
    const examples = analogyExamplesForWeight(1);
    expect(examples).toContain("пакет молока");
    expect(examples).toContain(", ");
  });
});

describe("validateGptMeme", () => {
  it("accepts a clean Russian object phrase", () => {
    expect(validateGptMeme({ object: "ведро воды" })).toEqual({
      object: "ведро воды",
      emoji: undefined,
      caption: undefined,
    });
  });
  it("rejects digits, latin, and overly long strings", () => {
    expect(validateGptMeme({ object: "5 кг сахара" })).toBeNull();
    expect(validateGptMeme({ object: "bag of sugar" })).toBeNull();
    expect(validateGptMeme({ object: "x" })).toBeNull();
  });
  it("rejects a caption containing digits", () => {
    expect(validateGptMeme({ object: "арбуз", caption: "целых 5 штук" })).toBeNull();
  });
  it("rejects non-objects", () => {
    expect(validateGptMeme(null)).toBeNull();
    expect(validateGptMeme("ведро")).toBeNull();
    expect(validateGptMeme({})).toBeNull();
  });
});
