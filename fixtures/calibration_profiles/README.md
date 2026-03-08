# Calibration Profile Fixtures

Baseline calibration profiles used for scoring smoke tests and regression checks.

## Schema

Each `<profile>.json` file follows this structure:

```json
{
  "id":            "unique lowercase identifier",
  "name":          "Display name",
  "resume_text":   "Full extracted resume text (single string)",
  "prompt_answers": {
    "prompt_1":    "What felt most like you?",
    "prompt_2":    "What drained you fastest?",
    "prompt_3":    "What do people come to you for?",
    "prompt_4":    "What challenge feels exciting?",
    "prompt_5":    "What are you best at / outside-work strengths?"
  }
}
```

## Loading in tests

```ts
import chris from "../../fixtures/calibration_profiles/chris.json";

const prompts = [
  chris.prompt_answers.prompt_1,
  chris.prompt_answers.prompt_2,
  chris.prompt_answers.prompt_3,
  chris.prompt_answers.prompt_4,
  chris.prompt_answers.prompt_5,
];
```

## Profiles

| File | Name | Source |
|------|------|--------|
| `chris.json` | Chris | Text resume |
| `jen.json` | Jen | PDF resume |
| `fabio.json` | Fabio | PDF resume |
