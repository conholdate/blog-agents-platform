export type RepoIssueType = "INVALID_JSON" | "DUPLICATE_KEY" | "EMPTY_TARGET" | "MALFORMED_TARGET" | "SELF_LOOP_REDIRECT" | "CHAINED_REDIRECT";

export const ISSUE_TYPE_COLORS: Record<RepoIssueType, string> = {
  INVALID_JSON:       "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  DUPLICATE_KEY:      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  EMPTY_TARGET:       "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  MALFORMED_TARGET:   "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  SELF_LOOP_REDIRECT: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  CHAINED_REDIRECT:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
};
