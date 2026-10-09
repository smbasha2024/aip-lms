import { notFound } from "next/navigation";
import { EmployeeDetailScreen } from "@/features/employees/EmployeeDetailScreen";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound(); return <EmployeeDetailScreen id={id}/>; }
