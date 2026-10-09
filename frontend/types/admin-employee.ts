import type { Employee } from "./employee";
import type { Role } from "./auth";
import type { TeamFilters } from "./team";
export interface EmployeeFilters extends TeamFilters { manager_id?: string; role?: Role }
export interface EmployeeUpdate {
  name: string; email: string; phone: string | null; designation: string | null;
  department_id: string; manager_id: string | null; joining_date: string; status: Employee["status"];
}
export interface EmployeeCreate extends Omit<EmployeeUpdate, "status"> {
  employee_code: string; role: Role; initial_password: string; status: "ACTIVE" | "INACTIVE";
}
export type AccountUpdate = { role: Role; status: "ACTIVE" | "INACTIVE" | "LOCKED" };
export function employeeUpdate(employee: Employee): EmployeeUpdate {
  return { name: employee.name, email: employee.email, phone: employee.phone, designation: employee.designation,
    department_id: employee.department.department_id, manager_id: employee.manager?.employee_id ?? null,
    joining_date: employee.joining_date, status: employee.status };
}
