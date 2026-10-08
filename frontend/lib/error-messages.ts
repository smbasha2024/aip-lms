const messages: Record<string, string> = {
  INVALID_CREDENTIALS: "Invalid username or password.",
  USER_INACTIVE: "Your account is inactive. Please contact your administrator.",
  USER_LOCKED: "Your account is locked. Please contact your administrator.",
  EMPLOYEE_INACTIVE: "Your employee record is inactive. Please contact your administrator.",
  UNAUTHENTICATED: "Your session has expired. Please sign in again.",
  LOGIN_RATE_LIMITED: "Too many sign-in attempts. Please try again later.",
  NETWORK_ERROR: "Unable to connect to the server. Please try again.",
  SERVER_ERROR: "Something went wrong. Please try again later.",
  VALIDATION_ERROR: "Check the form values and try again.",
  EMPLOYEE_NOT_FOUND: "Employee could not be found.",
  FORBIDDEN: "You don't have permission to view this page.",
};
export function errorMessage(code: string): string {
  return messages[code] ?? "Request could not be completed. Please try again.";
}
