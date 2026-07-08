import assert from "node:assert/strict";
import test from "node:test";
import { normalizeQuestionText, tokenizeQuestionText } from "./questionTextFormat";

test("normalizes OCR spaces inside split leading medical words", () => {
  const cases: Array<[string, string]> = [
    ["S A node 的動作電位", "SA node 的動作電位"],
    ["f ast sodium channels open", "fast sodium channels open"],
    ["f unny channels open", "funny channels open"],
    ["g astric lipase", "gastric lipase"],
    ["p ancreatic colipase", "pancreatic colipase"],
    ["l ingual lipase", "lingual lipase"],
    ["r eabsorption", "reabsorption"],
    ["s ecretion", "secretion"],
    ["f iltration only", "filtration only"],
    ["a nabolism", "anabolism"],
    ["c arbamoyl phosphate synthetase", "carbamoyl phosphate synthetase"],
    ["a spartate transcarbamoylase", "aspartate transcarbamoylase"],
    ["d ihydroorotate dehydrogenase", "dihydroorotate dehydrogenase"],
    ["o rotidine 5'-mono-phosphate decarboxylase", "orotidine 5'-mono-phosphate decarboxylase"],
    ["I F1", "IF1"],
    ["e IF2", "eIF2"],
    ["c itrate", "citrate"],
    ["g lucagon", "glucagon"],
    ["p almitoyl-CoA", "palmitoyl-CoA"],
    ["e pinephrine", "epinephrine"],
    ["v itamin B 12", "vitamin B12"]
  ];

  for (const [input, expected] of cases) {
    assert.equal(normalizeQuestionText(input), expected);
  }
});

test("normalizes common formula spacing before rendering scripts", () => {
  assert.equal(
    normalizeQuestionText("HCO - 3 / HPO 2- 4 / NH 3 / C H COO- 3 7"),
    "HCO3- / HPO4 2- / NH3 / C3H7COO-"
  );
  assert.equal(normalizeQuestionText("FADH 藉由電子傳遞鏈轉移到氧 2 2 分子"), "FADH2 藉由電子傳遞鏈轉移到氧（O2）分子");
});

test("tokenizes chemical and kinetic notation into stable script tokens", () => {
  assert.deepEqual(tokenizeQuestionText("H2O2 FADH2 PaCO2 HCO3- HPO4 2- C3H7COO- Vmax KM kcat"), [
    { text: "H", subscript: "2" },
    { text: "O", subscript: "2" },
    { text: " " },
    { text: "FADH", subscript: "2" },
    { text: " " },
    { text: "PaCO", subscript: "2" },
    { text: " " },
    { text: "HCO", subscript: "3", superscript: "-" },
    { text: " " },
    { text: "HPO", subscript: "4", superscript: "2-" },
    { text: " " },
    { text: "C", subscript: "3" },
    { text: "H", subscript: "7" },
    { text: "COO", superscript: "-" },
    { text: " " },
    { text: "V", subscript: "max" },
    { text: " " },
    { text: "K", subscript: "M" },
    { text: " " },
    { text: "k", subscript: "cat" }
  ]);
});
