import { task } from "@trigger.dev/sdk/v3";

export const dummyTask = task({
  id: "dummy-task",
  maxDuration: 60,
  run: async () => {
    return { success: true };
  }
});
