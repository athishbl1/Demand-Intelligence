---
name: n8n-testing
description: Test data and test runs for the team's n8n workflows. Scenarios with expected results, test calls with n8n_test_workflow, the way around schedule, manual and chat triggers, and checking the result by content instead of by colour. Use after building a stage or after a larger change, before a stage counts as done.
---

# Test data and test runs

After building a stage or after a larger change, test **once and properly**. The test of each stage is written in `PLAN.md`: a real example and the expected result.

## Ground rules

- Use public data and your own texts. No personal data of real guests.
- Paid sources (DataForSEO, Apify) and model calls cost money or quota: test with one item first, then a few.
- Test only the team's own workflows. Before activating or testing, check the name with `n8n_get_workflow` (`mode: "minimal"`).

## Steps

1. **Scenarios** (from `PLAN.md`), each with its expected result written down first:
   - the normal case with the real example
   - one edge case (a place without data, a name with umlauts, an empty field)
   - if useful, an error case (a required field missing)
2. **Webhook and form workflows:** test through their trigger, one call per scenario:
   ```
   n8n_test_workflow({workflowId: "...", data: {"place": "St. Gilgen", "date": "2026-11-08"}})
   ```
   - `data` is the request body. In the workflow it is under `$json.body`.
   - The call only works when the workflow is **active**. After a change, publish again (`activateWorkflow`), otherwise the old version runs.
   - Chat triggers are not tested through this tool. A team member uses the "Chat" button in the n8n editor, then you read the execution.
3. **Schedule and manual triggers** cannot be started through the connection (`Workflow cannot be triggered externally`). Two ways:
   - Ask a team member to open the workflow in n8n and click **Execute workflow**, then read the execution.
   - Add a temporary webhook with a slot path (for example `team-07-test`) in front of the first processing step, test through it and remove it afterwards.
4. **Check the result.** Fetch the execution of the team's workflow:
   ```
   n8n_executions({action: "list", workflowId: "..."})
   n8n_executions({action: "get", id: "<execution id>", mode: "summary"})
   ```
   Compare every scenario with its expected result. A green run only means that nothing crashed. Are the numbers right? Did as many items arrive as expected? Does the text match the data, or did a model invent something?

## Format for test data

```json
{
  "testScenarios": [
    {
      "name": "Normal case: one place, one date",
      "data": {"place": "St. Gilgen", "date": "2026-11-08"},
      "expectedOutput": "weather for that day and up to 10 sights nearby, each with its source"
    },
    {
      "name": "Edge case: unknown place",
      "data": {"place": "Xyzabc", "date": "2026-11-08"},
      "expectedOutput": "status not_found with a clear reason, no error"
    }
  ]
}
```

## When to test

- After the first build of a stage: always.
- After larger changes (new steps, changed logic, another source).
- Not after cosmetic changes (positions, sticky notes).
