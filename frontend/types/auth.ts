export type Role = "EMPLOYEE" | "MANAGER" | "ADMINISTRATOR";
export interface Identity {
  user_id: string; employee_id: string; employee_code: string;
  name: string; email: string; role: Role;
  department: { department_id: string; code: string; name: string };
  organization_timezone: string; business_today: string;
}
export interface LoginResponse {
  access_token: string; token_type: "bearer"; expires_in: number; user: Identity;
}
export interface StoredSession { token: string; expires_at: number }
